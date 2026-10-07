// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../test-fixtures/reactRoot.js';

import AppShell, { MAIN_CONTENT_ID, SHELL_VIEWS } from './AppShell.jsx';

const view = useReactRoot();

function renderShell(props = {}) {
  return view.render(
    <AppShell
      header={<header>topo</header>}
      left={<section>esquerda</section>}
      center={<section>centro</section>}
      right={<section>direita</section>}
      status={<footer>estado</footer>}
      {...props}
    />,
  );
}

function vistas() {
  return [...view.container.querySelectorAll('[data-vista]')];
}

describe('AppShell', () => {
  it('põe as três colunas na ordem entrada, produtos e detalhe, na grade da tela larga', async () => {
    await renderShell();

    const main = view.container.querySelector('main');

    expect(vistas().map((vista) => vista.dataset.vista)).toEqual([
      'entrada',
      'produtos',
      'detalhe',
    ]);
    expect(vistas().map((vista) => vista.textContent)).toEqual(['esquerda', 'centro', 'direita']);
    expect(main.className).toContain('grid-cols-1');
    expect(main.className).toContain('lg:grid-cols-janela');
    expect(main.className).toContain('min-h-0');
  });

  it('mostra só a vista ativa abaixo do ponto de corte e as três a partir dele', async () => {
    await renderShell({ activeView: SHELL_VIEWS.PRODUCTS });

    const [intake, products, detail] = vistas();

    expect(products.className).toMatch(/(^| )flex( |$)/);
    expect(products.hasAttribute('data-vista-ativa')).toBe(true);
    expect(intake.className).toMatch(/(^| )hidden( |$)/);
    expect(detail.className).toMatch(/(^| )hidden( |$)/);
    expect(vistas().every((vista) => vista.className.includes('lg:flex'))).toBe(true);
  });

  it('abre na vista Entrada', async () => {
    await renderShell({ activeView: undefined });

    expect(vistas()[0].hasAttribute('data-vista-ativa')).toBe(true);
  });

  it('não deixa a página rolar: o contorno tem a altura da janela e esconde o excesso', async () => {
    await renderShell();

    const shell = view.container.firstElementChild;

    expect(shell.className).toContain('h-full');
    expect(shell.className).toContain('overflow-hidden');
    expect(shell.lastElementChild.textContent).toBe('estado');
  });

  it('começa por um atalho que leva o foco ao conteúdo', async () => {
    await renderShell();

    const skip = view.container.querySelector('a');
    const main = view.container.querySelector('main');

    expect(skip.textContent).toBe('Pular para o conteúdo');
    expect(skip.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`);
    expect(skip.className).toContain('sr-only');
    expect(skip.className).toContain('focus:not-sr-only');
    expect(skip.className).toContain('focus:min-h-controle');
    expect(skip.className).toContain('focus:px-4');
    expect(skip.className).toContain('focus-visible:outline-2');
    expect(main.id).toBe(MAIN_CONTENT_ID);
    expect(main.tabIndex).toBe(-1);

    await view.focus(main);

    expect(document.activeElement).toBe(main);
  });

  it('põe o aviso entre o cabeçalho e as colunas, no fluxo', async () => {
    await renderShell({ notice: <div data-aviso="">aviso</div> });

    const shell = view.container.firstElementChild;
    const order = [...shell.children].map((child) => child.tagName.toLowerCase());
    const notice = shell.querySelector('[data-aviso]');

    expect(order).toEqual(['a', 'header', 'div', 'main', 'footer']);
    expect(notice.nextElementSibling.tagName).toBe('MAIN');
    expect(notice.previousElementSibling.tagName).toBe('HEADER');
  });

  it('não acrescenta nada sem aviso', async () => {
    await renderShell();

    const order = [...view.container.firstElementChild.children].map((child) =>
      child.tagName.toLowerCase(),
    );

    expect(order).toEqual(['a', 'header', 'main', 'footer']);
  });
});
