// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StockVisionDatabase } from './indexed-db.js';
import {
  deleteResolution,
  listResolutionsBySession,
  saveResolution,
} from './resolutionRepository.js';
import { createSession } from './sessionRepository.js';

let db;
let session;

beforeEach(async () => {
  db = new StockVisionDatabase(`teste-${crypto.randomUUID()}`);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
  session = await createSession(db, { name: 'Loja' });
  vi.setSystemTime(new Date('2026-09-24T12:30:00.000Z'));
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

function resolution(systemCode, choices) {
  return { sessionId: session.id, systemCode, choices };
}

describe('saveResolution', () => {
  it('grava a escolha e atualiza a data da sessão', async () => {
    const stored = await saveResolution(db, resolution('118789', { priceInCentavos: 85990 }));

    expect(await db.resolutions.get([session.id, '118789'])).toEqual(stored);
    expect((await db.sessions.get(session.id)).updatedAt).toBe('2026-09-24T12:30:00.000Z');
  });

  it('substitui a escolha anterior do mesmo produto', async () => {
    await saveResolution(db, resolution('118789', { priceInCentavos: 85990, ean: null }));
    await saveResolution(db, resolution('118789', { displayName: 'CANTINHO CAFE RUBI' }));

    expect(await db.resolutions.toArray()).toEqual([
      resolution('118789', { displayName: 'CANTINHO CAFE RUBI' }),
    ]);
  });

  it('recusa pelo schema sem chegar ao banco', async () => {
    await expect(saveResolution(db, resolution('118789', {}))).rejects.toMatchObject({
      name: 'ZodError',
    });
    await expect(
      saveResolution(db, resolution('118789', { copy: 'c1', ean: null })),
    ).rejects.toMatchObject({ name: 'ZodError' });

    expect(await db.resolutions.count()).toBe(0);
    expect((await db.sessions.get(session.id)).updatedAt).toBe(session.updatedAt);
  });

  it('recusa sessão inexistente sem gravar', async () => {
    await expect(
      saveResolution(db, {
        ...resolution('118789', { ncm: null }),
        sessionId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ name: 'MissingSessionError' });
    expect(await db.resolutions.count()).toBe(0);
  });
});

describe('listResolutionsBySession', () => {
  it('lista só as resoluções da sessão, pelo código do produto', async () => {
    const outra = await createSession(db, { name: 'Depósito' });

    await saveResolution(db, resolution('B-2', { ncm: null }));
    await saveResolution(db, resolution('A-1', { ean: null }));
    await saveResolution(db, { sessionId: outra.id, systemCode: 'A-1', choices: { ean: null } });

    expect(await listResolutionsBySession(db, session.id)).toEqual([
      resolution('A-1', { ean: null }),
      resolution('B-2', { ncm: null }),
    ]);
  });
});

describe('deleteResolution', () => {
  it('remove a escolha do produto e atualiza a data da sessão', async () => {
    await saveResolution(db, resolution('A-1', { ean: null }));
    await saveResolution(db, resolution('B-2', { ncm: null }));

    vi.setSystemTime(new Date('2026-09-24T13:00:00.000Z'));
    await deleteResolution(db, session.id, 'A-1');

    expect(await listResolutionsBySession(db, session.id)).toEqual([
      resolution('B-2', { ncm: null }),
    ]);
    expect((await db.sessions.get(session.id)).updatedAt).toBe('2026-09-24T13:00:00.000Z');
  });

  it('recusa sessão inexistente', async () => {
    await expect(deleteResolution(db, crypto.randomUUID(), 'A-1')).rejects.toMatchObject({
      name: 'MissingSessionError',
    });
  });
});
