// @vitest-environment jsdom

import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { summaryProductOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ProductsColumn from './ProductsColumn.jsx';

const view = useReactRoot();

const PRODUCTS = [
  summaryProductOf('DEMO-1', { displayName: 'ARROZ BRANCO 5KG' }),
  summaryProductOf('DEMO-2', { displayName: 'Café Torrado 500g', ean: '2000000000022' }),
  summaryProductOf('DEMO-3', {
    displayName: null,
    conflictingFields: ['displayName'],
    openConflictFields: ['displayName'],
  }),
  summaryProductOf('DEMO-10', { displayName: 'CAFÉ SOLÚVEL 100G' }),
];

const CONFLICTS = [
  {
    systemCode: 'DEMO-3',
    field: 'displayName',
    status: 'open',
    chosenValue: null,
    variants: [
      { value: 'FEIJÃO PRETO 1KG', copyCount: 1, texts: [] },
      { value: 'FEIJAO PRETO 1KG', copyCount: 1, texts: [] },
    ],
  },
];

const VALUE_SETTER = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

/** Digitacao no campo como o navegador entrega ao React. */
async function typeInto(input, value) {
  await act(async () => {
    VALUE_SETTER.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function search() {
  return view.container.querySelector('input');
}

function tableCodes() {
  return [...view.container.querySelectorAll('tbody tr')].map((row) => row.dataset.produto);
}

function cardCodes() {
  return [...view.container.querySelectorAll('li[data-produto]')].map(
    (card) => card.dataset.produto,
  );
}

function hint() {
  return view.container.querySelector(`#${search().getAttribute('aria-describedby')}`).textContent;
}

function render(props = {}) {
  return view.render(
    <ProductsColumn products={PRODUCTS} conflicts={CONFLICTS} onSelect={() => {}} {...props} />,
  );
}

describe('ProductsColumn', () => {
  it('põe título, busca e contagem na faixa fixa e a lista de ponta a ponta no corpo que rola', async () => {
    await render();

    const section = view.container.querySelector('section');
    const body = section.querySelector('[data-corpo]');

    expect(section.getAttribute('aria-label')).toBe('Produtos');
    expect(section.querySelector('h2').textContent).toBe('Produtos');
    expect(body.contains(search())).toBe(false);
    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).not.toContain('px-recuo');
    expect(hint()).toBe('4 produtos');
    expect(tableCodes()).toEqual(['DEMO-1', 'DEMO-2', 'DEMO-3', 'DEMO-10']);
    expect(cardCodes()).toEqual(tableCodes());
    expect(body.querySelector('table').parentElement.className).toContain('hidden sm:block');
    expect(body.querySelector('ul').parentElement.className).toContain('sm:hidden');
  });

  it('busca por parte do nome sem diferença de acento e de caixa, com a contagem N de M', async () => {
    await render();

    await typeInto(search(), 'CAFE');

    expect(tableCodes()).toEqual(['DEMO-2', 'DEMO-10']);
    expect(hint()).toBe('2 de 4 produtos');
    expect(view.container.querySelector('[role="status"]').textContent).toBe('2 de 4 produtos');

    await typeInto(search(), 'café');

    expect(tableCodes()).toEqual(['DEMO-2', 'DEMO-10']);
  });

  it('busca pelo código, pelo código de barras e pelo nome em conflito', async () => {
    await render();

    await typeInto(search(), 'demo-1');
    expect(tableCodes()).toEqual(['DEMO-1', 'DEMO-10']);

    await typeInto(search(), '000022');
    expect(tableCodes()).toEqual(['DEMO-2']);

    await typeInto(search(), 'feijao');
    expect(tableCodes()).toEqual(['DEMO-3']);
  });

  it('mostra tudo com o termo vazio', async () => {
    await render();

    await typeInto(search(), 'arroz');
    await typeInto(search(), '');

    expect(tableCodes()).toHaveLength(4);
    expect(hint()).toBe('4 produtos');
    expect(view.container.querySelector('[role="status"]').textContent).toBe('');
  });

  it('diz que nada corresponde, com o termo como texto, e limpa a busca com o foco no campo', async () => {
    await render();

    await typeInto(search(), '<b>leite</b>');

    const notice = view.container.querySelector('[data-sem-resultado]');

    expect(tableCodes()).toEqual([]);
    expect(notice.textContent).toContain('Nenhum produto com <b>leite</b>');
    expect(notice.querySelector('b')).toBeNull();
    expect(hint()).toBe('0 de 4 produtos');

    await view.click(notice.querySelector('button'));

    expect(search().value).toBe('');
    expect(tableCodes()).toHaveLength(4);
    expect(document.activeElement).toBe(search());
  });

  it('mostra a frase de sessão sem produto, sem campo de busca', async () => {
    await view.render(<ProductsColumn onSelect={() => {}} />);

    expect(search()).toBeNull();
    expect(view.container.querySelector('[data-estado-produtos]').textContent).toBe(
      'Nenhum produto lido nesta sessão. Envie fotos das etiquetas em Entrada.',
    );
  });

  it('marca o selecionado nas duas formas e sobe a escolha', async () => {
    const onSelect = vi.fn();

    await render({ selectedCode: 'DEMO-2', onSelect });

    expect(
      view.container.querySelector('tr[data-produto="DEMO-2"] button').getAttribute('aria-current'),
    ).toBe('true');
    expect(
      view.container.querySelector('li[data-produto="DEMO-2"] button').getAttribute('aria-current'),
    ).toBe('true');

    await view.click(view.container.querySelector('tr[data-produto="DEMO-10"] button'));

    expect(onSelect).toHaveBeenCalledWith('DEMO-10');
  });
});
