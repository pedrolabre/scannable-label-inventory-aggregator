// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSourceWithReadings } from '../storage/sourceRepository.js';
import { qrFixtureReadings } from '../test-fixtures/readingFixtures.js';

/**
 * Sessoes e remocao de foto com o banco real sobre `fake-indexeddb`: o que um
 * store grava, outro montado do zero le de volta, como depois de recarregar a
 * pagina.
 */

const opened = [];

/** Store e banco novos, como numa pagina recem-carregada. */
async function reloadPage() {
  vi.resetModules();

  const { useSessionStore } = await import('./useSessionStore.js');
  const { getAppDatabase } = await import('../storage/indexed-db.js');
  const db = getAppDatabase();

  opened.push(db);
  await useSessionStore.getState().hydrate();

  return { store: useSessionStore, db };
}

function photo(file, sha) {
  return {
    source: {
      fileName: file,
      byteSize: 1000,
      lastModified: 1_790_000_000_000,
      sha256: sha.repeat(64),
      origin: 'file',
      status: 'read',
      width: 328,
      height: 328,
    },
    readings: qrFixtureReadings(file, file).map(({ text, position }) => ({ text, position })),
  };
}

async function storePhoto(page, file, sha) {
  const { source, readings } = photo(file, sha);
  const sessionId = page.store.getState().currentSessionId;
  const outcome = await createSourceWithReadings(page.db, sessionId, source, readings);

  await page.store.getState().addProcessedSource(outcome);

  return outcome.source;
}

/** `localStorage` em memoria, que sobrevive ao recarregamento simulado. */
function stubLocalStorage() {
  const values = new Map();

  vi.stubGlobal('localStorage', {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
  });

  return values;
}

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();

  for (const db of opened.splice(0).reverse()) {
    await db.delete();
  }
});

describe('sessões com o banco real', () => {
  it('cria com o nome do dia e da hora, renomeia, abre e reabre a sessão atual depois de recarregar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 9, 5));

    const first = await reloadPage();
    const daySession = first.store.getState().sessions[0];

    expect(daySession.name).toBe('Inventário 02/10/2026 09:05');

    vi.setSystemTime(new Date(2026, 9, 2, 14, 30));

    const second = await first.store.getState().createSession();

    expect(second.name).toBe('Inventário 02/10/2026 14:30');
    expect(first.store.getState().currentSessionId).toBe(second.id);

    vi.setSystemTime(new Date(2026, 9, 2, 14, 40));
    await first.store.getState().renameSession(daySession.id, '  Depósito norte  ');

    expect(first.store.getState().sessions.map((session) => session.name)).toEqual([
      'Depósito norte',
      'Inventário 02/10/2026 14:30',
    ]);

    await first.store.getState().selectSession(daySession.id);
    await storePhoto(first, 'qr-1.png', 'a');
    first.db.close();

    const reloaded = await reloadPage();

    expect(reloaded.store.getState()).toMatchObject({
      currentSessionId: daySession.id,
      sources: [{ fileName: 'qr-1.png' }],
    });
    expect(reloaded.store.getState().readings).toHaveLength(1);
  });

  it('reabre depois de recarregar a última sessão aberta, mesmo sem alteração nela', async () => {
    stubLocalStorage();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 9, 0));

    const first = await reloadPage();
    const older = first.store.getState().sessions[0];

    vi.setSystemTime(new Date(2026, 9, 2, 10, 0));

    const newer = await first.store.getState().createSession('Loja');

    await first.store.getState().selectSession(older.id);
    first.db.close();

    const reloaded = await reloadPage();

    expect(reloaded.store.getState().currentSessionId).toBe(older.id);
    expect(reloaded.store.getState().sessions.map((session) => session.id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect((await reloaded.db.sessions.get(older.id)).updatedAt).toBe(older.updatedAt);
  });

  it('abre a alterada por último quando a última aberta não existe mais', async () => {
    const values = stubLocalStorage();

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 9, 0));

    const first = await reloadPage();

    vi.setSystemTime(new Date(2026, 9, 2, 10, 0));

    const newer = await first.store.getState().createSession('Loja');

    values.set('stockvision:ultima-sessao', 'sessao-apagada');
    first.db.close();

    const reloaded = await reloadPage();

    expect(reloaded.store.getState().currentSessionId).toBe(newer.id);
  });

  it('recusa nome vazio e acima de 80 caracteres sem gravar', async () => {
    const page = await reloadPage();
    const { id, name } = page.store.getState().sessions[0];

    await expect(page.store.getState().renameSession(id, '   ')).rejects.toMatchObject({
      name: 'ZodError',
    });
    await expect(page.store.getState().renameSession(id, 'x'.repeat(81))).rejects.toMatchObject({
      name: 'ZodError',
    });
    expect((await page.db.sessions.get(id)).name).toBe(name);
  });

  it('apaga a sessão aberta com tudo dela e abre a mais recente das que sobraram', async () => {
    const page = await reloadPage();
    const older = page.store.getState().sessions[0];
    const newer = await page.store.getState().createSession('Loja');

    await storePhoto(page, 'qr-4.png', 'b');
    await page.store.getState().deleteSession(newer.id);

    expect(page.store.getState()).toMatchObject({
      sessions: [older],
      currentSessionId: older.id,
      sources: [],
      readings: [],
    });
    expect(await page.db.sources.count()).toBe(0);
    expect(await page.db.readings.count()).toBe(0);
  });
});

describe('remoção de foto com o banco real', () => {
  it('tira a foto e as leituras dela numa transação, sem leitura órfã, e libera a foto de novo', async () => {
    const page = await reloadPage();
    const kept = await storePhoto(page, 'qr-4.png', 'c');
    const removed = await storePhoto(page, 'qr-8.png', 'd');
    const sessionId = page.store.getState().currentSessionId;

    expect(page.store.getState().readings).toHaveLength(12);

    await page.store.getState().removeSource(sessionId, removed.id);

    const sourceIds = new Set((await page.db.sources.toArray()).map((source) => source.id));
    const readings = await page.db.readings.toArray();

    expect([...sourceIds]).toEqual([kept.id]);
    expect(readings).toHaveLength(4);
    expect(readings.every((reading) => sourceIds.has(reading.sourceId))).toBe(true);
    expect(page.store.getState().sources.map((source) => source.id)).toEqual([kept.id]);
    expect(page.store.getState().readings).toHaveLength(4);

    await expect(storePhoto(page, 'qr-8.png', 'd')).resolves.toMatchObject({
      fileName: 'qr-8.png',
    });
  });

  it('mantém a foto e as leituras quando a sessão não existe mais', async () => {
    const page = await reloadPage();
    const stored = await storePhoto(page, 'qr-1.png', 'e');

    await expect(
      page.store.getState().removeSource(crypto.randomUUID(), stored.id),
    ).rejects.toMatchObject({ name: 'MissingSourceError' });
    expect(await page.db.sources.count()).toBe(1);
    expect(await page.db.readings.count()).toBe(1);
  });
});
