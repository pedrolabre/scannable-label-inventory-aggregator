// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import Button, { buttonShapeClasses } from './Button.jsx';

const view = useReactRoot();

describe('Button', () => {
  it('é um botão comum, com a altura de controle e o realce de foco', async () => {
    const onClick = vi.fn();

    await view.render(<Button onClick={onClick}>Tentar de novo</Button>);

    const button = view.container.querySelector('button');

    expect(button.type).toBe('button');
    expect(button.textContent).toBe('Tentar de novo');
    expect(button.className).toContain('h-controle');
    expect(button.className).toContain('focus-visible:outline-2');
    expect(button.className).toContain('focus-visible:outline-neutro-tintaFraca');

    await view.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('preenche com a marca só na ação principal', async () => {
    await view.render(
      <>
        <Button variant="primary">Principal</Button>
        <Button>Apoio</Button>
      </>,
    );

    const [primary, secondary] = view.container.querySelectorAll('button');

    expect(primary.className).toContain('bg-marca-vermelho');
    expect(primary.className).toContain('focus-visible:outline-marca-vermelho');
    expect(secondary.className).not.toContain('bg-marca-vermelho');
    expect(buttonShapeClasses('inexistente')).toBe(buttonShapeClasses('secondary'));
  });

  it('respeita o botão desligado', async () => {
    const onClick = vi.fn();

    await view.render(
      <Button disabled onClick={onClick}>
        Nova sessão
      </Button>,
    );

    const button = view.container.querySelector('button');

    await view.click(button);

    expect(button.disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });
});
