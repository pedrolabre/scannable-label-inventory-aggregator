/**
 * Relatorio de inventario escrito como CSV para planilha em portugues.
 *
 * Dois arquivos saem do mesmo relatorio: o resumo por produto, uma linha por
 * codigo, e os exemplares, uma linha por etiqueta contada. Os dois seguem a
 * mesma forma: marca de ordem de bytes do UTF-8 no comeco, para a planilha ler
 * os acentos certo; ponto e virgula entre as colunas, porque a virgula e o
 * separador decimal em portugues; fim de linha CRLF, tambem depois da ultima;
 * e o cabecalho na primeira linha.
 *
 * Valor monetario sai duas vezes: em centavos inteiros, para conta, e escrito
 * em reais, para leitura. A forma em reais vem de quem chama (`formatCentavos`):
 * este modulo nao conhece a formatacao da tela, so o texto que ela devolve.
 *
 * Nome, codigo e nome de arquivo vem da etiqueta fotografada e do aparelho, e
 * sao tratados como entrada nao confiavel: texto que a planilha leria como
 * formula ganha um apostrofo na frente. Numero sai como veio.
 *
 * A saida depende so do relatorio: nada aqui le o relogio, e o mesmo relatorio
 * produz o mesmo texto, byte a byte.
 */

export const CSV_BOM = '﻿';
export const CSV_SEPARATOR = ';';
export const CSV_LINE_END = '\r\n';

/** Primeiro caractere com que a planilha comeca uma formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Caracteres que obrigam a celula a ir entre aspas. */
const NEEDS_QUOTES = /[;"\r\n]/;

const FORMULA_GUARD = "'";

const FIELD_LABELS = Object.freeze({
  displayName: 'nome',
  priceInCentavos: 'preço',
  ean: 'EAN',
  ncm: 'NCM',
});

const UNNAMED_FILE = 'foto sem nome';

export const SUMMARY_HEADER = Object.freeze([
  'Código',
  'Nome',
  'Preço (centavos)',
  'Preço',
  'Quantidade',
  'Total (centavos)',
  'Total',
  'EAN',
  'NCM',
  'Resolvido em',
]);

export const COPIES_HEADER = Object.freeze([
  'Código',
  'Exemplar',
  'Leituras',
  'Fotos',
  'Aviso',
  'Texto LF1',
]);

/** Texto que a planilha leria como formula, com o apostrofo na frente. */
export function protectFormula(text) {
  return FORMULA_START.test(text) ? `${FORMULA_GUARD}${text}` : text;
}

/**
 * Uma celula: vazio para ausente, numero como veio, texto protegido e entre
 * aspas quando tem separador, aspas ou quebra de linha (aspas dobradas por
 * dentro).
 */
export function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  const text = protectFormula(String(value));

  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Arquivo inteiro: marca UTF-8, linhas separadas e terminadas por CRLF. */
export function csvText(rows) {
  return `${CSV_BOM}${rows.map((row) => `${row.map(csvCell).join(CSV_SEPARATOR)}${CSV_LINE_END}`).join('')}`;
}

function fileNameOf(fileName) {
  return fileName || UNNAMED_FILE;
}

function formattedOf(centavos, formatCentavos) {
  return centavos === null ? null : formatCentavos(centavos);
}

/** Linhas do resumo por produto, na ordem do relatorio. */
export function summaryRows(report, { formatCentavos }) {
  return report.products.map((product) => [
    product.systemCode,
    product.displayName,
    product.priceInCentavos,
    formattedOf(product.priceInCentavos, formatCentavos),
    product.quantity,
    product.totalInCentavos,
    formattedOf(product.totalInCentavos, formatCentavos),
    product.ean,
    product.ncm,
    product.resolvedFields.map((field) => FIELD_LABELS[field] ?? field).join(', '),
  ]);
}

function warningText(warning) {
  return `${warning.message} (${fileNameOf(warning.fileName)})`;
}

/** Linhas dos exemplares, na ordem do relatorio. */
export function copyRows(report) {
  return report.copies.map((copy) => [
    copy.systemCode,
    copy.copy,
    copy.readingCount,
    copy.sources.map((source) => fileNameOf(source.fileName)).join(', '),
    copy.warnings.map(warningText).join(' / '),
    copy.text,
  ]);
}

/**
 * CSV do resumo por produto. `formatCentavos` escreve um inteiro de centavos
 * em reais (`R$ 1.234,56`).
 */
export function buildSummaryCsv(report, { formatCentavos }) {
  return csvText([SUMMARY_HEADER, ...summaryRows(report, { formatCentavos })]);
}

/** CSV dos exemplares. */
export function buildCopiesCsv(report) {
  return csvText([COPIES_HEADER, ...copyRows(report)]);
}
