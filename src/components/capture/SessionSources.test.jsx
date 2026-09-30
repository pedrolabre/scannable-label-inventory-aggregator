// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SessionSources from './SessionSources.jsx';

const initialCapture = useCaptureStore.getState();
const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => {
    useCaptureStore.setState(initialCapture, true);
    useSessionStore.setState(initialSession, true);
  },
});

const SESSION = 'sessao-1';

function source(id, fileName) {
  return { id, sessionId: SESSION, fileName, status: 'read', width: 10, height: 10 };
}

function reading(id, sourceId) {
  return { id, sessionId: SESSION, sourceId, text: `LF1|A-${id}|NOME|100|||c1` };
}

const SOURCES = [
  source('f1', 'foto-1.jpg'),
  source('f2', 'foto-2.jpg'),
  source('f3', 'foto-3.jpg'),
];
const READINGS = [reading('l1', 'f1'), reading('l2', 'f2'), reading('l3', 'f2')];

function dialog() {
  return document.querySelector('[role="dialog"]');
}

function removeButton(sourceId) {
  return view.container.querySelector(`[data-fonte="${sourceId}"] [data-remover]`);
}

function buttonNamed(name) {
  return [...document.querySelectorAll('button')].find((button) => button.textContent === name);
}

/** Remocao como o store faz: tira a foto e as leituras dela do conteudo. */
function removingStore() {
  return vi.fn(async (sessionId, sourceId) => {
    const state = useSessionStore.getState();

    useSessionStore.setState({
      sources: state.sources.filter((item) => item.id !== sourceId),
      readings: state.readings.filter((item) => item.sourceId !== sourceId),
    });
  });
}

beforeEach(() => {
  useSessionStore.setState({
    currentSessionId: SESSION,
    sources: SOURCES,
    readings: READINGS,
    removeSource: removingStore(),
  });
});

async function askRemoval(sourceId) {
  const trigger = removeButton(sourceId);

  await view.focus(trigger);
  await view.click(trigger);

  return trigger;
}

describe('SessionSources', () => {
  it('lista as fotos gravadas na sessão aberta, lidas do store', async () => {
    await view.render(<SessionSources />);

    expect(view.container.querySelector('h3').textContent).toBe('Fotos da sessão');
    expect(view.container.textContent).toContain('3 fotos gravadas nesta sessão.');
    expect(
      [...view.container.querySelectorAll('ul[aria-label="Fotos gravadas na sessão"] > li')].map(
        (li) => li.getAttribute('data-fonte'),
      ),
    ).toEqual(['f1', 'f2', 'f3']);
  });

  it('diz que a sessão não tem foto gravada', async () => {
    useSessionStore.setState({ sources: [], readings: [] });

    await view.render(<SessionSources />);

    expect(view.container.textContent).toContain('Nenhuma foto gravada nesta sessão.');
    expect(view.container.querySelector('ul')).toBeNull();
  });

  it('pergunta antes de remover, com o nome da foto e quantos textos saem', async () => {
    await view.render(<SessionSources />);
    await askRemoval('f2');

    expect(dialog().querySelector('h2').textContent).toBe('Remover foto');
    expect(dialog().textContent).toContain('foto-2.jpg');
    expect(dialog().textContent).toContain('2 textos lidos nela');
    expect(useSessionStore.getState().removeSource).not.toHaveBeenCalled();
  });

  it('remove pela ação do store e leva o foco ao remover da foto seguinte', async () => {
    await view.render(<SessionSources />);
    await askRemoval('f2');
    await view.click(buttonNamed('Remover foto'));

    expect(useSessionStore.getState().removeSource).toHaveBeenCalledWith(SESSION, 'f2');
    expect(dialog()).toBeNull();
    expect(view.container.querySelector('[data-fonte="f2"]')).toBeNull();
    expect(view.container.textContent).toContain('2 fotos gravadas nesta sessão.');
    expect(document.activeElement).toBe(removeButton('f3'));
  });

  it('leva o foco à foto anterior na última da lista, e ao título quando a lista esvazia', async () => {
    useSessionStore.setState({ sources: SOURCES.slice(0, 2) });

    await view.render(<SessionSources />);
    await askRemoval('f2');
    await view.click(buttonNamed('Remover foto'));

    expect(document.activeElement).toBe(removeButton('f1'));

    await askRemoval('f1');
    await view.click(buttonNamed('Remover foto'));

    expect(document.activeElement).toBe(view.container.querySelector('h3'));
    expect(view.container.textContent).toContain('Nenhuma foto gravada nesta sessão.');
  });

  it('mantém a pergunta aberta com o aviso quando a remoção falha', async () => {
    useSessionStore.setState({
      removeSource: vi.fn(async () => {
        throw Object.assign(new Error('x'), { name: 'MissingSourceError' });
      }),
    });

    await view.render(<SessionSources />);
    await askRemoval('f1');
    await view.click(buttonNamed('Remover foto'));

    expect(dialog().querySelector('[role="alert"]').textContent).toBe(
      'A foto não existe mais nesta sessão. Envie a foto de novo.',
    );
    expect(buttonNamed('Tentar de novo')).toBeTruthy();
  });

  it('cancela pelo Esc sem remover e devolve o foco ao botão da foto', async () => {
    await view.render(<SessionSources />);

    const trigger = await askRemoval('f1');

    await view.press('Escape');

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(useSessionStore.getState().removeSource).not.toHaveBeenCalled();
  });

  it('desliga a remoção com a fila andando ou com a sessão carregando', async () => {
    useCaptureStore.setState({ isRunning: true });

    await view.render(<SessionSources />);

    expect(removeButton('f1').disabled).toBe(true);
    expect(view.container.textContent).toContain(
      'Remover foto fica desligado até a fila terminar.',
    );

    await view.update(() => {
      useCaptureStore.setState({ isRunning: false });
      useSessionStore.setState({ isLoading: true });
    });

    expect(removeButton('f1').disabled).toBe(true);

    await view.update(() => useSessionStore.setState({ isLoading: false }));

    expect(removeButton('f1').disabled).toBe(false);
  });
});
