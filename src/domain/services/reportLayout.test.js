// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  CONTENT_BOTTOM_MM,
  CONTENT_WIDTH_MM,
  FONT_SIZES,
  FOOTER_GRAY,
  GUTTER_MM,
  MARGIN_MM,
  PAGE,
  alignedTextOp,
  cellLines,
  createLayout,
  finishLayout,
  heading,
  tableSection,
} from './reportLayout.js';
import { ELLIPSIS, textWidthMm } from './reportText.js';

const COLUMNS = [
  { label: 'Código', widthMm: 30, kind: 'text' },
  { label: 'Nome', widthMm: 120, kind: 'text' },
  { label: 'Qtd.', widthMm: 30, kind: 'number', align: 'right' },
];

function rowsOf(count) {
  return Array.from({ length: count }, (_, index) => [
    `C-${index + 1}`,
    `PRODUTO ${index + 1}`,
    String(index + 1),
  ]);
}

function textsOf(ops) {
  return ops.filter((op) => op.type === 'text').map((op) => op.text);
}

function lay(rows, { startMm } = {}) {
  const layout = createLayout();

  if (startMm !== undefined) {
    layout.ops.push({ type: 'marca' });
    layout.yMm = startMm;
  }

  tableSection(layout, { title: 'Tabela', columns: COLUMNS, rows, empty: 'Nada aqui.' });

  return finishLayout(layout, 'Sessão de teste');
}

/** Quantas linhas cabem na primeira pagina, logo abaixo do titulo e do cabecalho. */
function rowsOnFirstPage() {
  return lay(rowsOf(200))[0].ops.filter((op) => op.type === 'text' && /^C-\d+$/.test(op.text))
    .length;
}

describe('alignedTextOp e cellLines', () => {
  it('termina o texto alinhado à direita na borda da caixa', () => {
    const op = alignedTextOp('R$ 5,49', 100, 20, 50, { align: 'right' });

    expect(op.xMm + textWidthMm('R$ 5,49', FONT_SIZES.body)).toBeCloseTo(120, 2);
    expect(alignedTextOp('A', 100, 20, 50).xMm).toBe(100);
  });

  it('corta o texto, reduz o corpo do número e quebra o texto longo na largura da coluna', () => {
    const name = cellLines('NOME DE PRODUTO MUITO COMPRIDO PARA A COLUNA', {
      widthMm: 30,
      kind: 'text',
    });

    expect(name.lines).toHaveLength(1);
    expect(name.lines[0].endsWith(ELLIPSIS)).toBe(true);
    expect(textWidthMm(name.lines[0], FONT_SIZES.body)).toBeLessThanOrEqual(30 - GUTTER_MM);

    const total = cellLines('R$ 90.071.992.547.409,91', { widthMm: 24, kind: 'number' });

    expect(total.lines).toEqual(['R$ 90.071.992.547.409,91']);
    expect(total.fontSizePt).toBeLessThan(FONT_SIZES.body);
    expect(textWidthMm(total.lines[0], total.fontSizePt)).toBeLessThanOrEqual(24 - GUTTER_MM);

    const text = cellLines('palavra '.repeat(40).trim(), {
      widthMm: 60,
      kind: 'wrap',
      maxLines: 2,
    });

    expect(text.lines).toHaveLength(2);
    expect(text.lines[1].endsWith(ELLIPSIS)).toBe(true);
  });
});

