// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ConfirmModal from './ConfirmModal.jsx';

const view = useReactRoot();

function dialog() {
  return view.container.querySelector('[role="dialog"]');
}

function buttonNamed(name) {
  return [...view.container.querySelectorAll('button')].find(
    (button) => button.textContent === name,
  );
}

/** Gatilho e pergunta, com a confirmacao que pode falhar como no uso real. */
function WithConfirm({ onConfirm }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setError(null);

    try {
      await onConfirm();
      setOpen(false);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Remover
      </button>

      {open ? (
        <ConfirmModal
          title="Remover foto"
          subtitle="gondola-3.jpg"
          confirmLabel="Remover foto"
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => {
            setOpen(false);
            setError(null);
          }}
        >
          <p>A foto sai desta sessão com os textos lidos nela.</p>
        </ConfirmModal>
      ) : null}
    </>
  );
}

async function open(onConfirm) {
  await view.render(<WithConfirm onConfirm={onConfirm} />);

  const trigger = view.container.querySelector('button');

  await view.focus(trigger);
  await view.click(trigger);

  return trigger;
}

describe('ConfirmModal', () => {
  it('pergunta com o ícone de perigo, o texto e a ação nomeada no botão', async () => {
    await open(vi.fn());

    expect(dialog().querySelector('h2').textContent).toBe('Remover foto');
    expect(dialog().textContent).toContain('gondola-3.jpg');
    expect(dialog().textContent).toContain('A foto sai desta sessão');
    expect(dialog().querySelector('[aria-hidden="true"] svg')).toBeTruthy();
    expect(buttonNamed('Remover foto').className).toContain('bg-marca-vermelhoTenue');
    expect(buttonNamed('Cancelar')).toBeTruthy();
  });

  it('confirma, fecha e devolve o foco ao gatilho', async () => {
    const onConfirm = vi.fn(async () => {});
    const trigger = await open(onConfirm);

    await view.click(buttonNamed('Remover foto'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('fica aberto com o aviso quando a confirmação falha, e confirmar de novo é a nova tentativa', async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('Não foi possível gravar.'))
      .mockResolvedValueOnce(undefined);

    await open(onConfirm);
    await view.click(buttonNamed('Remover foto'));

    expect(dialog()).not.toBeNull();
    expect(dialog().querySelector('[role="alert"]').textContent).toBe('Não foi possível gravar.');
    expect(buttonNamed('Tentar de novo').disabled).toBe(false);

    await view.click(buttonNamed('Tentar de novo'));

    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(dialog()).toBeNull();
  });

  it('cancela pelo botão, pelo Esc e pelo clique fora, sem confirmar', async () => {
    const onConfirm = vi.fn();

    await open(onConfirm);
    await view.click(buttonNamed('Cancelar'));
    expect(dialog()).toBeNull();

    await view.click(view.container.querySelector('button'));
    await view.press('Escape');
    expect(dialog()).toBeNull();

    await view.click(view.container.querySelector('button'));
    await view.update(() => {
      dialog().parentElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(dialog()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fica do tamanho do texto na tela estreita', async () => {
    await open(vi.fn());

    expect(dialog().className).not.toContain('max-lg:');
  });

  it('desliga os dois botões durante a confirmação', async () => {
    await view.render(
      <ConfirmModal title="Remover foto" isConfirming onConfirm={vi.fn()} onCancel={vi.fn()}>
        texto
      </ConfirmModal>,
    );

    expect(buttonNamed('Cancelar').disabled).toBe(true);
    expect(buttonNamed('Confirmar').disabled).toBe(true);
  });
});
