// @vitest-environment jsdom

import { Pencil } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import IconButton from './IconButton.jsx';

const view = useReactRoot();

describe('IconButton', () => {
  it('é nomeado pelo rótulo, com a dica e o ícone fora da leitura', async () => {
    const onClick = vi.fn();

    await view.render(
      <IconButton label="Renomear sessão" onClick={onClick}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </IconButton>,
    );

    const button = view.container.querySelector('button');

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Renomear sessão');
    expect(button.title).toBe('Renomear sessão');
    expect(button.querySelector('svg').getAttribute('aria-hidden')).toBe('true');

    await view.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('tem o lado da altura de controle e o realce de foco do papel', async () => {
    await view.render(
      <>
        <IconButton label="Fechar">x</IconButton>
        <IconButton label="Remover foto" tone="danger">
          x
        </IconButton>
      </>,
    );

    const [plain, danger] = view.container.querySelectorAll('button');

    expect(plain.className).toContain('h-controle');
    expect(plain.className).toContain('w-controle');
    expect(plain.className).toContain('focus-visible:outline-2');
    expect(plain.className).toContain('focus-visible:outline-neutro-tintaFraca');
    expect(danger.className).toContain('text-marca-vermelhoTexto');
    expect(danger.className).toContain('focus-visible:outline-marca-vermelhoTexto');
    expect(danger.className).not.toContain('bg-marca-vermelho ');
  });

  it('respeita o botão desligado', async () => {
    const onClick = vi.fn();

    await view.render(
      <IconButton label="Remover foto" disabled onClick={onClick}>
        x
      </IconButton>,
    );

    await view.click(view.container.querySelector('button'));

    expect(onClick).not.toHaveBeenCalled();
  });
});
