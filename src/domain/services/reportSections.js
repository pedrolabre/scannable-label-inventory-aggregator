/**
 * Linhas das secoes do relatorio de inventario.
 *
 * Cada funcao recebe o que o dominio ja calculou (exemplares, rejeitados,
 * produtos com as escolhas aplicadas, conflitos) e devolve as linhas prontas
 * para a tela e para as exportacoes, com o nome do arquivo de cada foto ao lado
 * do identificador. Valores monetarios continuam em centavos inteiros; a
 * formatacao em reais e de quem exibe.
 *
 * Nada daqui e gravado: as linhas sao recalculadas sempre que o relatorio e
 * montado.
 */

import { SOURCE_FAILURE_MESSAGES, SOURCE_STATUSES } from '../schemas/sourceSchema.js';
import { PROCESSING_WARNINGS, PROCESSING_WARNING_MESSAGES } from './sourceProcessing.js';

/** Limite do texto rejeitado exibido, em caracteres percebidos (grafemas). */
export const REJECTED_TEXT_MAX_LENGTH = 120;

/** Marcador acrescentado ao texto rejeitado cortado. */
export const TRUNCATION_MARK = '…';

export const SOURCE_STATUS_MESSAGES = Object.freeze({
  [SOURCE_STATUSES.READ]: 'lida',
  [SOURCE_STATUSES.FAILED]: 'com falha',
});

export const CONFLICT_STATUSES = Object.freeze({
  OPEN: 'open',
  RESOLVED: 'resolved',
});

const GRAPHEMES = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

/**
 * Corta o texto em `maxLength` grafemas, sem separar letra e acento combinado
 * nem as partes de um emoji composto, e acrescenta o marcador quando cortou.
 * Devolve `{ displayText, truncated }`.
 */
export function truncateText(text, maxLength = REJECTED_TEXT_MAX_LENGTH) {
  // Cada grafema ocupa ao menos uma unidade UTF-16: texto curto nunca e cortado.
  if (text.length <= maxLength) {
    return { displayText: text, truncated: false };
  }

  let count = 0;
  let end = 0;

  for (const { index, segment } of GRAPHEMES.segment(text)) {
    if (count === maxLength) {
      return { displayText: `${text.slice(0, index)}${TRUNCATION_MARK}`, truncated: true };
    }

    count += 1;
    end = index + segment.length;
  }

  return { displayText: text.slice(0, end), truncated: false };
}

/** Nome do arquivo da foto, ou `null` quando a leitura aponta para foto desconhecida. */
export function fileNameResolver(sources) {
  const names = new Map(sources.map((source) => [source.id, source.fileName]));

  return (sourceId) => names.get(sourceId) ?? null;
}

function sourceRefOf(sourceId, fileNameOf) {
  return { sourceId, fileName: fileNameOf(sourceId) };
}

/**
 * Secao Exemplares: `[{ systemCode, copy, text, readingCount, sources,
 * warnings }]`, na ordem dos exemplares recebidos, com as fotos como
 * `{ sourceId, fileName }` e o aviso de reimpressao com o nome da foto.
 */
export function copyRows(copies, fileNameOf) {
  return copies.map((copy) => ({
    systemCode: copy.fields.systemCode,
    copy: copy.fields.copy,
    text: copy.text,
    readingCount: copy.readingCount,
    sources: copy.sourceIds.map((sourceId) => sourceRefOf(sourceId, fileNameOf)),
    warnings: copy.warnings.map((warning) => ({
      code: warning.code,
      sourceId: warning.sourceId,
      fileName: fileNameOf(warning.sourceId),
      positionCount: warning.positionCount,
      message: warning.message,
    })),
  }));
}

/**
 * Secao Rejeitados: uma linha por leitura, na ordem recebida, com o motivo, o
 * campo recusado (`null` fora da recusa de campo), o texto inteiro e o texto
 * cortado para exibicao.
 */
export function rejectedRows(rejected, fileNameOf) {
  return rejected.map((entry) => {
    const { displayText, truncated } = truncateText(entry.text);

    return {
      readingId: entry.readingId,
      sourceId: entry.sourceId,
      fileName: fileNameOf(entry.sourceId),
      reason: entry.reason,
      message: entry.message,
      field: entry.field ?? null,
      text: entry.text,
      displayText,
      textTruncated: truncated,
    };
  });
}

/**
 * Secao Resumo por produto: os produtos com as escolhas aplicadas, na ordem
 * recebida, com `warningCount`, a soma dos avisos dos exemplares do codigo.
 */
export function productRows(products, copies) {
  const warningsByCode = new Map();

  for (const copy of copies) {
    const { systemCode } = copy.fields;

    warningsByCode.set(systemCode, (warningsByCode.get(systemCode) ?? 0) + copy.warnings.length);
  }

  return products.map((product) => ({
    ...product,
    warningCount: warningsByCode.get(product.systemCode) ?? 0,
  }));
}

/**
 * Conflitos com a situacao de cada um: `[{ systemCode, field, status,
 * chosenValue, variants }]`, na ordem de `detectConflicts`. `chosenValue` so
 * tem sentido com `status: 'resolved'` (pode ser `null`, a variante sem o
 * campo); no conflito aberto sai `null`.
 */
export function conflictRows(conflicts, products) {
  const productsByCode = new Map(products.map((product) => [product.systemCode, product]));

  return conflicts.map((conflict) => {
    const product = productsByCode.get(conflict.systemCode);
    const resolved = product.resolvedFields.includes(conflict.field);

    return {
      systemCode: conflict.systemCode,
      field: conflict.field,
      status: resolved ? CONFLICT_STATUSES.RESOLVED : CONFLICT_STATUSES.OPEN,
      chosenValue: resolved ? product[conflict.field] : null,
      variants: conflict.variants,
    };
  });
}

function countBySource(entries) {
  const counts = new Map();

  for (const entry of entries) {
    counts.set(entry.sourceId, (counts.get(entry.sourceId) ?? 0) + 1);
  }

  return counts;
}

function sourceWarnings(source, symbolCount) {
  if (source.status !== SOURCE_STATUSES.READ || symbolCount > 0) {
    return [];
  }

  const code = PROCESSING_WARNINGS.NO_SYMBOLS;

  return [{ code, message: PROCESSING_WARNING_MESSAGES[code] }];
}

/**
 * Secao Fotos: uma linha por fonte, na ordem recebida, com nome, origem,
 * situacao e frase, motivo da falha e frase (`null` na foto lida), simbolos
 * lidos, validos e rejeitados, e o aviso da foto lida sem simbolo.
 */
export function sourceRows(sources, readings, rejected) {
  const symbolCounts = countBySource(readings);
  const rejectedCounts = countBySource(rejected);

  return sources.map((source) => {
    const symbolCount = symbolCounts.get(source.id) ?? 0;
    const rejectedCount = rejectedCounts.get(source.id) ?? 0;
    const failureReason = source.status === SOURCE_STATUSES.FAILED ? source.failureReason : null;

    return {
      sourceId: source.id,
      fileName: source.fileName,
      origin: source.origin,
      status: source.status,
      statusMessage: SOURCE_STATUS_MESSAGES[source.status],
      failureReason,
      failureMessage: failureReason === null ? null : SOURCE_FAILURE_MESSAGES[failureReason],
      symbolCount,
      validCount: symbolCount - rejectedCount,
      rejectedCount,
      warnings: sourceWarnings(source, symbolCount),
    };
  });
}
