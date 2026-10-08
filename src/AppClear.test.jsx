// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { resetUpdateState } from './pwa/updateState.js';
import { useCaptureStore } from './store/useCaptureStore.js';
import { useSessionStore } from './store/useSessionStore.js';
import { lf1Text, readingOf, sourceOf } from './test-fixtures/readingFixtures.js';
import { useReactRoot } from './test-fixtures/reactRoot.js';

const initialSession = useSessionStore.getState();
const initialCapture = useCaptureStore.getState();
const view = useReactRoot({
  cleanup: () => {
    useSessionStore.setState(initialSession, true);
    useCaptureStore.setState(initialCapture, true);
    resetUpdateState();
  },
});

const SESSION = { id: 'sessao-teste', name: 'Inventário 08/10/2026' };
const LABEL = lf1Text({ systemCode: 'A1', displayName: 'MESA', price: 100 });

afterEach(() => {
  vi.restoreAllMocks();
});

function clearTrigger() {
  return view.container.querySelector('[data-gatilho-limpar]');
}

function exportTrigger() {
  return view.container.querySelector('[data-gatilho-exportar]');
}

function dialog() {
  return document.querySelector('[role="dialog"]');
}

function buttonNamed(name) {
  return [...dialog().querySelectorAll('button')].find((button) => button.textContent === name);
}

function openSession(sources, readings) {
  useSessionStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION.id,
    sources,
    readings,
    resolutions: [],
    clearSessionSources: vi.fn(async () => {
      useSessionStore.setState({ sources: [], readings: [], resolutions: [] });
    }),
  });
}

describe('App, limpeza das fotos', () => {
  it('deixa Limpar fotos desligado sem foto e ligado com foto na sessão', async () => {
    openSession([], []);

    await view.render(<App />);

    expect(clearTrigger().disabled).toBe(true);
    expect(clearTrigger().nextElementSibling).toBe(exportTrigger());

    await view.update(() =>
      useSessionStore.setState({
        sources: [sourceOf('f1')],
        readings: [readingOf('l1', 'f1', LABEL)],
      }),
    );

    expect(clearTrigger().disabled).toBe(false);
  });

  it('pergunta antes, limpa a sessão aberta e devolve o foco para Exportar', async () => {
    openSession([sourceOf('f1')], [readingOf('l1', 'f1', LABEL)]);

    await view.render(<App />);
    await view.focus(clearTrigger());
    await view.click(clearTrigger());

    expect(dialog().querySelector('h2').textContent).toBe('Limpar fotos');
    expect(useSessionStore.getState().clearSessionSources).not.toHaveBeenCalled();
    expect(view.container.querySelector('tr[data-produto="A1"]')).toBeTruthy();

    await view.click(buttonNamed('Limpar fotos'));

    expect(useSessionStore.getState().clearSessionSources).toHaveBeenCalledWith(SESSION.id);
    expect(dialog()).toBeNull();
    expect(clearTrigger().disabled).toBe(true);
    expect(view.container.querySelector('tr[data-produto]')).toBeNull();
    expect(document.activeElement).toBe(exportTrigger());
  });

  it('cancelar mantém as fotos e devolve o foco ao gatilho', async () => {
    openSession([sourceOf('f1')], [readingOf('l1', 'f1', LABEL)]);

    await view.render(<App />);
    await view.focus(clearTrigger());
    await view.click(clearTrigger());
    await view.click(buttonNamed('Cancelar'));

    expect(dialog()).toBeNull();
    expect(useSessionStore.getState().sources).toHaveLength(1);
    expect(document.activeElement).toBe(clearTrigger());
  });
});
