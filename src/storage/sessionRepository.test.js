// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StockVisionDatabase } from './indexed-db.js';
import {
  createSession,
  deleteSession,
  listSessions,
  renameSession,
  touchSession,
} from './sessionRepository.js';
import { createSource } from './sourceRepository.js';
import { createReadings } from './readingRepository.js';
import { saveResolution } from './resolutionRepository.js';

let db;

beforeEach(async () => {
  db = new StockVisionDatabase(`teste-${crypto.randomUUID()}`);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await db.delete();
});

function source(sha256Char) {
  return {
    fileName: 'foto.jpg',
    byteSize: 1000,
    lastModified: 1_790_000_000_000,
    sha256: sha256Char.repeat(64),
    origin: 'file',
    status: 'read',
    width: 800,
    height: 600,
  };
}

/** Sessao com uma foto, uma leitura e uma resolucao. */
async function filledSession(name, sha256Char) {
  const session = await createSession(db, { name });
  const stored = await createSource(db, session.id, source(sha256Char));

  await createReadings(db, session.id, stored.id, [{ text: 'LF1|A1|MESA|100|||c1' }]);
  await saveResolution(db, {
    sessionId: session.id,
    systemCode: 'A1',
    choices: { priceInCentavos: 100 },
  });

  return session;
}

async function countsOf(sessionId) {
  return {
    sessions: await db.sessions.where('id').equals(sessionId).count(),
    sources: await db.sources.where('sessionId').equals(sessionId).count(),
    readings: await db.readings.where('sessionId').equals(sessionId).count(),
    resolutions: await db.resolutions.where('sessionId').equals(sessionId).count(),
  };
}

describe('createSession', () => {
  it('grava a sessão com identificador novo, nome aparado e as duas datas', async () => {
    const session = await createSession(db, { name: '  Depósito  ' });

    expect(session).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Depósito',
      createdAt: '2026-09-24T12:00:00.000Z',
      updatedAt: '2026-09-24T12:00:00.000Z',
    });
    expect(await db.sessions.get(session.id)).toEqual(session);
  });

  it('recusa pelo schema sem chegar ao banco', async () => {
    await expect(createSession(db, { name: '   ' })).rejects.toMatchObject({ name: 'ZodError' });
    await expect(createSession(db, { name: 42 })).rejects.toMatchObject({ name: 'ZodError' });

    expect(await db.sessions.count()).toBe(0);
  });
});

describe('listSessions', () => {
  it('ordena da atualizada mais recentemente para a mais antiga', async () => {
    const antiga = await createSession(db, { name: 'Antiga' });

    vi.setSystemTime(new Date('2026-09-24T13:00:00.000Z'));
    const nova = await createSession(db, { name: 'Nova' });

    expect((await listSessions(db)).map((session) => session.id)).toEqual([nova.id, antiga.id]);

    vi.setSystemTime(new Date('2026-09-24T14:00:00.000Z'));
    await touchSession(db, antiga.id);

    expect((await listSessions(db)).map((session) => session.id)).toEqual([antiga.id, nova.id]);
  });
});

describe('renameSession', () => {
  it('troca o nome e atualiza a data de atualização', async () => {
    const session = await createSession(db, { name: 'Loja' });

    vi.setSystemTime(new Date('2026-09-24T15:00:00.000Z'));
    const renamed = await renameSession(db, session.id, ' Loja centro ');

    expect(renamed).toEqual({
      ...session,
      name: 'Loja centro',
      updatedAt: '2026-09-24T15:00:00.000Z',
    });
    expect(await db.sessions.get(session.id)).toEqual(renamed);
  });

  it('recusa nome fora do schema e deixa a sessão como estava', async () => {
    const session = await createSession(db, { name: 'Loja' });

    await expect(renameSession(db, session.id, 'a'.repeat(81))).rejects.toMatchObject({
      name: 'ZodError',
    });
    expect(await db.sessions.get(session.id)).toEqual(session);
  });

  it('recusa sessão inexistente', async () => {
    await expect(renameSession(db, crypto.randomUUID(), 'Loja')).rejects.toMatchObject({
      name: 'MissingSessionError',
    });
  });
});

describe('deleteSession', () => {
  it('remove a sessão com fontes, leituras e resoluções, e só dela', async () => {
    const apagada = await filledSession('Apagada', 'a');
    const mantida = await filledSession('Mantida', 'a');

    await deleteSession(db, apagada.id);

    expect(await countsOf(apagada.id)).toEqual({
      sessions: 0,
      sources: 0,
      readings: 0,
      resolutions: 0,
    });
    expect(await countsOf(mantida.id)).toEqual({
      sessions: 1,
      sources: 1,
      readings: 1,
      resolutions: 1,
    });
  });

  it('desfaz tudo quando uma das remoções falha no meio da transação', async () => {
    const session = await filledSession('Loja', 'b');

    const falha = vi.spyOn(db.resolutions, 'where').mockImplementation(() => {
      throw new Error('falha simulada');
    });

    await expect(deleteSession(db, session.id)).rejects.toThrow('falha simulada');
    expect(falha).toHaveBeenCalledTimes(1);
    falha.mockRestore();

    expect(await countsOf(session.id)).toEqual({
      sessions: 1,
      sources: 1,
      readings: 1,
      resolutions: 1,
    });
  });

  it('recusa sessão inexistente', async () => {
    await expect(deleteSession(db, crypto.randomUUID())).rejects.toMatchObject({
      name: 'MissingSessionError',
    });
  });
});

describe('touchSession', () => {
  it('recusa sessão inexistente', async () => {
    await expect(touchSession(db, crypto.randomUUID())).rejects.toMatchObject({
      name: 'MissingSessionError',
    });
  });
});
