// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StockVisionDatabase } from './indexed-db.js';
import { createReadings } from './readingRepository.js';
import { createSession } from './sessionRepository.js';
import { createSource, deleteSource, listSourcesBySession } from './sourceRepository.js';
import { describeStorageError } from './storageError.js';

let db;
let session;

const READ_SOURCE = {
  fileName: 'gondola-3.jpg',
  byteSize: 2_345_678,
  lastModified: 1_790_000_000_000,
  sha256: 'ab'.repeat(32),
  origin: 'camera',
  status: 'read',
  width: 4032,
  height: 3024,
};

const FAILED_SOURCE = {
  fileName: 'foto.heic',
  byteSize: 1_500_000,
  lastModified: 1_790_000_000_000,
  sha256: 'cd'.repeat(32),
  origin: 'file',
  status: 'failed',
  failureReason: 'unsupported-format',
};

beforeEach(async () => {
  db = new StockVisionDatabase(`teste-${crypto.randomUUID()}`);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
  session = await createSession(db, { name: 'Loja' });
  vi.setSystemTime(new Date('2026-09-24T12:05:00.000Z'));
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

describe('createSource', () => {
  it('grava só os metadados da foto, com identificador, sessão e data', async () => {
    const stored = await createSource(db, session.id, READ_SOURCE);

    expect(stored).toEqual({
      ...READ_SOURCE,
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      sessionId: session.id,
      processedAt: '2026-09-24T12:05:00.000Z',
    });
    expect(Object.keys(await db.sources.get(stored.id)).sort()).toEqual([
      'byteSize',
      'fileName',
      'height',
      'id',
      'lastModified',
      'origin',
      'processedAt',
      'sessionId',
      'sha256',
      'status',
      'width',
    ]);
  });

  it('grava a foto que o navegador não abriu, com o motivo', async () => {
    const stored = await createSource(db, session.id, FAILED_SOURCE);

    expect(await db.sources.get(stored.id)).toEqual(stored);
    expect(stored).not.toHaveProperty('width');
  });

  it('atualiza a data da sessão na mesma gravação', async () => {
    await createSource(db, session.id, READ_SOURCE);

    expect((await db.sessions.get(session.id)).updatedAt).toBe('2026-09-24T12:05:00.000Z');
  });

  it('recusa pelo schema sem chegar ao banco, inclusive com os bytes da imagem', async () => {
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(createSource(db, session.id, { ...READ_SOURCE, bytes })).rejects.toMatchObject({
      name: 'ZodError',
    });
    await expect(
      createSource(db, session.id, { ...READ_SOURCE, fileName: new Blob([bytes]) }),
    ).rejects.toMatchObject({ name: 'ZodError' });
    await expect(createSource(db, session.id, { ...READ_SOURCE, width: 0 })).rejects.toMatchObject({
      name: 'ZodError',
    });

    expect(await db.sources.count()).toBe(0);
    expect((await db.sessions.get(session.id)).updatedAt).toBe(session.updatedAt);
  });

  it('recusa a mesma foto duas vezes na mesma sessão, com mensagem em português', async () => {
    await createSource(db, session.id, READ_SOURCE);

    const repetida = createSource(db, session.id, { ...READ_SOURCE, fileName: 'outro-nome.jpg' });

    await expect(repetida).rejects.toMatchObject({ name: 'DuplicateSourceError' });
    await expect(repetida.catch(describeStorageError)).resolves.toBe(
      'Esta foto já foi lida nesta sessão. Escolha outra foto ou abra outra sessão.',
    );
    expect(await db.sources.count()).toBe(1);
  });

  it('aceita a mesma foto em sessões diferentes', async () => {
    const outra = await createSession(db, { name: 'Depósito' });

    await createSource(db, session.id, READ_SOURCE);
    await createSource(db, outra.id, READ_SOURCE);

    expect(await db.sources.count()).toBe(2);
  });

  it('recusa sessão inexistente sem gravar a fonte', async () => {
    await expect(createSource(db, crypto.randomUUID(), READ_SOURCE)).rejects.toMatchObject({
      name: 'MissingSessionError',
    });
    expect(await db.sources.count()).toBe(0);
  });
});

describe('listSourcesBySession', () => {
  it('lista só as fontes da sessão, na ordem do processamento', async () => {
    const outra = await createSession(db, { name: 'Depósito' });
    const primeira = await createSource(db, session.id, READ_SOURCE);

    vi.setSystemTime(new Date('2026-09-24T12:06:00.000Z'));
    const segunda = await createSource(db, session.id, FAILED_SOURCE);
    await createSource(db, outra.id, READ_SOURCE);

    expect(await listSourcesBySession(db, session.id)).toEqual([primeira, segunda]);
  });
});

describe('deleteSource', () => {
  it('remove a fonte com as leituras dela, e só dela', async () => {
    const apagada = await createSource(db, session.id, READ_SOURCE);
    const mantida = await createSource(db, session.id, { ...READ_SOURCE, sha256: 'ef'.repeat(32) });

    await createReadings(db, session.id, apagada.id, [{ text: 'LF1|A|B|1|||c1' }, { text: 'x' }]);
    await createReadings(db, session.id, mantida.id, [{ text: 'LF1|A|B|1|||c2' }]);

    vi.setSystemTime(new Date('2026-09-24T12:10:00.000Z'));
    await deleteSource(db, session.id, apagada.id);

    expect(await db.sources.get(apagada.id)).toBeUndefined();
    expect(await db.readings.where('sourceId').equals(apagada.id).count()).toBe(0);
    expect(await db.readings.where('sourceId').equals(mantida.id).count()).toBe(1);
    expect((await db.sessions.get(session.id)).updatedAt).toBe('2026-09-24T12:10:00.000Z');
  });

  it('libera a foto para ser enviada de novo na sessão', async () => {
    const stored = await createSource(db, session.id, READ_SOURCE);

    await deleteSource(db, session.id, stored.id);

    await expect(createSource(db, session.id, READ_SOURCE)).resolves.toBeTruthy();
  });

  it('recusa fonte inexistente ou de outra sessão', async () => {
    const outra = await createSession(db, { name: 'Depósito' });
    const stored = await createSource(db, session.id, READ_SOURCE);

    await expect(deleteSource(db, outra.id, stored.id)).rejects.toMatchObject({
      name: 'MissingSourceError',
    });
    await expect(deleteSource(db, session.id, crypto.randomUUID())).rejects.toMatchObject({
      name: 'MissingSourceError',
    });
    expect(await db.sources.count()).toBe(1);
  });
});
