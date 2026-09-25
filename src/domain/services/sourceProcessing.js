/**
 * Processamento de uma foto, do arquivo ate a fonte gravada.
 *
 * A ordem e fixa: resumo SHA-256 dos bytes, recusa da foto ja gravada na
 * sessao, abertura da imagem, leitura dos simbolos, classificacao de cada texto
 * pelo contrato LF1 e gravacao da fonte com as leituras. A foto repetida para
 * antes de abrir a imagem, e a leitura dela nao roda.
 *
 * Aqui so ha orquestracao. Hash, abertura, leitura e gravacao chegam por
 * parametro, entao a mesma funcao roda com as implementacoes do navegador e com
 * substitutas na suite.
 *
 * Nenhum passo lanca para fora: o resultado de cada foto e um objeto simples
 * com a situacao final. A classificacao LF1 vai so no resultado; o banco guarda
 * o texto bruto, e tudo o que deriva dele e recalculado por quem le.
 */

import { SOURCE_FILE_NAME_MAX_LENGTH, SOURCE_STATUSES } from '../schemas/sourceSchema.js';

import { parseLf1 } from './lf1Contract.js';

export const PROCESSING_OUTCOMES = Object.freeze({
  READ: 'read',
  FAILED: 'failed',
  DUPLICATE: 'duplicate',
  ERROR: 'error',
});

/** Passo em que o processamento parou, para escolher a mensagem da falha. */
export const PROCESSING_STEPS = Object.freeze({
  HASH: 'hash',
  LOOKUP: 'lookup',
  LOAD: 'load',
  DECODE: 'decode',
  SAVE: 'save',
});

export const PROCESSING_WARNINGS = Object.freeze({
  NO_SYMBOLS: 'no-symbols',
});

export const PROCESSING_WARNING_MESSAGES = Object.freeze({
  [PROCESSING_WARNINGS.NO_SYMBOLS]: 'nenhum símbolo encontrado',
});

const UNNAMED_FILE = 'foto sem nome';

/** Nome gravavel: aparado, com um nome padrao quando vazio e no tamanho maximo. */
function fileNameOf(file) {
  const name = typeof file.name === 'string' ? file.name.trim() : '';

  return (name || UNNAMED_FILE).slice(0, SOURCE_FILE_NAME_MAX_LENGTH);
}

function metadataOf(file, sha256, origin) {
  return {
    fileName: fileNameOf(file),
    byteSize: file.size,
    lastModified: file.lastModified,
    sha256,
    origin,
  };
}

/** Quantos textos passam no contrato LF1 e quantos sao rejeitados. */
export function summarizeSymbols(symbols) {
  const validCount = symbols.filter((symbol) => parseLf1(symbol.text).ok).length;

  return {
    symbolCount: symbols.length,
    validCount,
    rejectedCount: symbols.length - validCount,
  };
}

function stepError(step, error) {
  return { status: PROCESSING_OUTCOMES.ERROR, step, error };
}

function duplicate(sha256, existingSourceId = null) {
  return { status: PROCESSING_OUTCOMES.DUPLICATE, sha256, existingSourceId };
}

async function save(deps, sessionId, source, readings, sha256) {
  try {
    return { stored: await deps.save(sessionId, source, readings) };
  } catch (error) {
    return {
      outcome: deps.isDuplicateError(error)
        ? duplicate(sha256)
        : stepError(PROCESSING_STEPS.SAVE, error),
    };
  }
}

async function saveFailed(deps, sessionId, metadata, failureReason) {
  const source = { ...metadata, status: SOURCE_STATUSES.FAILED, failureReason };
  const { stored, outcome } = await save(deps, sessionId, source, [], metadata.sha256);

  return outcome ?? { status: PROCESSING_OUTCOMES.FAILED, ...stored, failureReason };
}

async function saveRead(deps, sessionId, metadata, dimensions, symbols) {
  const source = { ...metadata, status: SOURCE_STATUSES.READ, ...dimensions };
  const { stored, outcome } = await save(deps, sessionId, source, symbols, metadata.sha256);

  if (outcome) {
    return outcome;
  }

  return {
    status: PROCESSING_OUTCOMES.READ,
    ...stored,
    summary: summarizeSymbols(symbols),
    warnings: symbols.length === 0 ? [PROCESSING_WARNINGS.NO_SYMBOLS] : [],
  };
}

/**
 * Processa uma foto na sessao. `photo` e `{ file, origin }`, com `origin`
 * `camera` ou `file`. `deps`:
 *
 * - `hash(file)`: SHA-256 dos bytes, em hexadecimal minusculo;
 * - `findDuplicate(sessionId, sha256)`: a fonte ja gravada, ou vazio;
 * - `loadImage(file)`: `{ data, width, height }` da foto;
 * - `decode(imageData)`: `[{ text, position? }]`;
 * - `failureReasonOf(error)`: motivo gravavel da foto que nao abriu, ou `null`;
 * - `save(sessionId, source, readings)`: grava tudo de uma vez e devolve
 *   `{ session, source, readings }`;
 * - `isDuplicateError(error)`: `true` para a recusa da mesma foto na sessao.
 *
 * Resultado, por `status`:
 *
 * - `read`: `session`, `source`, `readings`, `summary` e `warnings`;
 * - `failed`: `session`, `source`, `readings` vazio e `failureReason`;
 * - `duplicate`: `sha256` e `existingSourceId` (vazio se a recusa veio da
 *   gravacao);
 * - `error`: `step` e `error`, sem nada gravado; a foto pode ser tentada de novo.
 */
export async function processSource(photo, sessionId, deps) {
  const { file, origin } = photo;

  let sha256;

  try {
    sha256 = await deps.hash(file);
  } catch (error) {
    return stepError(PROCESSING_STEPS.HASH, error);
  }

  try {
    const existing = await deps.findDuplicate(sessionId, sha256);

    if (existing) {
      return duplicate(sha256, existing.id);
    }
  } catch (error) {
    return stepError(PROCESSING_STEPS.LOOKUP, error);
  }

  const metadata = metadataOf(file, sha256, origin);

  let imageData;

  try {
    imageData = await deps.loadImage(file);
  } catch (error) {
    const failureReason = deps.failureReasonOf(error);

    return failureReason
      ? saveFailed(deps, sessionId, metadata, failureReason)
      : stepError(PROCESSING_STEPS.LOAD, error);
  }

  // So as dimensoes seguem adiante; os pixels ficam com a leitura.
  const dimensions = { width: imageData.width, height: imageData.height };

  let symbols;

  try {
    symbols = await deps.decode(imageData);
  } catch (error) {
    return stepError(PROCESSING_STEPS.DECODE, error);
  }

  return saveRead(deps, sessionId, metadata, dimensions, symbols);
}
