// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SessionPicker from './SessionPicker.jsx';

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
});

const SESSION = { id: 'sessao-1', name: 'Inventário 02/10/2026 09:05' };

function sessionsButton() {
  return [...view.container.querySelectorAll('button')].find(
    (button) => button.textContent === 'Sessões',
  );
}

beforeEach(() => {
  useSessionStore.setState({ sessions: [SESSION], currentSessionId: SESSION.id });
});

describe('SessionPicker', () => {
  it('mostra o nome da sessão aberta e abre o diálogo pelo botão Sessões', async () => {
    const onOpenSessions = vi.fn();

    await view.render(<SessionPicker onOpenSessions={onOpenSessions} />);

    expect(view.container.querySelector('h3').textContent).toBe('Sessão aberta');
    expect(view.container.querySelector('[data-sessao-aberta]').textContent).toBe(SESSION.name);
    expect(sessionsButton().className).toContain('h-controle');

    await view.click(sessionsButton());

    expect(onOpenSessions).toHaveBeenCalledTimes(1);
  });

  it('acompanha a troca de nome e de sessão no store', async () => {
    await view.render(<SessionPicker onOpenSessions={vi.fn()} />);
    await view.update(() =>
      useSessionStore.setState({ sessions: [{ ...SESSION, name: '<b>Depósito</b>' }] }),
    );

    const name = view.container.querySelector('[data-sessao-aberta]');

    expect(name.textContent).toBe('<b>Depósito</b>');
    expect(name.querySelector('b')).toBeNull();

    await view.update(() => useSessionStore.setState({ currentSessionId: null, isLoading: true }));

    expect(name.textContent).toBe('Abrindo a sessão salva neste aparelho…');
  });

  it('mostra a falha ao abrir as sessões', async () => {
    useSessionStore.setState({
      loadError: 'O armazenamento deste dispositivo não respondeu à leitura.',
    });

    await view.render(<SessionPicker onOpenSessions={vi.fn()} />);

    expect(view.container.querySelector('[role="alert"]').textContent).toBe(
      'O armazenamento deste dispositivo não respondeu à leitura.',
    );
  });
});
