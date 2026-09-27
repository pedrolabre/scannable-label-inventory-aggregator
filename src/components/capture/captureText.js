import { CAPTURE_ITEM_STATUS_LABELS } from '../../store/captureItem.js';

/**
 * Textos da fila de fotos: contagens no singular ou plural, tempos, tamanho da
 * imagem e a medicao em colunas para colar numa planilha. So formatacao; os
 * numeros chegam prontos do store e das leituras.
 */

const ORIGIN_LABELS = Object.freeze({ camera: 'câmera', file: 'arquivo' });

const INTEGER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const ONE_DECIMAL = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: false,
});

const BYTES_PER_MEGABYTE = 1024 * 1024;

/** `1 símbolo`, `2 símbolos`. */
export function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Milissegundos arredondados, com separador de milhar: `1.234 ms`. */
export function formatDuration(milliseconds) {
  return `${INTEGER.format(Math.round(milliseconds))} ms`;
}

/** Megapixels com uma casa: `12,2`. */
export function formatMegapixels(width, height) {
  return ONE_DECIMAL.format((width * height) / 1_000_000);
}

/** Megabytes com uma casa: `50,0`. */
export function formatMegabytes(bytes) {
  return ONE_DECIMAL.format(bytes / BYTES_PER_MEGABYTE);
}

/** Tempo da foto e dos passos que mais pesam, numa linha. */
export function describeMeasurement(measurement) {
  if (!measurement) {
    return null;
  }

  const parts = [];
  const { load, decode } = measurement.steps ?? {};

  if (Number.isFinite(load)) {
    parts.push(`abrir ${formatDuration(load)}`);
  }

  if (Number.isFinite(decode)) {
    parts.push(`ler ${formatDuration(decode)}`);
  }

  if (Number.isFinite(measurement.heapBytes)) {
    parts.push(`memória ${formatMegabytes(measurement.heapBytes)} MB`);
  }

  const total = `Tempo: ${formatDuration(measurement.durationMs)}`;

  return parts.length === 0 ? total : `${total} (${parts.join(', ')})`;
}

const pad = (value) => String(value).padStart(2, '0');

function formatDateTime(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Celula sem tabulacao nem quebra de linha, que abririam coluna ou linha nova. */
function cell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/[\t\r\n]+/g, ' ');
}

function roundedOrEmpty(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

export const MEASUREMENT_COLUMNS = Object.freeze([
  'Ordem',
  'Arquivo',
  'Origem',
  'Situação',
  'Largura',
  'Altura',
  'Megapixels',
  'Símbolos',
  'Válidos',
  'Rejeitados',
  'Com posição',
  'Abrir (ms)',
  'Ler (ms)',
  'Total (ms)',
  'Memória (MB)',
  'Frase',
]);

/**
 * Medicao do lote em colunas separadas por tabulacao, uma linha por foto, para
 * colar numa planilha. `positionCountOf(item)` da quantos simbolos da foto
 * vieram com a posicao na imagem, ou `null` quando a foto nao esta na sessao
 * aberta.
 */
export function formatMeasurement({ items, sources, positionCountOf, device, copiedAt }) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  const rows = items.map((item, index) => {
    const source = item.sourceId ? sourceById.get(item.sourceId) : undefined;
    const hasSize = Number.isFinite(source?.width) && Number.isFinite(source?.height);
    const { steps, durationMs, heapBytes } = item.measurement ?? {};

    return [
      index + 1,
      item.fileName,
      ORIGIN_LABELS[item.origin] ?? item.origin,
      CAPTURE_ITEM_STATUS_LABELS[item.status] ?? item.status,
      hasSize ? source.width : null,
      hasSize ? source.height : null,
      hasSize ? formatMegapixels(source.width, source.height) : null,
      item.summary?.symbolCount,
      item.summary?.validCount,
      item.summary?.rejectedCount,
      item.sourceId ? positionCountOf(item) : null,
      roundedOrEmpty(steps?.load),
      roundedOrEmpty(steps?.decode),
      roundedOrEmpty(durationMs),
      Number.isFinite(heapBytes) ? formatMegabytes(heapBytes) : null,
      item.message,
    ]
      .map(cell)
      .join('\t');
  });

  return [
    `Aparelho\t${cell(device)}`,
    `Copiado em\t${formatDateTime(copiedAt)}`,
    '',
    MEASUREMENT_COLUMNS.join('\t'),
    ...rows,
  ].join('\n');
}
