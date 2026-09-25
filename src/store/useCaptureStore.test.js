// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DECODER_ERROR_CODES, DecoderError } from '../lib/decoderError.js';

import { formatProgress, selectProgress } from './captureItem.js';
import { createCaptureStore, yieldToEventLoop } from './useCaptureStore.js';

const SESSION_ID = 'sessao-1';

function photoFile(index) {
  return { name: `foto-${index}.jpg`, size: 1000 + index, lastModified: 1 };
}

function files(count) {
  return Array.from({ length: count }, (_, index) => photoFile(index + 1));
}

function readOutcome(photo, sessionId) {
  return {
    status: 'read',
    session: { id: sessionId },
    source: { id: `fonte-${photo.file.name}`, sessionId },
    readings: [],
    summary: { symbolCount: 0, validCount: 0, rejectedCount: 0 },
    warnings: ['no-symbols'],
  };
}

/** Fila com dependencias falsas; `process` recebe a foto e a sessao. */
function setup(overrides = {}) {
  const deps = {
    process: vi.fn(async (photo, sessionId) => readOutcome(photo, sessionId)),
    prepare: vi.fn(async () => {}),
    currentSessionId: vi.fn(() => SESSION_ID),
    onStored: vi.fn(async () => {}),
    yieldToEventLoop: vi.fn(async () => {}),
    ...overrides,
  };

  return { deps, store: createCaptureStore(deps) };
}

const progressOf = (store) => formatProgress(selectProgress(store.getState()));

const statuses = (store) => store.getState().items.map((item) => item.status);

// Esvazia as microtarefas sem depender de timer, que alguns testes simulam.
const flush = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  vi.useRealTimers();
});

