// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createCaptureStore } from './useCaptureStore.js';

function photoFile(index) {
  return { name: `foto-${index}.jpg`, size: 1000 + index, lastModified: 1 };
}

function readOutcome(photo, sessionId, timings) {
  return {
    status: 'read',
    session: { id: sessionId },
    source: { id: `fonte-${photo.file.name}`, sessionId, width: 4, height: 3 },
    readings: [],
    summary: { symbolCount: 0, validCount: 0, rejectedCount: 0 },
    warnings: ['no-symbols'],
    timings,
  };
}

function setup(overrides = {}) {
  const instants = [100, 350, 1000, 1080];
  const deps = {
    process: vi.fn(async (photo, sessionId) =>
      readOutcome(photo, sessionId, { hash: 4, lookup: 1, load: 90, decode: 140, save: 6 }),
    ),
    prepare: vi.fn(async () => {}),
    currentSessionId: () => 'sessao-1',
    onStored: vi.fn(async () => {}),
    yieldToEventLoop: vi.fn(async () => {}),
    now: vi.fn(() => instants.shift()),
    readHeap: vi.fn(() => 52_428_800),
    ...overrides,
  };

  return { deps, store: createCaptureStore(deps) };
}

describe('medição de cada foto', () => {
  it('guarda no item o tempo da foto inteira, de cada passo e a memória ao fim', async () => {
    const { store } = setup();

    await store.getState().enqueue([photoFile(1), photoFile(2)], 'camera');

    expect(store.getState().items.map((item) => item.measurement)).toEqual([
      {
        durationMs: 250,
        steps: { hash: 4, lookup: 1, load: 90, decode: 140, save: 6 },
        heapBytes: 52_428_800,
      },
      {
        durationMs: 80,
        steps: { hash: 4, lookup: 1, load: 90, decode: 140, save: 6 },
        heapBytes: 52_428_800,
      },
    ]);
  });

  it('mede também a foto com erro, sem passos quando o processamento lançou', async () => {
    const { store } = setup({
      process: vi.fn(async () => {
        throw new Error('inesperado');
      }),
      readHeap: () => null,
    });

    await store.getState().enqueue([photoFile(1)], 'file');

    const [item] = store.getState().items;

    expect(item.status).toBe('error');
    expect(item.measurement).toEqual({ durationMs: 250, steps: null, heapBytes: null });
  });

  it('começa a foto sem medição e a mantém vazia enquanto espera', async () => {
    let release;
    const { store } = setup({
      process: vi.fn(
        (photo, sessionId) =>
          new Promise((resolve) => {
            release = () => resolve(readOutcome(photo, sessionId, {}));
          }),
      ),
    });

    const run = store.getState().enqueue([photoFile(1), photoFile(2)], 'file');

    await new Promise((resolve) => setImmediate(resolve));

    expect(store.getState().items.map((item) => [item.status, item.measurement])).toEqual([
      ['processing', null],
      ['pending', null],
    ]);

    release();
    await new Promise((resolve) => setImmediate(resolve));
    release();
    await run;

    expect(store.getState().items.every((item) => item.measurement !== null)).toBe(true);
  });
});
