// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { APP_NAME } from './lib/app-meta.js';
import { useSessionStore } from './store/useSessionStore.js';
import { lf1Text, readingOf, sourceOf } from './test-fixtures/readingFixtures.js';
import { useReactRoot } from './test-fixtures/reactRoot.js';

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
});

const SESSION = { id: 'sessao-teste', name: 'Inventário 02/10/2026' };

afterEach(() => {
  vi.restoreAllMocks();
});

function column(name) {
  return view.container.querySelector(`[data-vista="${name}"]`);
}

function statusValue(name) {
  return view.container.querySelector(`[data-status="${name}"] dd`).textContent;
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

describe('App', () => {
  it('mostra o nome do produto como único título de primeiro nível', async () => {
    await view.render(<App />);

    const titles = view.container.querySelectorAll('h1');

    expect(titles).toHaveLength(1);
    expect(titles[0].textContent).toBe(APP_NAME);
  });

  it('monta as colunas Entrada, Produtos e Detalhe com a linha de estado', async () => {
    await view.render(<App />);

    const columns = [...view.container.querySelectorAll('main section[aria-label]')]
      .filter((section) => section.querySelector(':scope > div > h2'))
      .map((section) => section.getAttribute('aria-label'));

    expect(columns).toEqual(['Entrada', 'Produtos', 'Detalhe']);
    expect(view.container.querySelector('footer[aria-label="Resumo da sessão"]')).toBeTruthy();
  });

  it('põe a sessão, a entrada de fotos, o aviso do aparelho e a fila na coluna Entrada', async () => {
    await view.render(<App />);

    const intake = column('entrada');
    const titles = [...intake.querySelectorAll('h3')].map((title) => title.textContent);
    const pickers = [...intake.querySelectorAll('input[type="file"]')].map(
      (input) => input.labels[0].textContent,
    );

    expect(titles).toEqual(['Sessão aberta', 'Fotos das etiquetas', 'Fila de fotos']);
    expect(pickers).toEqual(['Fotografar', 'Enviar fotos']);
    expect(intake.querySelector('[data-aviso-aparelho]').textContent).toContain(
      'Tudo roda neste aparelho',
    );
    expect(intake.textContent).toContain('Nenhuma foto neste lote.');
    expect(intake.querySelector('[data-corpo]').className).toContain('overflow-y-auto');
  });

  it('abre na vista Entrada e troca de coluna pela barra de vistas', async () => {
    await view.render(<App />);

    expect(column('entrada').hasAttribute('data-vista-ativa')).toBe(true);
    expect(viewRadio('Entrada').checked).toBe(true);

    await view.click(viewRadio('Produtos'));

    expect(column('produtos').hasAttribute('data-vista-ativa')).toBe(true);
    expect(column('entrada').className).toMatch(/(^| )hidden( |$)/);

    await view.focus(viewRadio('Produtos'));
    await view.press('ArrowRight');

    expect(column('detalhe').hasAttribute('data-vista-ativa')).toBe(true);
    expect(viewRadio('Detalhe').checked).toBe(true);
    expect(document.activeElement).toBe(viewRadio('Detalhe'));
  });

  it('mostra zero na linha de estado sem sessão aberta', async () => {
    await view.render(<App />);

    expect(statusValue('fotos')).toBe('0');
    expect(statusValue('produtos')).toBe('0');
    expect(column('produtos').textContent).toContain('Nenhum produto lido nesta sessão.');
    expect(column('detalhe').textContent).toContain('Nenhum produto selecionado.');
  });

  it('acompanha o relatório da sessão aberta na linha de estado e na coluna Produtos', async () => {
    const text = (code, price, copy) =>
      lf1Text({ systemCode: code, displayName: `PRODUTO ${code}`, price, copy });

    openSessionWith([
      readingOf('l1', 'f1', text('A-1', 1099, 'c1')),
      readingOf('l2', 'f1', text('A-1', 1099, 'c2')),
      readingOf('l3', 'f1', text('B-2', 500, 'c1')),
    ]);

    await view.render(<App />);

    expect(statusValue('fotos')).toBe('1');
    expect(statusValue('exemplares')).toBe('3');
    expect(statusValue('produtos')).toBe('2');
    expect(statusValue('valor')).toBe('R$ 26,98');
    expect(statusValue('conflitos')).toBe('0');
    expect(column('produtos').textContent).toContain('2 produtos lidos nesta sessão.');

    await view.update(() => {
      useSessionStore.setState({
        readings: [
          ...useSessionStore.getState().readings,
          readingOf('l4', 'f1', text('B-2', 650, 'c2')),
        ],
      });
    });

    expect(statusValue('exemplares')).toBe('4');
    expect(statusValue('conflitos')).toBe('1');
    expect(statusValue('valor')).toBe('—');
  });

  it('monta a tela sem nenhuma chamada de rede', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await view.render(<App />);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
