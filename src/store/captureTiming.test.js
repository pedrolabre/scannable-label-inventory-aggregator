// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { readUsedHeapBytes, timeProcessingDeps } from './captureTiming.js';

function clock(...instants) {
  const queue = [...instants];

  return () => queue.shift();
}

describe('timeProcessingDeps', () => {
  it('mede cada passo e repassa argumentos e resultado', async () => {
    const deps = {
      hash: vi.fn(async () => 'abc'),
      findDuplicate: vi.fn(async () => null),
      loadImage: vi.fn(async () => ({ width: 2, height: 2 })),
      decode: vi.fn(async () => [{ text: 'x' }]),
      save: vi.fn(async () => ({ ok: true })),
      failureReasonOf: vi.fn(() => null),
      isDuplicateError: vi.fn(() => false),
    };
    const { deps: timed, timings } = timeProcessingDeps(
      deps,
      clock(0, 5, 5, 6, 6, 106, 106, 406, 406, 416),
    );

    expect(await timed.hash('arquivo')).toBe('abc');
    expect(await timed.findDuplicate('sessao', 'abc')).toBeNull();
    expect(await timed.loadImage('arquivo')).toEqual({ width: 2, height: 2 });
    expect(await timed.decode('pixels')).toEqual([{ text: 'x' }]);
    expect(await timed.save('sessao', 'fonte', [])).toEqual({ ok: true });

    expect(deps.hash).toHaveBeenCalledWith('arquivo');
    expect(deps.findDuplicate).toHaveBeenCalledWith('sessao', 'abc');
    expect(deps.save).toHaveBeenCalledWith('sessao', 'fonte', []);
    expect(timings).toEqual({ hash: 5, lookup: 1, load: 100, decode: 300, save: 10 });
    expect(timed.failureReasonOf).toBe(deps.failureReasonOf);
    expect(timed.isDuplicateError).toBe(deps.isDuplicateError);
  });

  it('registra o tempo do passo que falhou e deixa o erro subir', async () => {
    const failure = new Error('leitura');
    const { deps: timed, timings } = timeProcessingDeps(
      { decode: async () => Promise.reject(failure) },
      clock(10, 35),
    );

    await expect(timed.decode('pixels')).rejects.toBe(failure);
    expect(timings).toEqual({ decode: 25 });
  });
});

describe('readUsedHeapBytes', () => {
  it('lê a memória quando o navegador informa, e nada quando não informa', () => {
    expect(readUsedHeapBytes({ memory: { usedJSHeapSize: 1234 } })).toBe(1234);
    expect(readUsedHeapBytes({})).toBeNull();
    expect(readUsedHeapBytes(undefined)).toBeNull();
  });
});