describe('fila', () => {
  it('processa 10 fotos em ordem, com o andamento de cada passo', async () => {
    const seen = [];
    const { deps, store } = setup();

    deps.process.mockImplementation(async (photo, sessionId) => {
      seen.push([photo.file.name, progressOf(store)]);
      return readOutcome(photo, sessionId);
    });

    await store.getState().enqueue(files(10), 'file');

    expect(seen).toEqual(
      Array.from({ length: 10 }, (_, index) => [
        `foto-${index + 1}.jpg`,
        `Foto ${index + 1} de 10`,
      ]),
    );
    expect(statuses(store)).toEqual(Array(10).fill('read'));
    expect(progressOf(store)).toBe('Foto 10 de 10');
    expect(store.getState().isRunning).toBe(false);
  });

  it('cede o laço de eventos entre uma foto e a seguinte', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const { store, deps } = setup({ yieldToEventLoop: vi.fn(yieldToEventLoop) });
    const running = store.getState().enqueue(files(3), 'camera');

    // Cada foto seguinte so comeca depois que o timer de cessao dispara.
    for (const processed of [1, 2]) {
      await flush();
      expect(deps.process).toHaveBeenCalledTimes(processed);
      expect(vi.getTimerCount()).toBe(1);
      await vi.runOnlyPendingTimersAsync();
    }

    await running;

    expect(deps.process).toHaveBeenCalledTimes(3);
    expect(deps.yieldToEventLoop).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('nunca processa duas fotos ao mesmo tempo', async () => {
    let active = 0;
    let maxActive = 0;
    const { deps, store } = setup();

    deps.process.mockImplementation(async (photo, sessionId) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return readOutcome(photo, sessionId);
    });

    const first = store.getState().enqueue(files(5), 'file');
    const second = store.getState().enqueue([photoFile(6), photoFile(7)], 'camera');

    expect(second).toBe(first);
    await first;

    expect(maxActive).toBe(1);
    expect(deps.process).toHaveBeenCalledTimes(7);
  });

  it('soma ao lote a foto que entra com a fila andando, na mesma execução', async () => {
    const seen = [];
    let active = 0;
    let maxActive = 0;
    const { deps, store } = setup();

    deps.process.mockImplementation(async (photo, sessionId) => {
      active += 1;
      maxActive = Math.max(maxActive, active);

      if (photo.file.name === 'foto-1.jpg') {
        store.getState().enqueue([photoFile(4)], 'camera');
      }

      seen.push(progressOf(store));
      await flush();
      active -= 1;
      return readOutcome(photo, sessionId);
    });

    await store.getState().enqueue(files(3), 'file');

    expect(seen).toEqual(['Foto 1 de 4', 'Foto 2 de 4', 'Foto 3 de 4', 'Foto 4 de 4']);
    expect(maxActive).toBe(1);
    expect(store.getState().items.map((item) => item.origin)).toEqual([
      'file',
      'file',
      'file',
      'camera',
    ]);
  });

  it('começa um lote novo quando a fila está parada', async () => {
    const { store, deps } = setup();

    await store.getState().enqueue(files(3), 'file');
    await store.getState().enqueue([photoFile(9)], 'camera');

    expect(store.getState().items.map((item) => item.fileName)).toEqual(['foto-9.jpg']);
    expect(progressOf(store)).toBe('Foto 1 de 1');
    expect(deps.prepare).toHaveBeenCalledTimes(2);
  });

  it('aquece o leitor uma vez quando o lote começa, sem esperar por ele', async () => {
    const { store, deps } = setup({ prepare: vi.fn(() => Promise.reject(new Error('offline'))) });

    await store.getState().enqueue(files(2), 'file');

    expect(deps.prepare).toHaveBeenCalledTimes(1);
    expect(statuses(store)).toEqual(['read', 'read']);
  });

  it('grava na sessão aberta na hora em que a foto entrou', async () => {
    const { store, deps } = setup();

    deps.process.mockImplementation(async (photo, sessionId) => {
      if (photo.file.name === 'foto-1.jpg') {
        deps.currentSessionId.mockReturnValue('sessao-2');
        store.getState().enqueue([photoFile(3)], 'file');
      }

      return readOutcome(photo, sessionId);
    });

    await store.getState().enqueue(files(2), 'file');

    expect(deps.process.mock.calls.map(([, sessionId]) => sessionId)).toEqual([
      SESSION_ID,
      SESSION_ID,
      'sessao-2',
    ]);
  });

  it('recusa entrada sem sessão aberta, com a frase em português', async () => {
    const { store, deps } = setup({ currentSessionId: () => null });

    await store.getState().enqueue(files(2), 'file');

    expect(store.getState().items).toEqual([]);
    expect(store.getState().currentError).toBe(
      'Nenhuma sessão está aberta. Aguarde a abertura da sessão e envie as fotos de novo.',
    );
    expect(deps.process).not.toHaveBeenCalled();
  });

  it('recusa origem fora de camera e file', () => {
    const { store } = setup();

    expect(() => store.getState().enqueue(files(1), 'galeria')).toThrow(TypeError);
  });

  it('não faz nada com lista vazia', async () => {
    const { store, deps } = setup();

    await store.getState().enqueue([], 'file');

    expect(store.getState().items).toEqual([]);
    expect(deps.prepare).not.toHaveBeenCalled();
  });
});

