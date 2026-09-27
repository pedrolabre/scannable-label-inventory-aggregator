/**
 * Relatorio de inventario de uma sessao, a fonte unica da tela e das
 * exportacoes.
 *
 * O relatorio e derivado das fontes, leituras e resolucoes da sessao e nunca e
 * gravado. A mesma entrada devolve sempre o mesmo objeto: as fontes e as
 * leituras sao postas numa ordem propria antes do calculo, e o instante da
 * geracao chega pronto por parametro, porque nada aqui le o relogio.
 *
 * Secoes: cabecalho, totais, resumo por produto, exemplares, rejeitados e
 * fotos, mais os conflitos com a situacao de cada um, as escolhas que deixaram
 * de valer e o indicador de exportacao.
 */

import { detectConflicts } from './conflictDetection.js';
import { applyResolutions, countConflicts } from './conflictResolution.js';
import { identifyCopies } from './copyIdentity.js';
import { summarizeProducts } from './inventoryAggregation.js';
import {
  conflictRows,
  copyRows,
  fileNameResolver,
  productRows,
  rejectedRows,
  sourceRows,
} from './reportSections.js';

/** Por que o valor total da sessao saiu sem valor. */
export const TOTAL_VALUE_ISSUES = Object.freeze({
  OPEN_PRICE_CONFLICT: 'open-price-conflict',
  OUT_OF_RANGE: 'out-of-range',
});

export const TOTAL_VALUE_ISSUE_MESSAGES = Object.freeze({
  [TOTAL_VALUE_ISSUES.OPEN_PRICE_CONFLICT]: 'há produto com preço em conflito aberto',
  [TOTAL_VALUE_ISSUES.OUT_OF_RANGE]: 'o valor passa do limite de cálculo',
});

/** O que impede a exportacao. */
export const EXPORT_BLOCKERS = Object.freeze({
  OPEN_CONFLICTS: 'open-conflicts',
});

function compareText(first, second) {
  if (first === second) {
    return 0;
  }

  return first < second ? -1 : 1;
}

/** Fontes pela ordem do processamento e, no mesmo instante, pelo identificador. */
function orderSources(sources) {
  return [...sources].sort(
    (first, second) =>
      compareText(first.processedAt, second.processedAt) || compareText(first.id, second.id),
  );
}

/**
 * Leituras pela ordem das fontes, depois pela data da leitura e pelo
 * identificador: a ordem em que o banco as devolve ao reabrir a sessao. Leitura
 * de foto desconhecida vai para o fim, pelo identificador da foto.
 */
function orderReadings(readings, orderedSources) {
  const rankOf = new Map(orderedSources.map((source, index) => [source.id, index]));
  const rank = (reading) => rankOf.get(reading.sourceId) ?? orderedSources.length;

  return [...readings].sort(
    (first, second) =>
      rank(first) - rank(second) ||
      compareText(first.sourceId, second.sourceId) ||
      compareText(first.readAt, second.readAt) ||
      compareText(first.id, second.id),
  );
}

function withoutValue(code) {
  return {
    totalValueInCentavos: null,
    totalValueIssue: { code, message: TOTAL_VALUE_ISSUE_MESSAGES[code] },
  };
}

/**
 * Soma dos totais dos produtos, em centavos inteiros. Sai `null` com o motivo
 * quando algum produto tem o preco em conflito aberto, ou quando algum total
 * ou a soma passa do inteiro seguro.
 */
export function totalValueOf(products) {
  if (products.some((product) => product.openConflictFields.includes('priceInCentavos'))) {
    return withoutValue(TOTAL_VALUE_ISSUES.OPEN_PRICE_CONFLICT);
  }

  let sum = 0;

  for (const product of products) {
    if (product.totalOutOfRange) {
      return withoutValue(TOTAL_VALUE_ISSUES.OUT_OF_RANGE);
    }

    // Parcela e soma parcial sao inteiros seguros: a soma exata passa do
    // limite se, e somente se, a soma calculada tambem passa.
    sum += product.totalInCentavos;

    if (!Number.isSafeInteger(sum)) {
      return withoutValue(TOTAL_VALUE_ISSUES.OUT_OF_RANGE);
    }
  }

  return { totalValueInCentavos: sum, totalValueIssue: null };
}

function openConflictsMessage(count) {
  return count === 1
    ? 'exportação bloqueada: 1 conflito aberto'
    : `exportação bloqueada: ${count} conflitos abertos`;
}

/** Bloqueios da exportacao: hoje, so conflito aberto, com a contagem. */
export function exportBlockersOf(openConflictCount) {
  if (openConflictCount === 0) {
    return [];
  }

  return [
    {
      code: EXPORT_BLOCKERS.OPEN_CONFLICTS,
      count: openConflictCount,
      message: openConflictsMessage(openConflictCount),
    },
  ];
}

/**
 * Monta o relatorio de uma sessao. Recebe:
 *
 * - `session`: o registro da sessao (usa `id` e `name`);
 * - `sources`, `readings`, `resolutions`: o conteudo da sessao, em qualquer ordem;
 * - `generatedAt`: o instante da geracao em ISO 8601, repassado como veio.
 *
 * Devolve `{ header, totals, products, copies, rejected, sources, conflicts,
 * ignoredChoices, exportable, exportBlockers }`.
 */
export function buildInventoryReport({ session, sources, readings, resolutions, generatedAt }) {
  const orderedSources = orderSources(sources);
  const orderedReadings = orderReadings(readings, orderedSources);
  const fileNameOf = fileNameResolver(orderedSources);

  const { copies, rejected } = identifyCopies(orderedReadings);
  const conflicts = detectConflicts(copies);
  const { products, ignoredChoices } = applyResolutions(
    summarizeProducts(copies),
    conflicts,
    resolutions,
  );
  const conflictCounts = countConflicts(products);
  const sourceSection = sourceRows(orderedSources, orderedReadings, rejected);
  const exportBlockers = exportBlockersOf(conflictCounts.open);

  return {
    header: {
      sessionId: session.id,
      sessionName: session.name,
      generatedAt,
      sourceCount: sourceSection.length,
      failedSourceCount: sourceSection.filter((row) => row.failureReason !== null).length,
    },
    totals: {
      copyCount: copies.length,
      productCount: products.length,
      ...totalValueOf(products),
      rejectedCount: rejected.length,
      warningCount: copies.reduce((count, copy) => count + copy.warnings.length, 0),
      resolvedConflictCount: conflictCounts.resolved,
      openConflictCount: conflictCounts.open,
    },
    products: productRows(products, copies),
    copies: copyRows(copies, fileNameOf),
    rejected: rejectedRows(rejected, fileNameOf),
    sources: sourceSection,
    conflicts: conflictRows(conflicts, products),
    ignoredChoices,
    exportable: exportBlockers.length === 0,
    exportBlockers,
  };
}
