// @vitest-environment jsdom

import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SessionDialog from './SessionDialog.jsx';

const initialCapture = useCaptureStore.getState();
const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => {
    useCaptureStore.setState(initialCapture, true);
    useSessionStore.setState(initialSession, true);
  },
});

const LOJA = { id: 's-loja', name: 'Loja', updatedAt: '2026-10-02T15:00:00.000Z' };
const DEPOSITO = { id: 's-deposito', name: 'Depósito', updatedAt: '2026-10-01T15:00:00.000Z' };

let actions;

/** Acoes do store simuladas, que mudam o estado como as de verdade. */
function storeActions() {
  return {
    selectSession: vi.fn(async (id) => useSessionStore.setState({ currentSessionId: id })),
    createSession: vi.fn(async () => {
      const created = { id: 's-nova', name: 'Inventário 02/10/2026 16:00', updatedAt: 'x' };

      useSessionStore.setState({
        sessions: [created, ...useSessionStore.getState().sessions],
        currentSessionId: created.id,
      });
    }),
    renameSession: vi.fn(async (id, name) => {
      useSessionStore.setState({
        sessions: useSessionStore
          .getState()
          .sessions.map((session) => (session.id === id ? { ...session, name } : session)),
      });
    }),
    deleteSession: vi.fn(async (id) => {
      const sessions = useSessionStore.getState().sessions.filter((session) => session.id !== id);

      useSessionStore.setState({
        sessions,
        currentSessionId:
          useSessionStore.getState().currentSessionId === id
            ? sessions[0].id
            : useSessionStore.getState().currentSessionId,
      });
    }),
  };
}

