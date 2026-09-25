import { create } from 'zustand';

import { SOURCE_ORIGINS } from '../domain/schemas/sourceSchema.js';
import { PROCESSING_OUTCOMES, processSource } from '../domain/services/sourceProcessing.js';
import { decodeImage, prepareDecoder } from '../lib/decoder.js';
import { sourceFailureReasonOf } from '../lib/decoderError.js';
import { loadImage } from '../lib/imageLoader.js';
import { sha256Hex } from '../lib/sha256.js';
import { getAppDatabase } from '../storage/indexed-db.js';
import { createSourceWithReadings, findSourceBySha256 } from '../storage/sourceRepository.js';
import { STORAGE_RULE_ERRORS, hasErrorName } from '../storage/storageError.js';

import {
  CAPTURE_ITEM_STATUSES,
  isQueueBlockingError,
  itemResultOf,
  newCaptureItem,
} from './captureItem.js';
import { useSessionStore } from './useSessionStore.js';

/**
 * Fila das fotos que entram na sessao, do envio ate a fonte gravada.
 *
 * A fila vive so na memoria da pagina: o que fica gravado sao as fontes e as
 * leituras, e o recarregamento comeca com a fila vazia. As fotos sao processadas
 * uma por vez, na ordem em que entraram, e o laco de eventos e cedido entre uma
 * e outra, para a tela responder durante um lote grande.
 *
 * Cada foto grava na sessao aberta na hora em que entrou na fila. A mesma foto
 * duas vezes termina recusada: a segunda so e consultada depois de a primeira
 * estar gravada.
 *
 * Uma falha que nao e do arquivo nao grava nada e deixa a foto na lista para
 * tentar de novo. O leitor que nao carrega pausa a fila, porque todas as fotos
 * seguintes falhariam do mesmo jeito.
 */

const NO_SESSION_MESSAGE =
  'Nenhuma sessão está aberta. Aguarde a abertura da sessão e envie as fotos de novo.';

const ORIGINS = new Set(Object.values(SOURCE_ORIGINS));

/** Devolve o controle ao navegador antes da proxima foto. */
export function yieldToEventLoop() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Implementacoes do navegador e do banco para `processSource`. */
export function createProcessingDeps(db) {
  return {
    hash: sha256Hex,
    findDuplicate: (sessionId, sha256) => findSourceBySha256(db, sessionId, sha256),
    loadImage,
    decode: decodeImage,
    failureReasonOf: sourceFailureReasonOf,
    save: (sessionId, source, readings) =>
      createSourceWithReadings(db, sessionId, source, readings),
    isDuplicateError: (error) => hasErrorName(error, STORAGE_RULE_ERRORS.DUPLICATE_SOURCE),
  };
}

/**
 * Cria a fila. `overrides` troca as ligacoes com o resto da aplicacao, o que a
 * suite usa para rodar a fila sem navegador:
 *
 * - `process(photo, sessionId)`: processa uma foto e devolve o resultado;
 * - `prepare()`: aquece o leitor quando um lote comeca;
 * - `currentSessionId()`: sessao aberta;
 * - `onStored(outcome)`: reflete a fonte gravada no estado das sessoes;
 * - `yieldToEventLoop()`: pausa entre uma foto e a seguinte.
 */
