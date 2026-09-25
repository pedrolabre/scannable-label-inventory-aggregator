import { SOURCE_FAILURE_MESSAGES } from '../domain/schemas/sourceSchema.js';
import {
  PROCESSING_OUTCOMES,
  PROCESSING_STEPS,
  PROCESSING_WARNING_MESSAGES,
} from '../domain/services/sourceProcessing.js';
import { DECODER_ERROR_CODES, DecoderError, describeDecoderError } from '../lib/decoderError.js';
import {
  STORAGE_RULE_ERRORS,
  describeStorageError,
  describeStorageReadError,
} from '../storage/storageError.js';

/**
 * Uma foto na fila: a situacao dela, a frase de cada situacao e de cada falha,
 * e o andamento do lote. Tudo aqui vive so na memoria da pagina.
 *
 * A situacao e o codigo estavel, em ASCII; a frase em portugues fica a parte,
 * como nos motivos gravados na fonte.
 */

export const CAPTURE_ITEM_STATUSES = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  READ: 'read',
  FAILED: 'failed',
  DUPLICATE: 'duplicate',
  ERROR: 'error',
});

export const CAPTURE_ITEM_STATUS_LABELS = Object.freeze({
  [CAPTURE_ITEM_STATUSES.PENDING]: 'na fila',
  [CAPTURE_ITEM_STATUSES.PROCESSING]: 'processando',
  [CAPTURE_ITEM_STATUSES.READ]: 'lida',
  [CAPTURE_ITEM_STATUSES.FAILED]: 'falhou',
  [CAPTURE_ITEM_STATUSES.DUPLICATE]: 'recusada: foto repetida',
  [CAPTURE_ITEM_STATUSES.ERROR]: 'erro',
});

const FILE_READ_MESSAGE = 'Não foi possível ler o arquivo desta foto. Envie a foto de novo.';

/**
 * Frase da falha que nao gravou nada, pelo passo em que ela aconteceu. O erro
 * do resumo fora de pagina segura ja vem em portugues; o do navegador ao ler o
 * arquivo, nao.
 */
export function describeProcessingError(step, error) {
  if (error instanceof DecoderError) {
    return describeDecoderError(error);
  }

  switch (step) {
    case PROCESSING_STEPS.HASH:
      return error?.name === 'Error' && error.message ? error.message : FILE_READ_MESSAGE;
    case PROCESSING_STEPS.LOOKUP:
      return describeStorageReadError(error);
    case PROCESSING_STEPS.SAVE:
      return describeStorageError(error);
    default:
      return describeDecoderError(error);
  }
}

/** `true` quando a falha se repetiria em todas as fotos seguintes. */
export function isQueueBlockingError(error) {
  return error instanceof DecoderError && error.code === DECODER_ERROR_CODES.ENGINE_UNAVAILABLE;
}

/**
 * Posicao no lote: a foto em processamento; sem nenhuma, a proxima da fila
 * (inclusive com a fila pausada); com todas terminadas, a ultima.
 */
export function selectProgress(state) {
  const total = state.items.length;
  const current = state.items.findIndex((item) => item.status === CAPTURE_ITEM_STATUSES.PROCESSING);
  const next = state.items.findIndex((item) => item.status === CAPTURE_ITEM_STATUSES.PENDING);

  if (current >= 0) {
    return { position: current + 1, total };
  }

  return { position: next >= 0 ? next + 1 : total, total };
}

/** Andamento escrito: `Foto 3 de 12`. Vazio sem nenhuma foto no lote. */
export function formatProgress({ position, total }) {
  return total === 0 ? '' : `Foto ${position} de ${total}`;
}

/** Situacao e frase da foto a partir do resultado do processamento. */
export function itemResultOf(outcome) {
  switch (outcome.status) {
    case PROCESSING_OUTCOMES.READ:
      return {
        status: CAPTURE_ITEM_STATUSES.READ,
        sourceId: outcome.source.id,
        summary: outcome.summary,
        warnings: outcome.warnings,
        message:
          outcome.warnings.map((warning) => PROCESSING_WARNING_MESSAGES[warning]).join('; ') ||
          null,
      };
    case PROCESSING_OUTCOMES.FAILED:
      return {
        status: CAPTURE_ITEM_STATUSES.FAILED,
        sourceId: outcome.source.id,
        failureReason: outcome.failureReason,
        message: SOURCE_FAILURE_MESSAGES[outcome.failureReason],
      };
    case PROCESSING_OUTCOMES.DUPLICATE:
      return {
        status: CAPTURE_ITEM_STATUSES.DUPLICATE,
        message: describeStorageError({ name: STORAGE_RULE_ERRORS.DUPLICATE_SOURCE }),
      };
    default:
      return {
        status: CAPTURE_ITEM_STATUSES.ERROR,
        message: describeProcessingError(outcome.step, outcome.error),
      };
  }
}

/** Foto recem-posta na fila, esperando a vez. */
export function newCaptureItem(id, file, origin, sessionId) {
  return {
    id,
    file,
    fileName: typeof file?.name === 'string' ? file.name : '',
    byteSize: file?.size ?? 0,
    origin,
    sessionId,
    status: CAPTURE_ITEM_STATUSES.PENDING,
    message: null,
    sourceId: null,
    summary: null,
    warnings: [],
    failureReason: null,
  };
}
