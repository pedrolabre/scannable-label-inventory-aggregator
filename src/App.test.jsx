// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { APP_NAME } from './lib/app-meta.js';
import { announceUpdate, resetUpdateState } from './pwa/updateState.js';
import { useSessionStore } from './store/useSessionStore.js';
import { lf1Text, readingOf, sourceOf } from './test-fixtures/readingFixtures.js';
import { useReactRoot } from './test-fixtures/reactRoot.js';

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => {
    useSessionStore.setState(initialSession, true);
    resetUpdateState();
  },
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

function productRow(code) {
  return column('produtos').querySelector(`tr[data-produto="${CSS.escape(code)}"]`);
}

function tableCodes() {
  return [...column('produtos').querySelectorAll('tbody tr')].map((row) => row.dataset.produto);
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
      .filter((section) => section.querySelector(':scope > div:first-child h2'))
      .map((section) => section.getAttribute('aria-label'));

    expect(columns).toEqual(['Entrada', 'Produtos', 'Detalhe']);
    expect(view.container.querySelector('footer[aria-label="Resumo da sessão"]')).toBeTruthy();
  });

  it('põe a sessão, a entrada de fotos, o aviso do aparelho, o lote e as fotos da sessão na coluna Entrada', async () => {
    await view.render(<App />);

    const intake = column('entrada');
    const titles = [...intake.querySelectorAll('h3')].map((title) => title.textContent);
    const pickers = [...intake.querySelectorAll('input[type="file"]')].map(
      (input) => input.labels[0].textContent,
    );

    expect(titles).toEqual([
      'Sessão aberta',
      'Fotos das etiquetas',
      'Fila de fotos',
      'Fotos da sessão',
    ]);
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
    expect(tableCodes()).toEqual(['A-1', 'B-2']);
    expect(productRow('A-1').textContent).toBe('A-1PRODUTO A-1R$ 10,992R$ 21,98');

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
    expect(productRow('B-2').querySelector('[data-marca="conflict"]').textContent).toBe(
      'conflito em preço',
    );
  });

  it('monta a tela sem nenhuma chamada de rede', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await view.render(<App />);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('abre o diálogo de sessões pela Entrada, um por vez, e o Esc devolve o foco ao botão', async () => {
    openSessionWith([]);

    await view.render(<App />);

    const trigger = [...column('entrada').querySelectorAll('button')].find(
      (button) => button.textContent === 'Sessões',
    );

    await view.focus(trigger);
    await view.click(trigger);

    const dialogs = document.querySelectorAll('[role="dialog"]');

    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].querySelector('h2').textContent).toBe('Sessões');
    expect(document.activeElement.getAttribute('aria-label')).toBe('Fechar');

    await view.press('Escape');

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('refaz a linha de estado e a coluna Produtos na hora em que uma foto sai da sessão', async () => {
    const text = (code, copy) =>
      lf1Text({ systemCode: code, displayName: `PRODUTO ${code}`, price: 1000, copy });

    openSessionWith(
      [
        readingOf('l1', 'f1', text('A-1', 'c1')),
        readingOf('l2', 'f2', text('B-2', 'c1')),
        readingOf('l3', 'f2', text('B-2', 'c2')),
      ],
      [sourceOf('f1'), sourceOf('f2')],
    );
    useSessionStore.setState({
      removeSource: vi.fn(async (sessionId, sourceId) => {
        const state = useSessionStore.getState();

        useSessionStore.setState({
          sources: state.sources.filter((source) => source.id !== sourceId),
          readings: state.readings.filter((reading) => reading.sourceId !== sourceId),
        });
      }),
    });

    await view.render(<App />);

    expect(statusValue('fotos')).toBe('2');
    expect(statusValue('exemplares')).toBe('3');

    await view.click(column('entrada').querySelector('[data-fonte="f2"] [data-remover]'));
    await view.click(
      [...document.querySelectorAll('[role="dialog"] button')].find(
        (button) => button.textContent === 'Remover foto',
      ),
    );

    expect(statusValue('fotos')).toBe('1');
    expect(statusValue('exemplares')).toBe('1');
    expect(statusValue('produtos')).toBe('1');
    expect(statusValue('valor')).toBe('R$ 10,00');
    expect(tableCodes()).toEqual(['A-1']);
  });

  it('mostra a versão nova numa faixa entre o cabeçalho e as colunas, sem recarregar', async () => {
    const apply = vi.fn();

    await view.render(<App />);

    expect(view.container.querySelector('section[aria-label="Versão nova"]')).toBeNull();

    await view.update(() => announceUpdate(apply));

    const band = view.container.querySelector('section[aria-label="Versão nova"]');
    const region = band.closest('[data-aviso-versao]');

    expect(region.previousElementSibling.tagName).toBe('HEADER');
    expect(region.nextElementSibling.tagName).toBe('MAIN');
    expect(band.textContent).toContain('Versão nova disponível.');
    expect(apply).not.toHaveBeenCalled();
  });
});
