/**
 * Paginacao do relatorio em PDF: a pagina A4 em milimetro, o cursor que desce
 * por ela, os titulos de secao, os paragrafos e as tabelas com o cabecalho
 * repetido em cada pagina.
 *
 * Tudo sai como dados: cada pagina e uma lista de operacoes em coordenada
 * absoluta, com `x` para a direita e `y` para baixo a partir do canto superior
 * esquerdo. O texto ja chega pronto para a fonte (`toFontText`), cortado ou
 * quebrado aqui pela medida da helvetica, e com a posicao de partida calculada
 * tambem para o alinhado a direita: quem desenha so escreve o texto no ponto
 * dado, na linha de base dada.
 *
 * Funcoes puras, sem relogio, sem fuso e sem biblioteca de PDF.
 */

import { fitText, fittingFontSize, textWidthMm, wrapText } from './reportText.js';

export const PAGE = Object.freeze({ widthMm: 210, heightMm: 297 });

export const MARGIN_MM = 15;
export const CONTENT_WIDTH_MM = PAGE.widthMm - 2 * MARGIN_MM;

/** Ultima altura que o conteudo pode ocupar; abaixo fica o rodape. */
export const CONTENT_BOTTOM_MM = 279;

export const FONT_SIZES = Object.freeze({
  title: 14,
  subtitle: 10,
  heading: 10,
  body: 8,
  footer: 7,
});

/** Altura de uma linha de texto do corpo e espaco acima e abaixo da linha da tabela. */
export const LINE_MM = 3.6;
export const ROW_PADDING_MM = 1.2;

/** Distancia entre colunas: o texto da coluna termina antes dela. */
export const GUTTER_MM = 3;

const HEADER_ROW_MM = 5.4;
const SECTION_GAP_MM = 5;
const HEADING_MM = 6.5;
const PARAGRAPH_LINE_MM = 3.8;
const BASELINE_MM = 2.9;

const RULE = Object.freeze({ widthMm: 0.2, gray: 0 });

/** Cinza do rodape e do traco acima dele (0 e preto, 255 e branco). */
export const FOOTER_GRAY = 90;
const FOOTER_RULE = Object.freeze({ yMm: 283, widthMm: 0.1, gray: 170 });
const FOOTER_BASELINE_MM = 287.5;

function round(value) {
  return Math.round(value * 1000) / 1000;
}

/** Texto escrito a partir de `xMm` na linha de base `yMm`. */
export function textOp(
  text,
  xMm,
  yMm,
  { fontSizePt = FONT_SIZES.body, bold = false, gray = 0 } = {},
) {
  return Object.freeze({
    type: 'text',
    text,
    xMm: round(xMm),
    yMm: round(yMm),
    fontSizePt,
    bold,
    gray,
  });
}

/** Texto alinhado na caixa de `xMm` a `xMm + widthMm`. */
export function alignedTextOp(text, xMm, widthMm, yMm, options = {}) {
  const { align = 'left', fontSizePt = FONT_SIZES.body, bold = false } = options;
  const startMm = align === 'right' ? xMm + widthMm - textWidthMm(text, fontSizePt, bold) : xMm;

  return textOp(text, startMm, yMm, options);
}

export function lineOp(x1Mm, yMm, x2Mm, { widthMm, gray }) {
  return Object.freeze({
    type: 'line',
    x1Mm: round(x1Mm),
    y1Mm: round(yMm),
    x2Mm: round(x2Mm),
    y2Mm: round(yMm),
    lineWidthMm: widthMm,
    gray,
  });
}

/** Paginacao em andamento: paginas prontas, operacoes da pagina atual e o cursor. */
export function createLayout() {
  return { pages: [], ops: [], yMm: MARGIN_MM };
}

export function newPage(layout) {
  layout.pages.push(layout.ops);
  layout.ops = [];
  layout.yMm = MARGIN_MM;
}

/** Garante a altura na pagina atual, abrindo outra quando falta espaco. */
export function ensureSpace(layout, heightMm) {
  if (layout.yMm + heightMm > CONTENT_BOTTOM_MM && layout.ops.length > 0) {
    newPage(layout);
  }
}

/** Paragrafo quebrado na largura do conteudo. */
export function paragraph(layout, text, { fontSizePt = FONT_SIZES.body, bold = false } = {}) {
  for (const line of wrapText(text, CONTENT_WIDTH_MM, fontSizePt, bold)) {
    ensureSpace(layout, PARAGRAPH_LINE_MM);
    layout.ops.push(textOp(line, MARGIN_MM, layout.yMm + BASELINE_MM, { fontSizePt, bold }));
    layout.yMm += PARAGRAPH_LINE_MM;
  }
}

/**
 * Linhas de uma celula: texto cortado com reticencias (`text`), numero inteiro
 * com o corpo reduzido se preciso (`number`), ou texto quebrado em ate
 * `maxLines` linhas (`wrap`). Devolve `{ lines, fontSizePt }`.
 */
