// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  PROCESSING_STEPS,
  PROCESSING_WARNING_MESSAGES,
  processSource,
  summarizeSymbols,
} from './sourceProcessing.js';

const SESSION_ID = 'sessao-1';
const SHA = 'ab'.repeat(32);
const VALID = 'LF1|DEMO-1|CAFÉ TESTE|1990|||c1';
const OTHER_VALID = 'LF1|DEMO-2|CHÁ TESTE|850|||c1';
const POSITION = {
  topLeft: { x: 1, y: 2 },
  topRight: { x: 30, y: 2 },
  bottomRight: { x: 30, y: 31 },
  bottomLeft: { x: 1, y: 31 },
};

const FILE = { name: 'gondola.jpg', size: 2_000_000, lastModified: 1_790_000_000_000 };
const PHOTO = { file: FILE, origin: 'camera' };
const IMAGE = { data: new Uint8ClampedArray(4 * 40 * 30), width: 40, height: 30 };

/** Dependencias falsas que registram a ordem dos passos. */
function fakeDeps(overrides = {}) {
  const calls = [];
  const record =
    (name, implementation) =>
    async (...args) => {
      calls.push(name);
      return implementation(...args);
    };

  const deps = {
    hash: record('hash', async () => SHA),
    findDuplicate: record('findDuplicate', async () => undefined),
    loadImage: record('loadImage', async () => IMAGE),
    decode: record('decode', async () => [{ text: VALID, position: POSITION }]),
    failureReasonOf: vi.fn(() => null),
    save: record('save', async (sessionId, source, readings) => ({
      session: { id: sessionId, updatedAt: 'agora' },
      source: { ...source, id: 'fonte-1', sessionId },
      readings: readings.map((reading, index) => ({ ...reading, id: `leitura-${index}` })),
    })),
    isDuplicateError: (error) => error?.name === 'DuplicateSourceError',
    ...overrides,
  };

  for (const [name, implementation] of Object.entries(overrides)) {
    if (name !== 'failureReasonOf' && name !== 'isDuplicateError') {
      deps[name] = record(name, implementation);
    }
  }

  return { deps, calls };
}

function failing(error) {
  return async () => {
    throw error;
  };
}

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

