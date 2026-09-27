// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectConflicts } from '../domain/services/conflictDetection.js';
import { applyResolutions, countConflicts } from '../domain/services/conflictResolution.js';
import { identifyCopies } from '../domain/services/copyIdentity.js';
import { summarizeProducts } from '../domain/services/inventoryAggregation.js';
import { createSourceWithReadings, deleteSource } from '../storage/sourceRepository.js';
import { qrFixtureReadings } from '../test-fixtures/readingFixtures.js';

/**
 * A escolha do operador com o banco real sobre `fake-indexeddb`: gravada por
 * um store, lida por outro montado do zero, como depois de recarregar a
 * pagina, e reaplicada pelo dominio sobre as leituras da sessao.
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

/** Sessao aberta com as duas imagens de teste gravadas: o 118789 em conflito. */
async function sessionWithConflict() {
  const page = await reloadPage();
  const sessionId = page.store.getState().currentSessionId;
  const sources = [];

  for (const [file, sha] of [
    ['qr-4.png', 'a'],
    ['qr-8.png', 'b'],
  ]) {
    const { source, readings } = photo(file, sha);
    sources.push((await createSourceWithReadings(page.db, sessionId, source, readings)).source);
  }

  await page.store.getState().hydrate();

  return { ...page, sessionId, sources };
}

/** O mesmo caminho do relatorio: leituras, exemplares, resumo, conflitos e escolhas. */
function reportOf(state) {
  const { copies } = identifyCopies(state.readings);
  const result = applyResolutions(
    summarizeProducts(copies),
    detectConflicts(copies),
    state.resolutions,
  );

  return {
    cantinho: result.products.find((product) => product.systemCode === '118789'),
    ignoredChoices: result.ignoredChoices,
    counts: countConflicts(result.products),
  };
}

afterEach(async () => {
  for (const db of opened.splice(0).reverse()) {
    await db.delete();
  }
});

describe('resolução com o banco real', () => {
  it('volta depois de recarregar a página e é reaplicada, e sai com clearResolution', async () => {
    const first = await sessionWithConflict();

    expect(reportOf(first.store.getState()).counts).toEqual({ open: 2, resolved: 0 });

    await first.store.getState().resolveConflict(first.sessionId, '118789', 'ean', null);
    first.db.close();

    const second = await reloadPage();

    expect(second.store.getState()).toMatchObject({
      currentSessionId: first.sessionId,
      resolutions: [{ sessionId: first.sessionId, systemCode: '118789', choices: { ean: null } }],
    });
    expect(reportOf(second.store.getState())).toMatchObject({
      cantinho: {
        quantity: 2,
        ean: null,
        resolvedFields: ['ean'],
        openConflictFields: ['ncm'],
      },
      ignoredChoices: [],
      counts: { open: 1, resolved: 1 },
    });

    await second.store.getState().clearResolution(first.sessionId, '118789', 'ean');
    second.db.close();

    const third = await reloadPage();

    expect(third.store.getState().resolutions).toEqual([]);
    expect(await third.db.resolutions.count()).toBe(0);
    expect(reportOf(third.store.getState()).counts).toEqual({ open: 2, resolved: 0 });
  });

  it('marca a sessão como alterada na gravação', async () => {
    const page = await sessionWithConflict();
    const before = page.store.getState().sessions[0].updatedAt;

    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    await page.store.getState().resolveConflict(page.sessionId, '118789', 'ncm', '94035000');

    const stored = await page.db.sessions.get(page.sessionId);

    expect(stored.updatedAt > before).toBe(true);
    expect(page.store.getState().sessions[0]).toEqual(stored);
  });

  it('ignora a escolha depois que a foto sai da sessão, e deixa retirá-la', async () => {
    const first = await sessionWithConflict();

    await first.store.getState().resolveConflict(first.sessionId, '118789', 'ean', null);
    await deleteSource(first.db, first.sessionId, first.sources[1].id);
    first.db.close();

    const second = await reloadPage();

    expect(reportOf(second.store.getState())).toMatchObject({
      cantinho: { quantity: 1, ean: '7899075420416', conflictingFields: [], resolvedFields: [] },
      ignoredChoices: [{ systemCode: '118789', field: 'ean', value: null, reason: 'no-conflict' }],
      counts: { open: 0, resolved: 0 },
    });

    await second.store.getState().clearResolution(first.sessionId, '118789', 'ean');

    expect(await second.db.resolutions.count()).toBe(0);
    expect(reportOf(second.store.getState()).ignoredChoices).toEqual([]);
  });
});
