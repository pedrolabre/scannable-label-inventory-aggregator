/**
 * Texto do relatorio em PDF: quais caracteres a fonte escreve, quanto cada
 * texto ocupa e como ele cabe numa largura.
 *
 * O PDF usa a helvetica que vem embutida na biblioteca, sem arquivo de fonte e
 * sem rede. Ela escreve o conjunto WinAnsi: o ASCII visivel, o Latin-1 (todos
 * os acentos do portugues) e mais 27 sinais, como reticencias, travessao, aspas
 * curvas e o euro. Fora dele a biblioteca nao recusa: grava bytes que o leitor
 * mostra como outro caractere. Por isso todo texto passa por aqui antes de
 * entrar no documento. A forma composta vem primeiro (letra e acento combinado
 * viram a letra acentuada); o que ainda ficar fora do conjunto vira `?`, um por
 * caractere percebido, e a troca e contada para o documento avisar.
 *
 * As larguras sao as da helvetica publicada (unidades de 1/1000 do corpo), a
 * mesma tabela que o leitor de PDF usa para desenhar. A medida, o corte com
 * reticencias e a quebra em linhas sao calculados aqui, sem a biblioteca: a
 * paginacao inteira fica conferivel sem gerar arquivo nenhum.
 */

/** Milimetros por ponto tipografico. */
export const MM_PER_POINT = 25.4 / 72;

/** Marcador do caractere que a fonte nao escreve. */
export const REPLACEMENT_MARK = '?';

/** Marcador do texto cortado. */
export const ELLIPSIS = '…';

const UNITS_PER_EM = 1000;

/** Sinais do WinAnsi fora do Latin-1, por codigo, na ordem da tabela de larguras. */
const WINANSI_EXTRA_CODES = Object.freeze([
  338, 339, 352, 353, 376, 381, 382, 402, 710, 732, 8211, 8212, 8216, 8217, 8218, 8220, 8221, 8222,
  8224, 8225, 8226, 8230, 8240, 8249, 8250, 8364, 8482,
]);

function codeRange(first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/** Codigos que a fonte escreve: ASCII visivel, Latin-1 visivel e os sinais acima. */
const FONT_CODES = Object.freeze([
  ...codeRange(32, 126),
  ...codeRange(160, 255),
  ...WINANSI_EXTRA_CODES,
]);

const NORMAL_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333,
  333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667,
  1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778,
  722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556,
  278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556,
  500, 1000, 944, 667, 500, 667, 611, 500, 556, 333, 333, 556, 1000, 222, 222, 222, 333, 333, 333,
  556, 556, 350, 1000, 1000, 333, 333, 556, 1000,
];

const BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333,
  333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722,
  1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778,
  722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556,
  278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611,
  556, 1000, 944, 667, 556, 667, 611, 500, 556, 333, 333, 556, 1000, 278, 278, 278, 500, 500, 500,
  556, 556, 350, 1000, 1000, 333, 333, 556, 1000,
];

function widthMap(widths) {
  return new Map(FONT_CODES.map((code, index) => [code, widths[index]]));
}

const WIDTHS = Object.freeze({
  normal: widthMap(NORMAL_WIDTHS),
  bold: widthMap(BOLD_WIDTHS),
});

/** Todos os caracteres que a fonte escreve, na ordem da tabela de larguras. */
export const FONT_CHARACTERS = Object.freeze(FONT_CODES.map((code) => String.fromCodePoint(code)));

/** Largura de um caractere da fonte em unidades de 1/1000 do corpo. */
export function glyphWidth(character, bold = false) {
  return WIDTHS[bold ? 'bold' : 'normal'].get(character.codePointAt(0));
}

const GRAPHEMES = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

function graphemesOf(text) {
  return Array.from(GRAPHEMES.segment(text), (part) => part.segment);
}

function isFontCharacter(character) {
  return WIDTHS.normal.has(character.codePointAt(0));
}

/**
 * Texto pronto para a fonte: forma composta, e cada caractere percebido que
 * tem algo fora da fonte com essa parte trocada por um `?`. Devolve
 * `{ text, replaced }`, com a contagem das trocas.
 */