describe('tableSection', () => {
  it('escreve o título, o cabeçalho e as linhas na ordem, numa página só', () => {
    const [page, ...rest] = lay(rowsOf(3));

    expect(rest).toHaveLength(0);
    expect(textsOf(page.ops).slice(0, 13)).toEqual([
      'Tabela',
      'Código',
      'Nome',
      'Qtd.',
      'C-1',
      'PRODUTO 1',
      '1',
      'C-2',
      'PRODUTO 2',
      '2',
      'C-3',
      'PRODUTO 3',
      '3',
    ]);
    expect(page.ops.filter((op) => op.type === 'line')).toHaveLength(2);
  });

  it('põe a frase no lugar da tabela vazia', () => {
    const [page] = lay([]);

    expect(textsOf(page.ops).slice(0, 2)).toEqual(['Tabela', 'Nada aqui.']);
  });

  it('enche a primeira página até a última linha que cabe e passa a seguinte para a página nova', () => {
    const fit = rowsOnFirstPage();
    const exact = lay(rowsOf(fit));
    const over = lay(rowsOf(fit + 1));

    expect(exact).toHaveLength(1);
    expect(over).toHaveLength(2);
    expect(textsOf(over[1].ops).slice(0, 6)).toEqual([
      'Código',
      'Nome',
      'Qtd.',
      `C-${fit + 1}`,
      `PRODUTO ${fit + 1}`,
      String(fit + 1),
    ]);
  });

  it('repete o cabeçalho em cada página e nunca escreve abaixo do limite do conteúdo', () => {
    const pages = lay(rowsOf(150));
    const codes = pages.flatMap((page) => textsOf(page.ops).filter((text) => /^C-\d+$/.test(text)));

    expect(pages.length).toBeGreaterThan(2);
    expect(codes).toEqual(rowsOf(150).map(([code]) => code));

    pages.forEach((page) => {
      expect(textsOf(page.ops).filter((text) => text === 'Código')).toHaveLength(1);
      page.ops
        .filter((op) => op.type === 'text' && op.fontSizePt === FONT_SIZES.body)
        .forEach((op) => expect(op.yMm).toBeLessThanOrEqual(CONTENT_BOTTOM_MM));
    });
  });

  it('leva o título para a página seguinte quando não cabe com o cabeçalho e a primeira linha', () => {
    const pages = lay(rowsOf(2), { startMm: CONTENT_BOTTOM_MM - 12 });

    expect(pages).toHaveLength(2);
    expect(textsOf(pages[0].ops)).not.toContain('Tabela');
    expect(textsOf(pages[1].ops).slice(0, 4)).toEqual(['Tabela', 'Código', 'Nome', 'Qtd.']);
  });

  it('mantém o título na página quando cabe com o cabeçalho e a primeira linha', () => {
    const pages = lay(rowsOf(2), { startMm: CONTENT_BOTTOM_MM - 30 });

    expect(textsOf(pages[0].ops)).toContain('Tabela');
    expect(textsOf(pages[0].ops)).toContain('C-1');
  });

  it('abre a página nova para o título que chega ao pé da página', () => {
    const layout = createLayout();

    layout.ops.push({ type: 'marca' });
    layout.yMm = CONTENT_BOTTOM_MM - 2;
    heading(layout, 'Sozinho');

    expect(layout.pages).toHaveLength(1);
    expect(layout.ops.map((op) => op.text)).toEqual(['Sozinho']);
  });
});

describe('finishLayout', () => {
  it('põe em cada página o rodapé com o texto à esquerda e Página N de M à direita', () => {
    const pages = lay(rowsOf(150));
    const total = pages.length;

    pages.forEach((page, index) => {
      const footer = page.ops.slice(-3);
      const pageText = `Página ${index + 1} de ${total}`;

      expect(page.widthMm).toBe(PAGE.widthMm);
      expect(page.heightMm).toBe(PAGE.heightMm);
      expect(footer[0].type).toBe('line');
      expect(footer[1]).toMatchObject({
        text: 'Sessão de teste',
        xMm: MARGIN_MM,
        gray: FOOTER_GRAY,
      });
      expect(footer[2]).toMatchObject({ text: pageText, fontSizePt: FONT_SIZES.footer });
      expect(footer[2].xMm + textWidthMm(pageText, FONT_SIZES.footer)).toBeCloseTo(
        MARGIN_MM + CONTENT_WIDTH_MM,
        2,
      );
    });
  });

  it('corta o texto do rodapé que encontraria o número da página', () => {
    const layout = createLayout();

    layout.ops.push({ type: 'marca' });

    const [page] = finishLayout(layout, 'Sessão '.repeat(40));
    const left = page.ops.at(-2);

    expect(left.text.endsWith(ELLIPSIS)).toBe(true);
    expect(left.xMm + textWidthMm(left.text, FONT_SIZES.footer)).toBeLessThan(page.ops.at(-1).xMm);
  });

  it('dá uma página para o documento sem conteúdo', () => {
    expect(finishLayout(createLayout(), 'Sessão')).toHaveLength(1);
  });
});
