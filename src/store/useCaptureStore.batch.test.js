// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createCaptureStore } from './useCaptureStore.js';

const SESSION_ID = 'sessao-1';

function photoFile(index) {
  return { name: `foto-${index}.jpg`, size: 1000 + index, lastModified: 1 };
}

function readOutcome(photo, sessionId) {
  return {
    status: 'read',
    session: { id: sessionId },
    source: { id: `fonte-${photo.file.name}`, sessionId },
    readings: [],
    summary: { symbolCount: 0, validCount: 0, rejectedCount: 0 },
    warnings: [],
  };
}

function setup(overrides = {}) {
  return createCaptureStore({
    process: vi.fn(async (photo, sessionId) => readOutcome(photo, sessionId)),
    prepare: vi.fn(async () => {}),
    currentSessionId: vi.fn(() => SESSION_ID),
    onStored: vi.fn(async () => {}),
    yieldToEventLoop: vi.fn(async () => {}),
    ...overrides,
  });
}

describe('clearBatch', () => {
  it('esvazia a lista e o erro atual com a fila parada', async () => {
    const store = setup();

    await store.getState().enqueue([photoFile(1), photoFile(2)], 'file');
    store.setState({ currentError: 'erro antigo' });

    expect(store.getState().clearBatch()).toBe(true);
    expect(store.getState()).toMatchObject({ items: [], currentError: null, isRunning: false });
  });

  it('não mexe em nada durante uma execução', async () => {
    let finish;
    const store = setup({
      process: vi.fn(
        (photo, sessionId) =>
          new Promise((resolve) => {
            finish = () => resolve(readOutcome(photo, sessionId));
          }),
      ),
    });

    const running = store.getState().enqueue([photoFile(1)], 'camera');

    await vi.waitFor(() => expect(store.getState().isRunning).toBe(true));

    expect(store.getState().clearBatch()).toBe(false);
    expect(store.getState().items).toHaveLength(1);

    finish();
    await running;

    expect(store.getState().clearBatch()).toBe(true);
    expect(store.getState().items).toEqual([]);
  });
});
