// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';
import ModalShell from '../ui/ModalShell.jsx';

import SessionRow from './SessionRow.jsx';

const view = useReactRoot();

const SESSION = {
  id: 'sessao-1',
  name: 'Depósito',
  updatedAt: new Date(2026, 9, 2, 14, 5).toISOString(),
};

/** Linha dentro de um dialogo, com a edicao controlada como no uso real. */
function InDialog({ onRename = async () => {}, onClose = vi.fn(), ...props }) {
  const [isRenaming, setIsRenaming] = useState(false);

  return (
    <ModalShell title="Sessões" onClose={onClose}>
      <ul>
        <SessionRow
          session={SESSION}
          isOpen={false}
          isRenaming={isRenaming}
          canChange
          onOpen={vi.fn()}
          onStartRename={() => setIsRenaming(true)}
          onCancelRename={() => setIsRenaming(false)}
          onRename={async (name) => {
            await onRename(name);
            setIsRenaming(false);
          }}
          onDelete={vi.fn()}
          {...props}
        />
      </ul>
    </ModalShell>
  );
}

function button(label) {
  return [...view.container.querySelectorAll('button')].find(
    (item) => item.getAttribute('aria-label') === label || item.textContent === label,
  );
}

function input() {
  return view.container.querySelector('input');
}

async function type(value) {
  await view.update(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

    setter.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function startRename() {
  await view.click(button('Renomear Depósito'));
}

describe('SessionRow', () => {
  it('mostra o nome, a data da última alteração e as ações nomeadas', async () => {
    await view.render(<InDialog />);

    const row = view.container.querySelector('li');

    expect(row.textContent).toContain('Depósito');
    expect(row.textContent).toContain('Alterada em 02/10/2026 14:05');
    expect(button('Abrir')).toBeTruthy();
    expect(button('Apagar Depósito').className).toContain('text-marca-vermelhoTexto');
  });

  it('marca a sessão aberta no lugar do botão Abrir', async () => {
    await view.render(<InDialog isOpen />);

    expect(button('Abrir')).toBeUndefined();
    expect(view.container.querySelector('li').textContent).toContain('Aberta');
  });

  it('desliga abrir e apagar quando não pode mudar, e deixa renomear', async () => {
    await view.render(<InDialog canChange={false} />);

    expect(button('Abrir').disabled).toBe(true);
    expect(button('Apagar Depósito').disabled).toBe(true);
    expect(button('Renomear Depósito').disabled).toBe(false);
  });

  it('renomeia na própria linha, com o foco no campo, o contador e o Enter gravando', async () => {
    const onRename = vi.fn(async () => {});

    await view.render(<InDialog onRename={onRename} />);
    await startRename();

    expect(document.activeElement).toBe(input());
    expect(input().value).toBe('Depósito');
    expect(view.container.querySelector('label').textContent).toBe('Nome da sessão8/80');

    await type('  Depósito norte  ');

    expect(view.container.querySelector('label').textContent).toBe('Nome da sessão14/80');

    await view.update(() => input().form.requestSubmit());

    expect(onRename).toHaveBeenCalledWith('  Depósito norte  ');
    expect(input()).toBeNull();
    expect(document.activeElement).toBe(button('Renomear Depósito'));
  });

  it('recusa nome vazio e acima de 80 caracteres com a frase, sem cortar a digitação', async () => {
    const onRename = vi.fn(async () => {});

    await view.render(<InDialog onRename={onRename} />);
    await startRename();
    await type('   ');
    await view.click(button('Salvar nome'));

    expect(view.container.textContent).toContain('Nome da sessão obrigatório.');
    expect(input().getAttribute('aria-invalid')).toBe('true');

    await type('x'.repeat(81));
    await view.click(button('Salvar nome'));

    expect(input().value).toHaveLength(81);
    expect(view.container.textContent).toContain(
      'Nome da sessão deve ter no máximo 80 caracteres.',
    );
    expect(onRename).not.toHaveBeenCalled();
  });

  it('mostra a falha da gravação e continua editando', async () => {
    const onRename = vi.fn(async () => {
      throw Object.assign(new Error('x'), { name: 'QuotaExceededError' });
    });

    await view.render(<InDialog onRename={onRename} />);
    await startRename();
    await view.click(button('Salvar nome'));

    expect(view.container.textContent).toContain('O armazenamento deste dispositivo está cheio.');
    expect(input()).not.toBeNull();
  });

  it('cancela a edição com Esc sem fechar o diálogo, e o foco volta ao renomear', async () => {
    const onClose = vi.fn();

    await view.render(<InDialog onClose={onClose} />);
    await startRename();
    await type('Outro nome');

    const escape = await view.press('Escape');

    expect(escape.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(input()).toBeNull();
    expect(view.container.textContent).toContain('Depósito');
    expect(document.activeElement).toBe(button('Renomear Depósito'));

    await view.press('Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exibe o nome com marcação como texto', async () => {
    await view.render(<InDialog session={{ ...SESSION, name: '<b>Loja</b>' }} />);

    expect(view.container.querySelector('li b')).toBeNull();
    expect(view.container.querySelector('li').textContent).toContain('<b>Loja</b>');
  });
});