export function createCaptureStore(overrides = {}) {
  const deps = {
    process: (photo, sessionId) =>
      processSource(photo, sessionId, createProcessingDeps(getAppDatabase())),
    prepare: () => prepareDecoder(),
    currentSessionId: () => useSessionStore.getState().currentSessionId,
    onStored: (outcome) => useSessionStore.getState().addProcessedSource(outcome),
    yieldToEventLoop,
    ...overrides,
  };

  // Execucao da fila em andamento. Quem pede para processar durante uma
  // execucao recebe a mesma promessa, e nunca ha duas fotos ao mesmo tempo.
  let pendingRun = null;
  let lastItemId = 0;

  return create((set, get) => {
    function update(id, changes) {
      set({ items: get().items.map((item) => (item.id === id ? { ...item, ...changes } : item)) });
    }

    function nextPending() {
      return get().items.find((item) => item.status === CAPTURE_ITEM_STATUSES.PENDING);
    }

    /** Processa uma foto e devolve `true` quando a fila precisa parar. */
    async function processItem(item) {
      update(item.id, { status: CAPTURE_ITEM_STATUSES.PROCESSING, message: null });

      let outcome;

      try {
        outcome = await deps.process({ file: item.file, origin: item.origin }, item.sessionId);
      } catch (error) {
        outcome = { status: PROCESSING_OUTCOMES.ERROR, step: null, error };
      }

      const result = itemResultOf(outcome);
      const isError = result.status === CAPTURE_ITEM_STATUSES.ERROR;

      // O arquivo so continua em memoria enquanto a foto pode ser tentada de novo.
      update(item.id, isError ? result : { ...result, file: null });

      if (isError) {
        set({ currentError: result.message });

        return isQueueBlockingError(outcome.error);
      }

      if (outcome.source) {
        try {
          await deps.onStored(outcome);
        } catch {
          // A foto ja esta gravada; a tela se acerta na proxima leitura da sessao.
        }
      }

      return false;
    }

    async function drain() {
      set({ isRunning: true });

      try {
        let isFirst = true;

        while (nextPending()) {
          if (!isFirst) {
            await deps.yieldToEventLoop();
          }

          isFirst = false;

          const item = nextPending();

          if (!item || (await processItem(item))) {
            break;
          }
        }
      } finally {
        set({ isRunning: false });
      }
    }

    function run() {
      if (pendingRun === null) {
        // A execucao comeca na proxima microtarefa, com a promessa ja guardada:
        // uma foto posta na fila pelo proprio processamento entra nesta mesma
        // execucao, e nao abre outra em paralelo.
        const current = Promise.resolve().then(drain);
        const clear = () => {
          if (pendingRun === current) {
            pendingRun = null;
          }
        };

        pendingRun = current;
        current.then(clear, clear);
      }

      return pendingRun;
    }

    function warmUp() {
      try {
        Promise.resolve(deps.prepare()).catch(() => {});
      } catch {
        // A decodificacao tenta carregar o leitor de novo.
      }
    }

    return {
      items: [],
      isRunning: false,
      currentError: null,

      /**
       * Poe as fotos na fila, na ordem dada, com a origem `camera` ou `file`, e
       * devolve a execucao da fila. Com a fila parada e sem foto esperando, as
       * fotos formam um lote novo e a lista anterior sai.
       */
      enqueue: (files, origin) => {
        if (!ORIGINS.has(origin)) {
          throw new TypeError('A origem da foto deve ser camera ou file.');
        }

        const list = Array.from(files ?? []);

        if (list.length === 0) {
          return pendingRun ?? Promise.resolve();
        }

        const sessionId = deps.currentSessionId();

        if (!sessionId) {
          set({ currentError: NO_SESSION_MESSAGE });
          return pendingRun ?? Promise.resolve();
        }

        const startsBatch = pendingRun === null && !nextPending();
        const added = list.map((file) => {
          lastItemId += 1;
          return newCaptureItem(lastItemId, file, origin, sessionId);
        });

        set({ items: startsBatch ? added : [...get().items, ...added], currentError: null });

        if (startsBatch) {
          warmUp();
        }

        return run();
      },

      /** Devolve as fotos com erro para a fila e retoma. */
      retry: () => {
        if (!get().items.some((item) => item.status === CAPTURE_ITEM_STATUSES.ERROR)) {
          return pendingRun ?? Promise.resolve();
        }

        set({
          items: get().items.map((item) =>
            item.status === CAPTURE_ITEM_STATUSES.ERROR
              ? { ...item, status: CAPTURE_ITEM_STATUSES.PENDING, message: null }
              : item,
          ),
          currentError: null,
        });

        return run();
      },
    };
  });
}

export const useCaptureStore = createCaptureStore();