export function toFontText(value) {
  const source = String(value ?? '').normalize('NFC');
  let replaced = 0;
  let text = '';

  for (const grapheme of graphemesOf(source)) {
    const kept = Array.from(grapheme).filter(isFontCharacter).join('');

    if (kept.length === Array.from(grapheme).length) {
      text += grapheme;
    } else {
      replaced += 1;
      text += `${kept}${REPLACEMENT_MARK}`;
    }
  }

  return { text, replaced };
}

/**
 * Largura em milimetros de um texto ja pronto para a fonte, no corpo em ponto.
 * Caractere fora da fonte nao chega aqui; se chegar, mede como o `?` que o
 * substituiria.
 */
export function textWidthMm(text, fontSizePt, bold = false) {
  const widths = WIDTHS[bold ? 'bold' : 'normal'];
  const fallback = widths.get(REPLACEMENT_MARK.codePointAt(0));
  let units = 0;

  for (const character of text) {
    units += widths.get(character.codePointAt(0)) ?? fallback;
  }

  return (units / UNITS_PER_EM) * fontSizePt * MM_PER_POINT;
}

function fits(text, maxWidthMm, fontSizePt, bold) {
  return textWidthMm(text, fontSizePt, bold) <= maxWidthMm;
}

/**
 * O texto inteiro quando cabe; senao, o maior comeco que cabe com reticencias,
 * cortado entre caracteres percebidos. Vazio quando nem as reticencias cabem.
 */
export function fitText(text, maxWidthMm, fontSizePt, bold = false) {
  if (fits(text, maxWidthMm, fontSizePt, bold)) {
    return text;
  }

  if (!fits(ELLIPSIS, maxWidthMm, fontSizePt, bold)) {
    return '';
  }

  const graphemes = graphemesOf(text);

  for (let kept = graphemes.length - 1; kept > 0; kept -= 1) {
    const candidate = `${graphemes.slice(0, kept).join('').trimEnd()}${ELLIPSIS}`;

    if (fits(candidate, maxWidthMm, fontSizePt, bold)) {
      return candidate;
    }
  }

  return ELLIPSIS;
}

/**
 * Corpo em que um valor cabe inteiro na largura: o corpo pedido quando cabe,
 * senao o menor que cabe, em decimos de ponto. Serve aos numeros, que nunca
 * sao cortados.
 */
export function fittingFontSize(text, maxWidthMm, fontSizePt, bold = false) {
  const width = textWidthMm(text, fontSizePt, bold);

  if (width <= maxWidthMm) {
    return fontSizePt;
  }

  return Math.floor(((fontSizePt * maxWidthMm) / width) * 10) / 10;
}

/**
 * Linhas do texto na largura, quebradas no ultimo espaco que cabe (a palavra
 * maior que a largura e partida entre caracteres percebidos). Passando de
 * `maxLines`, a ultima linha leva o resto do texto, cortado com reticencias.
 * Texto vazio da uma linha vazia.
 */
export function wrapText(text, maxWidthMm, fontSizePt, bold = false, maxLines = Infinity) {
  const lines = [];
  let start = 0;
  let lastSpace = -1;

  for (const { index, segment } of GRAPHEMES.segment(text)) {
    const end = index + segment.length;

    while (
      lines.length < maxLines - 1 &&
      !fits(text.slice(start, end).trimEnd(), maxWidthMm, fontSizePt, bold)
    ) {
      if (lastSpace > start) {
        lines.push(text.slice(start, lastSpace));
        start = lastSpace + 1;
        lastSpace = -1;
      } else if (index > start) {
        lines.push(text.slice(start, index));
        start = index;
      } else {
        break;
      }
    }

    if (segment === ' ' && index > start) {
      lastSpace = index;
    }
  }

  const rest = text.slice(start);

  if (lines.length === maxLines - 1) {
    return [...lines, fitText(rest, maxWidthMm, fontSizePt, bold)];
  }

  return [...lines, rest];
}