/** O dialogo aberto por um gatilho de verdade, como o botao Sessoes. */
function WithTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Sessões
      </button>
      {open ? <SessionDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function dialog() {
  return document.querySelector('[role="dialog"]');
}

function button(label) {
  return [...document.querySelectorAll('[role="dialog"] button')].find(
    (item) => item.getAttribute('aria-label') === label || item.textContent === label,
  );
}

function row(id) {
  return dialog().querySelector(`[data-sessao="${id}"]`);
}

async function open() {
  await view.render(<WithTrigger />);

  const trigger = view.container.querySelector('button');

  await view.focus(trigger);
  await view.click(trigger);

  return trigger;
}

beforeEach(() => {
  actions = storeActions();
  useSessionStore.setState({
    sessions: [LOJA, DEPOSITO],
    currentSessionId: LOJA.id,
    isLoading: false,
    ...actions,
  });
});

describe('SessionDialog', () => {
  it('lista as sessões da alterada por último à mais antiga, com a aberta marcada', async () => {
    await open();

    expect(dialog().querySelector('h2').textContent).toBe('Sessões');
    expect(
      [...dialog().querySelectorAll('[data-sessao]')].map((item) =>
        item.getAttribute('data-sessao'),
      ),
    ).toEqual(['s-loja', 's-deposito']);
    expect(row('s-loja').textContent).toContain('Aberta');
    expect(row('s-deposito').textContent).toContain('Abrir');
  });

  it('abre outra sessão, fecha e devolve o foco ao gatilho', async () => {
    const trigger = await open();

    await view.click(button('Abrir'));

    expect(actions.selectSession).toHaveBeenCalledWith('s-deposito');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('cria uma sessão nova pelo rodapé e fecha', async () => {
    await open();
    await view.click(button('Nova sessão'));

    expect(actions.createSession).toHaveBeenCalledWith();
    expect(useSessionStore.getState().currentSessionId).toBe('s-nova');
    expect(dialog()).toBeNull();
  });

  it('mostra a falha ao criar e continua aberto', async () => {
    useSessionStore.setState({ createSession: vi.fn(async () => Promise.reject(new Error('x'))) });

    await open();
    await view.click(button('Nova sessão'));

    expect(dialog().querySelector('[role="alert"]').textContent).toBe(
      'Não foi possível abrir uma sessão nova neste aparelho. Recarregue a página e tente de novo.',
    );
  });

  it('renomeia na linha, sem fechar o diálogo', async () => {
    await open();
    await view.click(button('Renomear Depósito'));

    const input = dialog().querySelector('input');

    await view.update(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
        input,
        'Depósito norte',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await view.click(button('Salvar nome'));

    expect(actions.renameSession).toHaveBeenCalledWith('s-deposito', 'Depósito norte');
    expect(row('s-deposito').textContent).toContain('Depósito norte');
    expect(dialog()).not.toBeNull();
  });

  it('pergunta antes de apagar, no mesmo diálogo, com o foco no cancelar', async () => {
    await open();
    await view.click(button('Apagar Depósito'));

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(dialog().querySelector('h2').textContent).toBe('Apagar sessão');
    expect(dialog().textContent).toContain('Depósito');
    expect(dialog().textContent).toContain('Não há como trazê-la de volta.');
    expect(dialog().textContent).not.toContain('Ela é a sessão aberta');
    expect(document.activeElement).toBe(button('Cancelar'));
    expect(actions.deleteSession).not.toHaveBeenCalled();
  });

  it('volta à lista pelo cancelar, com o foco no apagar da mesma sessão', async () => {
    await open();
    await view.click(button('Apagar Depósito'));
    await view.click(button('Cancelar'));

    expect(dialog().querySelector('h2').textContent).toBe('Sessões');
    expect(document.activeElement).toBe(button('Apagar Depósito'));
    expect(actions.deleteSession).not.toHaveBeenCalled();
  });

  it('apaga a sessão aberta depois da confirmação e volta à lista com o foco nela', async () => {
    await open();
    await view.click(button('Apagar Loja'));

    expect(dialog().textContent).toContain('Ela é a sessão aberta');

    await view.click(button('Apagar sessão'));

    expect(actions.deleteSession).toHaveBeenCalledWith('s-loja');
    expect(dialog().querySelector('h2').textContent).toBe('Sessões');
    expect(row('s-loja')).toBeNull();
    expect(row('s-deposito').textContent).toContain('Aberta');
    expect(document.activeElement).toBe(dialog().querySelector('[data-lista-sessoes]'));
  });

  it('mantém a pergunta com o aviso quando apagar falha', async () => {
    useSessionStore.setState({
      deleteSession: vi.fn(async () => {
        throw Object.assign(new Error('x'), { name: 'AbortError' });
      }),
    });

    await open();
    await view.click(button('Apagar Depósito'));
    await view.click(button('Apagar sessão'));

    expect(dialog().querySelector('[role="alert"]').textContent).toBe(
      'A gravação foi interrompida antes de terminar. Tente de novo.',
    );
    expect(button('Tentar de novo').disabled).toBe(false);
  });

  it('fecha com Esc também na pergunta, e devolve o foco ao gatilho', async () => {
    const trigger = await open();

    await view.click(button('Apagar Depósito'));
    await view.press('Escape');

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('desliga abrir, apagar e criar com a fila andando, e deixa renomear', async () => {
    useCaptureStore.setState({ isRunning: true });

    await open();

    expect(button('Abrir').disabled).toBe(true);
    expect(button('Apagar Loja').disabled).toBe(true);
    expect(button('Nova sessão').disabled).toBe(true);
    expect(button('Renomear Loja').disabled).toBe(false);
    expect(dialog().textContent).toContain('Com fotos na fila');

    await view.update(() => {
      useCaptureStore.setState({ isRunning: false });
      useSessionStore.setState({ isLoading: true });
    });

    expect(button('Nova sessão').disabled).toBe(true);
  });

  it('ocupa a janela menos a margem na tela estreita', async () => {
    await open();

    expect(dialog().className).toContain('max-lg:!w-[calc(100dvw-32px)]');
  });
});