describe('processSource', () => {
  it('segue a ordem hash, consulta, abertura, leitura e gravação', async () => {
    const { deps, calls } = fakeDeps();

    await processSource(PHOTO, SESSION_ID, deps);

    expect(calls).toEqual(['hash', 'findDuplicate', 'loadImage', 'decode', 'save']);
  });

  it('grava a fonte lida com as dimensões da imagem e as leituras como vieram', async () => {
    const symbols = [
      { text: VALID, position: POSITION },
      { text: VALID, position: { ...POSITION, topLeft: { x: 100, y: 2 } } },
      { text: 'https://exemplo.invalido' },
    ];
    const { deps } = fakeDeps({ decode: async () => symbols });
    const save = vi.spyOn(deps, 'save');

    const outcome = await processSource(PHOTO, SESSION_ID, deps);

    expect(save).toHaveBeenCalledWith(
      SESSION_ID,
      {
        fileName: 'gondola.jpg',
        byteSize: 2_000_000,
        lastModified: 1_790_000_000_000,
        sha256: SHA,
        origin: 'camera',
        status: 'read',
        width: 40,
        height: 30,
      },
      symbols,
    );
    expect(outcome).toMatchObject({
      status: 'read',
      session: { id: SESSION_ID },
      source: { id: 'fonte-1', status: 'read', width: 40, height: 30 },
      summary: { symbolCount: 3, validCount: 2, rejectedCount: 1 },
      warnings: [],
    });
    expect(outcome.readings).toHaveLength(3);
  });

  it('termina lida com zero leituras e o aviso quando a foto não tem símbolo', async () => {
    const { deps } = fakeDeps({ decode: async () => [] });

    const outcome = await processSource({ file: FILE, origin: 'file' }, SESSION_ID, deps);

    expect(outcome).toMatchObject({
      status: 'read',
      source: { status: 'read', origin: 'file' },
      readings: [],
      summary: { symbolCount: 0, validCount: 0, rejectedCount: 0 },
      warnings: ['no-symbols'],
    });
    expect(PROCESSING_WARNING_MESSAGES[outcome.warnings[0]]).toBe('nenhum símbolo encontrado');
  });

  it.each(['unsupported-format', 'corrupted-file'])(
    'grava a foto que não abre como falhou, com o motivo %s',
    async (reason) => {
      const error = codedError(reason);
      const { deps, calls } = fakeDeps({ loadImage: failing(error) });
      const save = vi.spyOn(deps, 'save');

      deps.failureReasonOf = vi.fn((value) => (value === error ? reason : null));

      const outcome = await processSource(PHOTO, SESSION_ID, deps);

      expect(calls).toEqual(['hash', 'findDuplicate', 'loadImage', 'save']);
      expect(save.mock.calls[0][1]).toEqual({
        fileName: 'gondola.jpg',
        byteSize: 2_000_000,
        lastModified: 1_790_000_000_000,
        sha256: SHA,
        origin: 'camera',
        status: 'failed',
        failureReason: reason,
      });
      expect(save.mock.calls[0][2]).toEqual([]);
      expect(outcome).toMatchObject({ status: 'failed', failureReason: reason, readings: [] });
    },
  );

  it('recusa a foto já gravada na sessão antes de abrir a imagem', async () => {
    const { deps, calls } = fakeDeps({ findDuplicate: async () => ({ id: 'fonte-antiga' }) });

    const outcome = await processSource(PHOTO, SESSION_ID, deps);

    expect(calls).toEqual(['hash', 'findDuplicate']);
    expect(outcome).toEqual({ status: 'duplicate', sha256: SHA, existingSourceId: 'fonte-antiga' });
  });

  it('consulta a foto repetida na sessão informada, pelo SHA-256', async () => {
    const { deps } = fakeDeps();
    const findDuplicate = vi.spyOn(deps, 'findDuplicate');

    await processSource(PHOTO, SESSION_ID, deps);

    expect(findDuplicate).toHaveBeenCalledWith(SESSION_ID, SHA);
  });

  it('trata a recusa da gravação como foto repetida', async () => {
    const duplicateError = Object.assign(new Error('repetida'), { name: 'DuplicateSourceError' });
    const { deps } = fakeDeps({ save: failing(duplicateError) });

    await expect(processSource(PHOTO, SESSION_ID, deps)).resolves.toEqual({
      status: 'duplicate',
      sha256: SHA,
      existingSourceId: null,
    });
  });

  it('trata a recusa da gravação da foto que falhou como foto repetida', async () => {
    const duplicateError = Object.assign(new Error('repetida'), { name: 'DuplicateSourceError' });
    const { deps } = fakeDeps({
      loadImage: failing(codedError('corrupted-file')),
      save: failing(duplicateError),
    });

    deps.failureReasonOf = () => 'corrupted-file';

    await expect(processSource(PHOTO, SESSION_ID, deps)).resolves.toMatchObject({
      status: 'duplicate',
    });
  });

  it.each([
    ['hash', { hash: failing(new Error('contexto')) }, ['hash']],
    ['lookup', { findDuplicate: failing(new Error('banco')) }, ['hash', 'findDuplicate']],
    [
      'load',
      { loadImage: failing(codedError('read-failed')) },
      ['hash', 'findDuplicate', 'loadImage'],
    ],
    [
      'decode',
      { decode: failing(codedError('engine-unavailable')) },
      ['hash', 'findDuplicate', 'loadImage', 'decode'],
    ],
    [
      'save',
      { save: failing(new Error('cota')) },
      ['hash', 'findDuplicate', 'loadImage', 'decode', 'save'],
    ],
  ])(
    'devolve erro sem gravar quando o passo %s falha fora do arquivo',
    async (step, overrides, expected) => {
      const { deps, calls } = fakeDeps(overrides);

      const outcome = await processSource(PHOTO, SESSION_ID, deps);

      expect(calls).toEqual(expected);
      expect(outcome).toMatchObject({
        status: 'error',
        step: PROCESSING_STEPS[step.toUpperCase()],
      });
      expect(outcome.error).toBeInstanceOf(Error);
    },
  );

  it('grava um nome padrão para arquivo sem nome e corta nome longo demais', async () => {
    const { deps } = fakeDeps();
    const save = vi.spyOn(deps, 'save');

    await processSource({ file: { ...FILE, name: '  ' }, origin: 'camera' }, SESSION_ID, deps);
    await processSource(
      { file: { ...FILE, name: 'a'.repeat(300) }, origin: 'camera' },
      SESSION_ID,
      deps,
    );

    expect(save.mock.calls[0][1].fileName).toBe('foto sem nome');
    expect(save.mock.calls[1][1].fileName).toHaveLength(255);
  });
});

describe('summarizeSymbols', () => {
  it('conta válidos e rejeitados pelo contrato LF1, sem deduplicar', () => {
    expect(
      summarizeSymbols([
        { text: VALID },
        { text: VALID },
        { text: OTHER_VALID },
        { text: 'LF2|x' },
        { text: '' },
      ]),
    ).toEqual({ symbolCount: 5, validCount: 3, rejectedCount: 2 });
  });
});
