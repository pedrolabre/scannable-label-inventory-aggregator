// @vitest-environment jsdom

import 'fake-indexeddb/auto';

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { getAppDatabase } from './storage/indexed-db.js';
import { createSourceWithReadings } from './storage/sourceRepository.js';
import { useSessionStore } from './store/useSessionStore.js';
import { qrFixtureReadings } from './test-fixtures/readingFixtures.js';
import { useReactRoot } from './test-fixtures/reactRoot.js';

/**
 * Exportacao dentro da tela inteira, com o banco real (`fake-indexeddb`): o
 * gatilho do cabecalho, o bloqueio com o `118789` de `qr-4.png` e `qr-8.png`
 * em conflito de EAN e NCM, a ida ao produto, a resolucao no Detalhe e o
 * download interceptado, com o arquivo lido de volta.
 */

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
});

let downloads = [];
let revoked = [];

beforeEach(() => {
  downloads = [];
  revoked = [];
  URL.createObjectURL = vi.fn((blob) => {
    downloads.push({ blob });

    return `blob:teste-${downloads.length}`;
  });
  URL.revokeObjectURL = vi.fn((href) => revoked.push(href));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    downloads.at(-1).fileName = this.download;
    downloads.at(-1).href = this.getAttribute('href');
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete URL.createObjectURL;
  delete URL.revokeObjectURL;
  localStorage.clear();

  const db = getAppDatabase();

  await Promise.all(db.tables.map((table) => table.clear()));
});

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
}

function trigger() {
  return view.container.querySelector('[data-gatilho-exportar]');
}

function dialogs() {
  return document.body.querySelectorAll('[role="dialog"]');
}

function detail() {
  return view.container.querySelector('[data-vista="detalhe"]');
}

function variant(field, index) {
  return detail().querySelector(`[data-campo="${field}"] [data-variante="${index}"]`);
}

function readText(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob, 'utf-8');
  });
}

describe('App com a exportação', () => {
  it('fica com o gatilho desligado sem sessão aberta', async () => {
    await view.render(<App />);

    expect(trigger().textContent).toBe('Exportar');
    expect(trigger().disabled).toBe(true);
  });

  it('bloqueia com conflito aberto, leva ao produto, libera depois da escolha e baixa o CSV', async () => {
    await openSessionWithConflict();
    await view.render(<App />);

    await view.focus(trigger());
    await view.click(trigger());

    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].querySelector('[data-bloqueio-exportacao]').textContent).toContain(
      'Exportação bloqueada: 2 conflitos abertos.',
    );
    expect(dialogs()[0].querySelector('[data-baixar="resumo"]').disabled).toBe(true);

    await view.press('Escape');

    expect(dialogs()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());

    await view.click(trigger());
    await view.click(dialogs()[0].querySelector('[data-revisar-conflitos]'));

    expect(dialogs()).toHaveLength(0);
    expect(detail().hasAttribute('data-vista-ativa')).toBe(true);
    expect(document.activeElement).toBe(detail().querySelector('[data-produto-selecionado]'));
    expect(document.activeElement.getAttribute('data-produto-selecionado')).toBe('118789');

    await view.click(variant('ean', 0));
    await waitFor(() => variant('ean', 0).getAttribute('aria-pressed') === 'true');
    await view.click(variant('ncm', 0));
    await waitFor(() => variant('ncm', 0).getAttribute('aria-pressed') === 'true');

    await view.click(trigger());

    const dialog = dialogs()[0];
    const summaryButton = dialog.querySelector('[data-baixar="resumo"]');

    expect(dialog.querySelector('[data-bloqueio-exportacao]')).toBeNull();
    expect(summaryButton.disabled).toBe(false);

    await view.focus(summaryButton);
    await view.click(summaryButton);

    expect(downloads).toHaveLength(1);
    expect(downloads[0].fileName).toMatch(/^inventario-\d{4}-\d{2}-\d{2}-\d{4}\.csv$/);
    expect(revoked).toEqual([downloads[0].href]);
    expect(dialog.querySelector('[data-arquivo-gerado]').textContent).toBe(
      `Arquivo gerado: ${downloads[0].fileName}`,
    );
    expect(document.activeElement).toBe(summaryButton);

    const lines = (await readText(downloads[0].blob)).split('\r\n');

    expect(lines[0]).toBe(
      'Código;Nome;Preço (centavos);Preço;Quantidade;Total (centavos);Total;EAN;NCM;Resolvido em',
    );
    expect(lines).toContain(
      '118789;CANTINHO CAFE RUBI;85990;R$ 859,90;2;171980;R$ 1.719,80;7899075420416;94035000;EAN, NCM',
    );
    expect(lines).toContain('DEMO-005;MAÇÃ FUJI KG;1099;R$ 10,99;1;1099;R$ 10,99;;;');
    expect(lines).toHaveLength(12);
    expect(lines.at(-1)).toBe('');

    await view.click(dialog.querySelector('[data-baixar="exemplares"]'));

    expect(downloads[1].fileName).toMatch(/^inventario-\d{4}-\d{2}-\d{2}-\d{4}-exemplares\.csv$/);
    expect((await readText(downloads[1].blob)).split('\r\n')[0]).toBe(
      'Código;Exemplar;Leituras;Fotos;Aviso;Texto LF1',
    );
  });
});