describe('resultado de cada foto', () => {
  it('reflete a foto lida e a que falhou, e só elas, nas sessões', async () => {
    const outcomes = [
      (photo, sessionId) => readOutcome(photo, sessionId),
      (photo, sessionId) => ({
        status: 'failed',
        session: { id: sessionId },
        source: { id: 'fonte-falhou', sessionId },
        readings: [],
        failureReason: 'unsupported-format',
      }),
      () => ({ status: 'duplicate', sha256: 'ab'.repeat(32), existingSourceId: 'x' }),
      () => ({
        status: 'error',
        step: 'decode',
        error: new DecoderError(DECODER_ERROR_CODES.READ_FAILED),
      }),
    ];
    const { store, deps } = setup();

    deps.process.mockImplementation(async (photo, sessionId) =>
      outcomes[deps.process.mock.calls.length - 1](photo, sessionId),
    );

    await store.getState().enqueue(files(4), 'file');

    const items = store.getState().items;

    expect(items.map((item) => [item.status, item.message])).toEqual([
      ['read', 'nenhum símbolo encontrado'],
      ['failed', 'formato de imagem não suportado'],
      ['duplicate', 'Esta foto já foi lida nesta sessão. Escolha outra foto ou abra outra sessão.'],
      [
        'error',
        'Não foi possível ler esta foto. Feche outras abas para liberar memória e tente de novo.',
      ],
    ]);
    expect(items[0]).toMatchObject({ sourceId: 'fonte-foto-1.jpg', warnings: ['no-symbols'] });
    expect(items[1]).toMatchObject({
      sourceId: 'fonte-falhou',
      failureReason: 'unsupported-format',
    });
    expect(deps.onStored.mock.calls.map(([outcome]) => outcome.status)).toEqual(['read', 'failed']);
  });

  it('solta o arquivo da memória quando a foto termina, salvo com erro', async () => {
    const { store, deps } = setup();

    deps.process.mockImplementationOnce(async () => ({
      status: 'error',
      step: 'save',
      error: new Error('cota'),
    }));

    await store.getState().enqueue(files(2), 'file');

    expect(store.getState().items.map((item) => item.file?.name ?? null)).toEqual([
      'foto-1.jpg',
      null,
    ]);
  });

  it('segue a fila depois de uma foto com erro', async () => {
    const { store, deps } = setup();

    deps.process.mockImplementationOnce(async (photo, sessionId) => readOutcome(photo, sessionId));
    deps.process.mockImplementationOnce(async () => {
      throw new Error('inesperado');
    });

    await store.getState().enqueue(files(4), 'file');

    expect(statuses(store)).toEqual(['read', 'error', 'read', 'read']);
    expect(store.getState().currentError).toBe('A leitura desta foto falhou. Tente de novo.');
  });

  it('segue a fila quando refletir a foto nas sessões falha', async () => {
    const { store } = setup({ onStored: vi.fn(async () => Promise.reject(new Error('x'))) });

    await store.getState().enqueue(files(2), 'file');

    expect(statuses(store)).toEqual(['read', 'read']);
  });
});

describe('leitor que não carrega', () => {
  const engineFailure = () => ({
    status: 'error',
    step: 'decode',
    error: new DecoderError(DECODER_ERROR_CODES.ENGINE_UNAVAILABLE),
  });

  it('pausa a fila com o motivo e retoma com retry', async () => {
    const { store, deps } = setup();

    deps.process.mockImplementationOnce(async (photo, sessionId) => readOutcome(photo, sessionId));
    deps.process.mockImplementationOnce(async () => engineFailure());

    await store.getState().enqueue(files(4), 'file');

    expect(statuses(store)).toEqual(['read', 'error', 'pending', 'pending']);
    expect(store.getState()).toMatchObject({
      isRunning: false,
      currentError:
        'Não foi possível carregar o leitor de QR Code. Confira a conexão, recarregue a página e tente de novo.',
    });
    expect(progressOf(store)).toBe('Foto 3 de 4');

    await store.getState().retry();

    expect(statuses(store)).toEqual(['read', 'read', 'read', 'read']);
    expect(store.getState().currentError).toBeNull();
    expect(deps.process.mock.calls.map(([photo]) => photo.file.name)).toEqual([
      'foto-1.jpg',
      'foto-2.jpg',
      'foto-2.jpg',
      'foto-3.jpg',
      'foto-4.jpg',
    ]);
  });

  it('retoma a fila pausada quando entra foto nova, sem repetir a que deu erro', async () => {
    const { store, deps } = setup();

    deps.process.mockImplementationOnce(async () => engineFailure());

    await store.getState().enqueue(files(2), 'file');
    await store.getState().enqueue([photoFile(3)], 'camera');

    expect(statuses(store)).toEqual(['error', 'read', 'read']);
  });

  it('retry sem foto com erro não faz nada', async () => {
    const { store, deps } = setup();

    await store.getState().retry();

    expect(deps.process).not.toHaveBeenCalled();
  });
});
