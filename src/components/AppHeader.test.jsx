// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { APP_NAME } from '../lib/app-meta.js';
import { useReactRoot } from '../test-fixtures/reactRoot.js';

import AppHeader from './AppHeader.jsx';
import { SHELL_VIEWS } from './AppShell.jsx';

const view = useReactRoot();

function radios() {
  return [...view.container.querySelectorAll('input[type="radio"]')];
}

describe('AppHeader', () => {
  it('mostra o nome do produto como título da tela', async () => {
    await view.render(<AppHeader onViewChange={() => {}} />);

    const title = view.container.querySelector('h1');

    expect(title.textContent).toBe(APP_NAME);
    expect(APP_NAME).toBe('StockVision');
    expect(title.className).toContain('truncate');
    expect(view.container.querySelector('header > div').className).toContain('h-topo');
  });

  it('traz a barra de vistas só abaixo do ponto de corte, com Entrada, Produtos e Detalhe', async () => {
    await view.render(<AppHeader onViewChange={() => {}} />);

    const nav = view.container.querySelector('nav');
    const labels = [...nav.querySelectorAll('label')].map((label) => label.textContent);

    expect(nav.getAttribute('aria-label')).toBe('Vistas');
    expect(nav.className).toContain('lg:hidden');
    expect(labels).toEqual(['Entrada', 'Produtos', 'Detalhe']);
    expect(radios().find((radio) => radio.checked).value).toBe(SHELL_VIEWS.INTAKE);
  });

  it('avisa a troca de vista pelo toque e pelas setas', async () => {
    const onViewChange = vi.fn();

    await view.render(
      <AppHeader activeView={SHELL_VIEWS.PRODUCTS} onViewChange={onViewChange} />,
    );

    expect(radios().find((radio) => radio.checked).value).toBe(SHELL_VIEWS.PRODUCTS);

    await view.click(radios()[2]);
    await view.focus(radios()[1]);
    await view.press('ArrowLeft');

    expect(onViewChange.mock.calls.map(([value]) => value)).toEqual([
      SHELL_VIEWS.DETAIL,
      SHELL_VIEWS.INTAKE,
    ]);
  });
});
