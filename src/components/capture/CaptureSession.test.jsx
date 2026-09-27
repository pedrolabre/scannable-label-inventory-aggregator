// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import CaptureSession from './CaptureSession.jsx';

const view = useReactRoot();
const initialCapture = useCaptureStore.getState();
const initialSession = useSessionStore.getState();

const session = { id: 'sessao-1', name: 'Inventário 29/09/2026' };

function newSessionButton() {
  return [...view.container.querySelectorAll('button')].find(
    (button) => button.textContent === 'Nova sessão',
  );
}

beforeEach(() => {
  useSessionStore.setState({ sessions: [session], currentSessionId: session.id });
});

afterEach(() => {
  useCaptureStore.setState(initialCapture, true);
  useSessionStore.setState(initialSession, true);
});

describe('CaptureSession', () => {
  it('mostra o nome da sessão aberta e abre uma nova', async () => {
    const createSession = vi.fn(async () => ({}));

    useSessionStore.setState({ createSession });

    await view.render(<CaptureSession />);

    expect(view.container.textContent).toContain('Inventário 29/09/2026');

    await view.click(newSessionButton());

    expect(createSession).toHaveBeenCalledWith();
  });

  it('desliga a sessão nova com a fila andando ou com a sessão carregando', async () => {
    useCaptureStore.setState({ isRunning: true });
    await view.render(<CaptureSession />);

    expect(newSessionButton().disabled).toBe(true);

    await view.update(() => {
      useCaptureStore.setState({ isRunning: false });
      useSessionStore.setState({ isLoading: true, currentSessionId: null });
    });

    expect(newSessionButton().disabled).toBe(true);
    expect(view.container.textContent).toContain('Abrindo a sessão salva neste aparelho…');
  });

  it('mostra a falha ao abrir as sessões e ao criar uma nova', async () => {
    useSessionStore.setState({
      loadError: 'O armazenamento deste dispositivo não respondeu à leitura.',
      createSession: vi.fn(async () => Promise.reject(new Error('x'))),
    });

    await view.render(<CaptureSession />);
    await view.click(newSessionButton());

    const alerts = [...view.container.querySelectorAll('[role="alert"]')].map(
      (alert) => alert.textContent,
    );

    expect(alerts).toEqual([
      'O armazenamento deste dispositivo não respondeu à leitura.',
      'Não foi possível abrir uma sessão nova neste aparelho. Recarregue a página e tente de novo.',
    ]);
    expect(newSessionButton().disabled).toBe(false);
  });
});
