// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { buildInventoryReport } from './domain/services/inventoryReport.js';
import { useSessionStore } from './store/useSessionStore.js';
import { lf1Text, readingOf, sourceOf } from './test-fixtures/readingFixtures.js';
import { useReactRoot } from './test-fixtures/reactRoot.js';

/**
 * Coluna Produtos dentro da tela inteira: a escolha que leva ao Detalhe, a
 * selecao que acompanha o relatorio e a busca que nao o refaz.
 */

// O relatorio de verdade, contado: a busca nao pode refaze-lo a cada tecla.
vi.mock('./domain/services/inventoryReport.js', async (importOriginal) => {
  const original = await importOriginal();

  return { ...original, buildInventoryReport: vi.fn(original.buildInventoryReport) };
});

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
});

const SESSION = { id: 'sessao-teste', name: 'Inventário 02/10/2026' };

afterEach(() => {
  vi.unstubAllGlobals();
});

const VALUE_SETTER = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

async function typeInto(input, value) {
  await act(async () => {
    VALUE_SETTER.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function productRow(code) {
  return column('produtos').querySelector(`tr[data-produto="${CSS.escape(code)}"]`);
}

function tableCodes() {
  return [...column('produtos').querySelectorAll('tbody tr')].map((row) => row.dataset.produto);
}

function detailTitle() {
  return column('detalhe').querySelector('h3');
}

/** Tela larga a partir do ponto de corte, como o `matchMedia` do navegador responde. */
function stubScreen(wide) {
  vi.stubGlobal('matchMedia', (query) => ({ matches: wide, media: query }));
}

const priced = (code, price, copy, name = `PRODUTO ${code}`) =>
  lf1Text({ systemCode: code, displayName: name, price, copy });

function column(name) {
  return view.container.querySelector(`[data-vista="${name}"]`);
}

function viewRadio(label) {
  return [...view.container.querySelectorAll('nav input[type="radio"]')].find(
    (radio) => radio.labels[0].textContent === label,
  );
}

function openSessionWith(readings, sources = [sourceOf('f1')]) {
  useSessionStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION.id,
    sources,
    readings,
    resolutions: [],
  });
}

describe('App com a coluna Produtos', () => {
  it('leva o produto escolhido ao Detalhe e, na tela estreita, troca a vista e o foco', async () => {
    openSessionWith([
      readingOf('l1', 'f1', priced('A-1', 1099, 'c1', 'Café Torrado 500g')),
      readingOf('l2', 'f1', priced('B-2', 500, 'c1')),
    ]);

    await view.render(<App />);
    await view.click(viewRadio('Produtos'));
    await view.focus(productRow('A-1').querySelector('button'));
    await view.click(productRow('A-1').querySelector('button'));

    expect(column('detalhe').hasAttribute('data-vista-ativa')).toBe(true);
    expect(viewRadio('Detalhe').checked).toBe(true);
    expect(detailTitle().textContent).toBe('Café Torrado 500g');
    expect(column('detalhe').textContent).toContain('Código A-1');
    expect(document.activeElement).toBe(detailTitle());
    expect(productRow('A-1').querySelector('button').getAttribute('aria-current')).toBe('true');

    await view.click(viewRadio('Produtos'));
    await view.click(productRow('B-2').querySelectorAll('td')[3]);

    expect(detailTitle().textContent).toBe('PRODUTO B-2');
    expect(productRow('A-1').querySelector('button').hasAttribute('aria-current')).toBe(false);
  });

  it('deixa o foco na tabela quando a tela é larga', async () => {
    stubScreen(true);
    openSessionWith([readingOf('l1', 'f1', priced('A-1', 1099, 'c1'))]);

    await view.render(<App />);

    const button = productRow('A-1').querySelector('button');

    await view.focus(button);
    await view.click(button);

    expect(detailTitle().textContent).toBe('PRODUTO A-1');
    expect(document.activeElement).toBe(button);
  });

  it('desfaz a seleção quando o produto sai do relatório ou outra sessão abre', async () => {
    openSessionWith(
      [
        readingOf('l1', 'f1', priced('A-1', 1000, 'c1')),
        readingOf('l2', 'f2', priced('B-2', 1000, 'c1')),
      ],
      [sourceOf('f1'), sourceOf('f2')],
    );

    await view.render(<App />);
    await view.click(productRow('B-2').querySelector('button'));

    expect(detailTitle().textContent).toBe('PRODUTO B-2');

    await view.update(() => {
      useSessionStore.setState({
        sources: [sourceOf('f1')],
        readings: useSessionStore
          .getState()
          .readings.filter((reading) => reading.sourceId === 'f1'),
      });
    });

    expect(detailTitle()).toBeNull();
    expect(column('detalhe').textContent).toContain('Nenhum produto selecionado.');

    await view.update(() => {
      useSessionStore.setState({
        sources: [sourceOf('f1'), sourceOf('f2')],
        readings: [
          ...useSessionStore.getState().readings,
          readingOf('l2', 'f2', priced('B-2', 1000, 'c1')),
        ],
      });
    });

    expect(productRow('B-2')).toBeTruthy();
    expect(detailTitle()).toBeNull();

    await view.click(productRow('A-1').querySelector('button'));
    await view.update(() => {
      useSessionStore.setState({
        sessions: [SESSION, { id: 'outra', name: 'Outra' }],
        currentSessionId: 'outra',
      });
    });

    expect(productRow('A-1')).toBeTruthy();
    expect(detailTitle()).toBeNull();
  });

  it('busca na coluna Produtos sem refazer o relatório e limpa o termo na troca de sessão', async () => {
    openSessionWith([
      readingOf('l1', 'f1', priced('A-1', 1099, 'c1', 'Café Torrado 500g')),
      readingOf('l2', 'f1', priced('B-2', 500, 'c1', 'ARROZ BRANCO 5KG')),
    ]);

    await view.render(<App />);

    const calls = buildInventoryReport.mock.calls.length;
    const search = column('produtos').querySelector('input');

    await typeInto(search, 'c');
    await typeInto(search, 'CAF');
    await typeInto(search, 'cafe');

    expect(tableCodes()).toEqual(['A-1']);
    expect(buildInventoryReport.mock.calls.length).toBe(calls);

    await view.update(() => {
      useSessionStore.setState({
        sessions: [SESSION, { id: 'outra', name: 'Outra' }],
        currentSessionId: 'outra',
      });
    });

    expect(column('produtos').querySelector('input').value).toBe('');
    expect(tableCodes()).toEqual(['A-1', 'B-2']);
  });
});
