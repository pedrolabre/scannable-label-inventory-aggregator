// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ProductSearchField from './ProductSearchField.jsx';

const view = useReactRoot();

function Harness({ initial = '' }) {
  const [value, setValue] = useState(initial);

  return <ProductSearchField value={value} onChange={setValue} hint="3 de 10 produtos" />;
}

function input() {
  return view.container.querySelector('input');
}

function clearButton() {
  return view.container.querySelector('button[aria-label="Limpar busca"]');
}

describe('ProductSearchField', () => {
  it('nomeia o campo e o descreve pela contagem', async () => {
    await view.render(<Harness />);

    const hint = view.container.querySelector(`#${input().getAttribute('aria-describedby')}`);

    expect(input().labels[0].textContent).toContain('Buscar produto');
    expect(hint.textContent).toBe('3 de 10 produtos');
    expect(input().className).toContain('h-controle');
    expect(clearButton()).toBeNull();
  });

  it('limpa pelo botão ao lado, com o lado do controle, e devolve o foco ao campo', async () => {
    await view.render(<Harness initial="cafe" />);

    expect(clearButton().className).toContain('h-controle');
    expect(input().parentElement.contains(clearButton())).toBe(false);

    await view.click(clearButton());

    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
    expect(clearButton()).toBeNull();
  });

  it('limpa com Esc dentro do campo e deixa o Esc seguir quando já está vazio', async () => {
    await view.render(<Harness initial="cafe" />);
    await view.focus(input());

    const first = await view.press('Escape');

    expect(first.defaultPrevented).toBe(true);
    expect(input().value).toBe('');

    const second = await view.press('Escape');

    expect(second.defaultPrevented).toBe(false);
  });
});
