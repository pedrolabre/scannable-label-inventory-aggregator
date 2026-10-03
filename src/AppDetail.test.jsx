// @vitest-environment jsdom

import 'fake-indexeddb/auto';

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { getAppDatabase } from './storage/indexed-db.js';
import { listResolutionsBySession } from './storage/resolutionRepository.js';
import { createSourceWithReadings } from './storage/sourceRepository.js';
import { useSessionStore } from './store/useSessionStore.js';
import {
  lf1Text,
  qrFixtureReadings,
  readingOf,
  sourceOf,
} from './test-fixtures/readingFixtures.js';
import { useReactRoot } from './test-fixtures/reactRoot.js';

/**
 * Coluna Detalhe dentro da tela inteira: a escolha gravada no banco real
 * (`fake-indexeddb`), a tabela e a linha de estado acompanhando, a escolha
 * mantida depois de reler o banco e o dialogo de rejeitados e fotos com falha.
 */

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
});

afterEach(async () => {
  vi.unstubAllGlobals();
  localStorage.clear();

  const db = getAppDatabase();

  await Promise.all(db.tables.map((table) => table.clear()));
});

/** Tela larga, para o foco ficar onde o gesto aconteceu. */
function stubWideScreen() {
  vi.stubGlobal('matchMedia', (query) => ({ matches: true, media: query }));
}

/** Espera o banco responder, com a tela redesenhada a cada volta. */
async function waitFor(condition) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) {
      return;
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  throw new Error('a condição não chegou');
}

function column(name) {
  return view.container.querySelector(`[data-vista="${name}"]`);
}

function statusValue(name) {
  return view.container.querySelector(`[data-status="${name}"] dd`).textContent;
}

function productRow(code) {
  return column('produtos').querySelector(`tr[data-produto="${CSS.escape(code)}"]`);
}

