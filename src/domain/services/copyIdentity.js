/**
 * Exemplares de uma sessao, derivados das leituras gravadas.
 *
 * A chave do exemplar e o texto LF1 inteiro: leituras com o mesmo texto sao o
 * mesmo exemplar e contam uma vez, com o numero de leituras e as fotos em que
 * apareceu. Texto recusado pelo contrato fica fora da contagem, numa lista
 * propria com o motivo, uma linha por leitura.
 *
 * O mesmo texto em posicoes distintas da mesma foto sao duas etiquetas fisicas,
 * como numa reimpressao. A contagem continua 1, e o exemplar recebe um aviso por
 * foto em que isso aconteceu. A sobreposicao das caixas so decide o aviso;
 * nenhuma leitura e descartada por ela.
 *
 * Nada daqui e gravado: o resultado e recalculado das leituras sempre que
 * alguem precisa dele.
 */

import { intersectionOverUnion, positionArea } from './boxOverlap.js';
import { parseLf1 } from './lf1Contract.js';

/** Caixas com IoU a partir deste valor sao a mesma posicao na foto. */
export const REPRINT_OVERLAP_THRESHOLD = 0.5;

export const COPY_WARNINGS = Object.freeze({
  PROBABLE_REPRINT: 'probable-reprint',
});

export const COPY_WARNING_MESSAGES = Object.freeze({
  [COPY_WARNINGS.PROBABLE_REPRINT]: 'provável reimpressão',
});

const CODE_COLLATOR = new Intl.Collator('pt-BR', { numeric: true });

function compareText(first, second) {
  if (first === second) {
    return 0;
  }

  return first < second ? -1 : 1;
}

/**
 * Ordem dos codigos do sistema: trechos numericos comparados como numero
 * (`2` antes de `10`) e, no empate da comparacao por idioma, a ordem exata dos
 * caracteres, para a saida nunca depender da ordem de entrada.
 */
export function compareSystemCodes(first, second) {
  return CODE_COLLATOR.compare(first, second) || compareText(first, second);
}

/** `c2` antes de `c10`, por comprimento dos digitos e depois pelos digitos. */
function compareCopyNumbers(first, second) {
  const firstDigits = first.slice(1);
  const secondDigits = second.slice(1);

  return firstDigits.length - secondDigits.length || compareText(firstDigits, secondDigits);
}

/**
 * Ordem dos exemplares: codigo do sistema, numero do exemplar e, para o mesmo
 * `cN` com dados diferentes, o texto inteiro.
 */
export function compareCopies(first, second) {
  return (
    compareSystemCodes(first.fields.systemCode, second.fields.systemCode) ||
    compareCopyNumbers(first.fields.copy, second.fields.copy) ||
    compareText(first.text, second.text)
  );
}

/** Caixa com area: leitura sem posicao, ou com os cantos colapsados, nao conta. */
function hasUsablePosition(reading) {
  return (
    reading.position !== undefined &&
    reading.position !== null &&
    positionArea(reading.position) > 0
  );
}

/**
 * Quantas posicoes distintas ha entre as caixas de uma mesma foto. Cada caixa,
 * na ordem da leitura, entra na primeira posicao ja vista com que se sobrepoe
 * (IoU a partir do limite) ou abre uma posicao nova.
 */
export function countDistinctPositions(positions) {
  const representatives = [];

  for (const position of positions) {
    const known = representatives.some(
      (representative) =>
        intersectionOverUnion(representative, position) >= REPRINT_OVERLAP_THRESHOLD,
    );

    if (!known) {
      representatives.push(position);
    }
  }

  return representatives.length;
}

function reprintWarning(sourceId, positionCount) {
  const code = COPY_WARNINGS.PROBABLE_REPRINT;

  return {
    code,
    sourceId,
    positionCount,
    message: `mesmo texto em ${positionCount} posições da mesma foto: ${COPY_WARNING_MESSAGES[code]}`,
  };
}

function sourceIdsOf(readings) {
  return [...new Set(readings.map((reading) => reading.sourceId))];
}

/** Um aviso por foto em que o texto aparece em duas posicoes ou mais. */
function reprintWarnings(readings, sourceIds) {
  const warnings = [];

  for (const sourceId of sourceIds) {
    const positions = readings
      .filter((reading) => reading.sourceId === sourceId && hasUsablePosition(reading))
      .map((reading) => reading.position);
    const positionCount = countDistinctPositions(positions);

    if (positionCount >= 2) {
      warnings.push(reprintWarning(sourceId, positionCount));
    }
  }

  return warnings;
}

function copyOf({ text, fields, readings }) {
  const sourceIds = sourceIdsOf(readings);

  return {
    text,
    fields,
    readingCount: readings.length,
    sourceIds,
    warnings: reprintWarnings(readings, sourceIds),
  };
}

function rejectedOf(reading, parsed) {
  const entry = {
    readingId: reading.id,
    sourceId: reading.sourceId,
    text: reading.text,
    reason: parsed.reason,
    message: parsed.message,
  };

  return parsed.field === undefined ? entry : { ...entry, field: parsed.field };
}

/**
 * Agrupa as leituras de uma sessao em exemplares. Devolve:
 *
 * - `copies`: `[{ text, fields, readingCount, sourceIds, warnings }]`, na ordem
 *   de `compareCopies`, com as fotos na ordem da primeira leitura e
 *   `warnings` como `[{ code, sourceId, positionCount, message }]`;
 * - `rejected`: `[{ readingId, sourceId, text, reason, message, field? }]`, uma
 *   linha por leitura recusada, na ordem das leituras.
 */
export function identifyCopies(readings) {
  const parsedByText = new Map();
  const groups = new Map();
  const rejected = [];

  for (const reading of readings) {
    if (!parsedByText.has(reading.text)) {
      parsedByText.set(reading.text, parseLf1(reading.text));
    }

    const parsed = parsedByText.get(reading.text);

    if (!parsed.ok) {
      rejected.push(rejectedOf(reading, parsed));
      continue;
    }

    if (!groups.has(reading.text)) {
      groups.set(reading.text, { text: reading.text, fields: parsed.fields, readings: [] });
    }

    groups.get(reading.text).readings.push(reading);
  }

  const copies = [...groups.values()].map(copyOf).sort(compareCopies);

  return { copies, rejected };
}
