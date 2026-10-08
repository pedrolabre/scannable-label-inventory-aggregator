// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ClearSourcesDialog, { useCanClearSources } from './ClearSourcesDialog.jsx';

const initialCapture = useCaptureStore.getState();
const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => {
    useCaptureStore.setState(initialCapture, true);
    useSessionStore.setState(initialSession, true);
  },
});

const SESSION = { id: 'sessao-1', name: 'Loja centro' };

function source(id) {
  return { id, sessionId: SESSION.id, fileName: `${id}.jpg`, status: 'read' };
}

function reading(id, sourceId) {
  return { id, sessionId: SESSION.id, sourceId, text: `LF1|A-${id}|NOME|100|||c1` };
}

const SOURCES = [source('f1'), source('f2')];
const READINGS = [reading('l1', 'f1'), reading('l2', 'f1'), reading('l3', 'f2')];
const RESOLUTIONS = [{ sessionId: SESSION.id, systemCode: 'A', choices: { ean: null } }];

function dialog() {
  return document.querySelector('[role="dialog"]');
}

function buttonNamed(name) {
  return [...document.querySelectorAll('button')].find((button) => button.textContent === name);
}

function countText() {
  return dialog().querySelector('[data-limpeza-contagem]').textContent;
}

beforeEach(() => {
  useSessionStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION.id,
    sources: SOURCES,
    readings: READINGS,
    resolutions: RESOLUTIONS,
    isLoading: false,
    clearSessionSources: vi.fn(async () => {
      useSessionStore.setState({ sources: [], readings: [], resolutions: [] });
    }),
  });
  useCaptureStore.setState({ items: [], isRunning: false, clearBatch: vi.fn(() => true) });
});

describe('ClearSourcesDialog', () => {
  it('pergunta com o nome da sessão e diz o que sai, com as contagens', async () => {
    await view.render(<ClearSourcesDialog onClose={vi.fn()} onCleared={vi.fn()} />);

    expect(dialog().querySelector('h2').textContent).toBe('Limpar fotos');
    expect(dialog().textContent).toContain('Loja centro');
    expect(countText()).toBe(
      'A limpeza apaga desta sessão 2 fotos gravadas, 3 textos lidos e 1 escolha de conflito.',
    );
    expect(dialog().textContent).toContain('Esta limpeza não pode ser desfeita.');
    expect(buttonNamed('Limpar fotos').className).toContain('bg-marca-vermelhoTenue');
  });

  it('cita o lote quando ele tem fotos, e só a foto quando não há texto nem escolha', async () => {
    useSessionStore.setState({ sources: [SOURCES[0]], readings: [], resolutions: [] });
    useCaptureStore.setState({ items: [{ id: 1 }] });

    await view.render(<ClearSourcesDialog onClose={vi.fn()} onCleared={vi.fn()} />);

    expect(countText()).toBe(
      'A limpeza apaga desta sessão 1 foto gravada. A fila de fotos também é esvaziada.',
    );
  });

  it('com só o lote, não toca no banco e esvazia a lista', async () => {
    useSessionStore.setState({ sources: [], readings: [], resolutions: [] });
    useCaptureStore.setState({ items: [{ id: 1 }] });

    const onCleared = vi.fn();

    await view.render(<ClearSourcesDialog onClose={vi.fn()} onCleared={onCleared} />);

    expect(countText()).toBe(
      'Nenhuma foto está gravada nesta sessão. A fila de fotos também é esvaziada.',
    );

    await view.click(buttonNamed('Limpar fotos'));

    expect(useSessionStore.getState().clearSessionSources).not.toHaveBeenCalled();
    expect(useCaptureStore.getState().clearBatch).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('confirmar limpa a sessão aberta, depois o lote, e avisa o fim', async () => {
    const order = [];
    const onCleared = vi.fn(() => order.push('fim'));

    useSessionStore.setState({
      clearSessionSources: vi.fn(async () => order.push('banco')),
    });
    useCaptureStore.setState({ clearBatch: vi.fn(() => order.push('lote')) });

    await view.render(<ClearSourcesDialog onClose={vi.fn()} onCleared={onCleared} />);
    await view.click(buttonNamed('Limpar fotos'));

    expect(useSessionStore.getState().clearSessionSources).toHaveBeenCalledWith(SESSION.id);
    expect(order).toEqual(['banco', 'lote', 'fim']);
  });

  it('com falha no banco, fica aberto com o aviso, não esvazia o lote e tenta de novo', async () => {
    const onCleared = vi.fn();
    const falha = Object.assign(new Error('falhou'), { name: 'QuotaExceededError' });

    useSessionStore.setState({ clearSessionSources: vi.fn().mockRejectedValueOnce(falha) });

    await view.render(<ClearSourcesDialog onClose={vi.fn()} onCleared={onCleared} />);
    await view.click(buttonNamed('Limpar fotos'));

    expect(dialog()).toBeTruthy();
    expect(dialog().querySelector('[role="alert"]')).toBeTruthy();
    expect(useCaptureStore.getState().clearBatch).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();

    await view.click(buttonNamed('Tentar de novo'));

    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('cancelar fecha sem apagar', async () => {
    const onClose = vi.fn();

    await view.render(<ClearSourcesDialog onClose={onClose} onCleared={vi.fn()} />);
    await view.click(buttonNamed('Cancelar'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().clearSessionSources).not.toHaveBeenCalled();
  });
});

describe('useCanClearSources', () => {
  function Probe() {
    return <p data-pode-limpar={String(useCanClearSources())} />;
  }

  async function canClear() {
    await view.render(<Probe />);

    return view.container.querySelector('[data-pode-limpar]').dataset.podeLimpar === 'true';
  }

  it('liga com foto gravada ou no lote, e desliga sem nenhuma', async () => {
    expect(await canClear()).toBe(true);

    await view.update(() => useSessionStore.setState({ sources: [] }));
    expect(await canClear()).toBe(false);

    await view.update(() => useCaptureStore.setState({ items: [{ id: 1 }] }));
    expect(await canClear()).toBe(true);
  });

  it('desliga com a fila andando, a sessão carregando ou sem sessão aberta', async () => {
    await view.update(() => useCaptureStore.setState({ isRunning: true }));
    expect(await canClear()).toBe(false);

    await view.update(() => {
      useCaptureStore.setState({ isRunning: false });
      useSessionStore.setState({ isLoading: true });
    });
    expect(await canClear()).toBe(false);

    await view.update(() => useSessionStore.setState({ isLoading: false, currentSessionId: null }));
    expect(await canClear()).toBe(false);
  });
});