function variant(field, index) {
  return column('detalhe').querySelector(`[data-campo="${field}"] [data-variante="${index}"]`);
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

/** Sessao aberta com `qr-4.png` e `qr-8.png` gravadas: o 118789 em conflito de EAN e NCM. */
async function openSessionWithConflict() {
  await useSessionStore.getState().hydrate();

  const db = getAppDatabase();
  const sessionId = useSessionStore.getState().currentSessionId;

  for (const [file, sha] of [
    ['qr-4.png', 'a'],
    ['qr-8.png', 'b'],
  ]) {
    const { source, readings } = photo(file, sha);

    await createSourceWithReadings(db, sessionId, source, readings);
  }

  await useSessionStore.getState().hydrate();

  return { db, sessionId };
}

describe('App com a coluna Detalhe', () => {
  it('grava a escolha, acompanha na tabela e na linha de estado e a mantém ao reler o banco', async () => {
    stubWideScreen();

    const { db, sessionId } = await openSessionWithConflict();

    await view.render(<App />);
    await view.click(productRow('118789').querySelector('button'));

    expect(statusValue('conflitos')).toBe('2');
    expect(productRow('118789').textContent).toContain('conflito em EAN e NCM');
    expect(variant('ean', 0).textContent).toBe('78990754204161 exemplar: c1');
    expect(variant('ean', 1).textContent).toBe('sem EAN1 exemplar: c1');

    const quantity = productRow('118789').querySelectorAll('td')[3].textContent;

    await view.focus(variant('ean', 0));
    await view.click(variant('ean', 0));
    await waitFor(() => variant('ean', 0).getAttribute('aria-pressed') === 'true');

    expect(statusValue('conflitos')).toBe('1');
    expect(productRow('118789').textContent).toContain('conflito em NCM');
    expect(productRow('118789').textContent).toContain('resolvido em EAN');
    expect(productRow('118789').querySelectorAll('td')[3].textContent).toBe(quantity);
    expect(column('detalhe').querySelector('[data-dado="EAN"] dd').textContent).toBe(
      '7899075420416',
    );
    expect(column('detalhe').querySelectorAll('[data-exemplar]')).toHaveLength(2);
    expect(document.activeElement).toBe(variant('ean', 0));
    expect(await listResolutionsBySession(db, sessionId)).toEqual([
      expect.objectContaining({ systemCode: '118789', choices: { ean: '7899075420416' } }),
    ]);

    await view.update(() => useSessionStore.setState(initialSession, true));
    await view.update(() => useSessionStore.getState().hydrate());
    await waitFor(() => productRow('118789') !== null);
    await view.click(productRow('118789').querySelector('button'));

    expect(variant('ean', 0).getAttribute('aria-pressed')).toBe('true');
    expect(statusValue('conflitos')).toBe('1');

    const undo = column('detalhe').querySelector('[data-campo="ean"] [data-desfazer]');

    await view.focus(undo);
    await view.click(undo);
    await waitFor(() => variant('ean', 0).getAttribute('aria-pressed') === 'false');

    expect(statusValue('conflitos')).toBe('2');
    expect(productRow('118789').textContent).toContain('conflito em EAN e NCM');
    expect(document.activeElement).toBe(variant('ean', 0));
    expect(await listResolutionsBySession(db, sessionId)).toEqual([]);
  });

  it('refaz o Detalhe na hora quando uma foto sai', async () => {
    stubWideScreen();
    useSessionStore.setState({
      sessions: [{ id: 'sessao-teste', name: 'Inventário' }],
      currentSessionId: 'sessao-teste',
      sources: [sourceOf('f1'), sourceOf('f2')],
      readings: [
        readingOf('l1', 'f1', lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 900 })),
        readingOf(
          'l2',
          'f2',
          lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 1000, copy: 'c2' }),
        ),
      ],
      resolutions: [],
    });

    await view.render(<App />);
    await view.click(productRow('A-1').querySelector('button'));

    expect(column('detalhe').querySelectorAll('[data-exemplar]')).toHaveLength(2);
    expect(column('detalhe').querySelector('[data-conflitos]')).toBeTruthy();

    await view.update(() =>
      useSessionStore.setState({
        sources: [sourceOf('f1')],
        readings: useSessionStore
          .getState()
          .readings.filter((reading) => reading.sourceId === 'f1'),
      }),
    );

    expect(column('detalhe').querySelectorAll('[data-exemplar]')).toHaveLength(1);
    expect(column('detalhe').querySelector('[data-conflitos]')).toBeNull();
    expect(column('detalhe').querySelector('[data-dado="Preço"] dd').textContent).toBe('R$ 9,00');
  });

  it('abre o diálogo de rejeitados e falhas pela Entrada, um diálogo por vez, com o foco devolvido', async () => {
    useSessionStore.setState({
      sessions: [{ id: 'sessao-teste', name: 'Inventário' }],
      currentSessionId: 'sessao-teste',
      sources: [
        sourceOf('f1', { fileName: '<b>gondola</b>.jpg' }),
        sourceOf('f2', { fileName: 'quebrada.jpg', failureReason: 'corrupted-file' }),
      ],
      readings: [readingOf('l1', 'f1', `<img src=x>${'Y'.repeat(300)}`)],
      resolutions: [],
    });

    await view.render(<App />);

    const trigger = column('entrada').querySelector('[data-gatilho-rejeitados]');

    expect(trigger.textContent).toBe('Rejeitados (1) e falhas (1)');

    await view.focus(trigger);
    await view.click(trigger);

    const dialogs = document.body.querySelectorAll('[role="dialog"]');

    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].querySelector('h2').textContent).toBe('Rejeitados e fotos com falha');
    expect(dialogs[0].querySelector('[data-texto-rejeitado]').textContent).toBe(
      `<img src=x>${'Y'.repeat(109)}…`,
    );
    expect(dialogs[0].textContent).toContain('arquivo corrompido ou incompleto');
    expect(dialogs[0].querySelector('img, b')).toBeNull();

    await view.press('Escape');

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