export function cellLines(value, column) {
  const widthMm = column.widthMm - GUTTER_MM;
  const size = FONT_SIZES.body;

  if (column.kind === 'number') {
    return { lines: [value], fontSizePt: fittingFontSize(value, widthMm, size) };
  }

  if (column.kind === 'wrap') {
    return { lines: wrapText(value, widthMm, size, false, column.maxLines), fontSizePt: size };
  }

  return { lines: [fitText(value, widthMm, size)], fontSizePt: size };
}

function rowHeight(cells) {
  return Math.max(...cells.map((cell) => cell.lines.length)) * LINE_MM + 2 * ROW_PADDING_MM;
}

function columnStarts(columns) {
  let xMm = MARGIN_MM;

  return columns.map((column) => {
    const start = xMm;

    xMm += column.widthMm;

    return start;
  });
}

function drawHeaderRow(layout, columns, starts) {
  columns.forEach((column, index) => {
    layout.ops.push(
      alignedTextOp(
        fitText(column.label, column.widthMm - GUTTER_MM, FONT_SIZES.body, true),
        starts[index],
        column.widthMm - GUTTER_MM,
        layout.yMm + ROW_PADDING_MM + BASELINE_MM,
        { align: column.align, bold: true },
      ),
    );
  });
  layout.yMm += HEADER_ROW_MM;
  layout.ops.push(lineOp(MARGIN_MM, layout.yMm, MARGIN_MM + CONTENT_WIDTH_MM, RULE));
}

function drawRow(layout, columns, starts, cells) {
  cells.forEach((cell, index) => {
    const column = columns[index];

    cell.lines.forEach((line, lineIndex) => {
      if (line.length === 0) {
        return;
      }

      layout.ops.push(
        alignedTextOp(
          line,
          starts[index],
          column.widthMm - GUTTER_MM,
          layout.yMm + ROW_PADDING_MM + BASELINE_MM + lineIndex * LINE_MM,
          { align: column.align, fontSizePt: cell.fontSizePt },
        ),
      );
    });
  });
  layout.yMm += rowHeight(cells);
}

/**
 * Titulo de secao. `keepMm` e a altura que precisa vir junto na mesma pagina
 * (o cabecalho e a primeira linha da tabela), para o titulo nunca ficar
 * sozinho no pe da pagina.
 */
export function heading(layout, text, keepMm = 0) {
  const gap = layout.ops.length > 0 ? SECTION_GAP_MM : 0;

  ensureSpace(layout, gap + HEADING_MM + keepMm);

  const top = layout.ops.length > 0 ? layout.yMm + gap : layout.yMm;

  layout.ops.push(textOp(text, MARGIN_MM, top + 4, { fontSizePt: FONT_SIZES.heading, bold: true }));
  layout.yMm = top + HEADING_MM;
}

/**
 * Secao em tabela: titulo, cabecalho e linhas, com o cabecalho repetido em
 * cada pagina nova. `rows` sao listas de textos prontos, um por coluna. Sem
 * linha, sai a frase `empty` no lugar da tabela.
 */
export function tableSection(layout, { title, columns, rows, empty }) {
  const starts = columnStarts(columns);
  const prepared = rows.map((row) => row.map((value, index) => cellLines(value, columns[index])));

  if (prepared.length === 0) {
    heading(layout, title, PARAGRAPH_LINE_MM);
    paragraph(layout, empty);
    return;
  }

  heading(layout, title, HEADER_ROW_MM + rowHeight(prepared[0]));
  drawHeaderRow(layout, columns, starts);

  for (const cells of prepared) {
    if (layout.yMm + rowHeight(cells) > CONTENT_BOTTOM_MM) {
      newPage(layout);
      drawHeaderRow(layout, columns, starts);
    }

    drawRow(layout, columns, starts, cells);
  }
}

/**
 * Fecha a paginacao: cada pagina ganha o rodape com o texto da esquerda
 * (cortado na largura que sobra) e `Pagina N de M` a direita.
 */
export function finishLayout(layout, footerText) {
  if (layout.ops.length > 0 || layout.pages.length === 0) {
    layout.pages.push(layout.ops);
  }

  const total = layout.pages.length;
  const right = MARGIN_MM + CONTENT_WIDTH_MM;
  const footer = { fontSizePt: FONT_SIZES.footer, gray: FOOTER_GRAY };

  return layout.pages.map((ops, index) => {
    const pageText = `Página ${index + 1} de ${total}`;
    const pageWidth = textWidthMm(pageText, FONT_SIZES.footer);
    const leftText = fitText(
      footerText,
      CONTENT_WIDTH_MM - pageWidth - 2 * GUTTER_MM,
      FONT_SIZES.footer,
    );

    return Object.freeze({
      widthMm: PAGE.widthMm,
      heightMm: PAGE.heightMm,
      ops: Object.freeze([
        ...ops,
        lineOp(MARGIN_MM, FOOTER_RULE.yMm, right, FOOTER_RULE),
        textOp(leftText, MARGIN_MM, FOOTER_BASELINE_MM, footer),
        textOp(pageText, right - pageWidth, FOOTER_BASELINE_MM, footer),
      ]),
    });
  });
}
