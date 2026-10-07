// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { summaryProductOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ProductCards from './ProductCards.jsx';

const view = useReactRoot();

const PRODUCTS = [
  summaryProductOf('DEMO-2', {
    displayName: 'Café Torrado 500g',
    quantity: 3,
    priceInCentavos: 1899,
  }),
  summaryProductOf('DEMO-10', {
    priceInCentavos: null,
    totalInCentavos: null,
    openConflictFields: ['priceInCentavos'],
    warningCount: 1,
  }),
];

function cards() {
  return [...view.container.querySelectorAll('li')];
}

describe('ProductCards', () => {
  it('mostra nome, código, quantidade vezes preço e total, na ordem recebida', async () => {
    await view.render(<ProductCards products={PRODUCTS} onSelect={() => {}} />);

    const [coffee] = cards();

    expect(view.container.querySelector('ul').getAttribute('aria-label')).toBe(
      'Resumo por produto',
    );
    expect(cards().map((card) => card.dataset.produto)).toEqual(['DEMO-2', 'DEMO-10']);
    expect(coffee.textContent).toContain('Café Torrado 500g');
    expect(coffee.textContent).toContain('DEMO-2');
    expect(coffee.textContent).toContain('3 × R$ 18,99');
    expect(coffee.textContent).toContain('R$ 56,97');
  });

  it('marca conflito e aviso e escreve o motivo do valor ausente', async () => {
    await view.render(<ProductCards products={PRODUCTS} onSelect={() => {}} />);

    const disputed = cards()[1];

    expect(disputed.querySelector('[data-marca="conflict"]').textContent).toBe('conflito em preço');
    expect(disputed.querySelector('[data-marca="warning"]')).toBeTruthy();
    expect(disputed.textContent).toContain('indisponível: preço em conflito');
  });

  it('faz do cartão inteiro o botão que seleciona, com a marca do selecionado', async () => {
    const onSelect = vi.fn();

    await view.render(
      <ProductCards products={PRODUCTS} selectedCode="DEMO-10" onSelect={onSelect} />,
    );

    const [first, selected] = cards();

    expect(first.querySelectorAll('button')).toHaveLength(1);
    expect(first.querySelector('button').className).toContain('min-h-controle');
    expect(selected.className).toContain('bg-marca-vermelhoTenue');
    expect(selected.querySelector('button').getAttribute('aria-current')).toBe('true');

    await view.click(first.querySelector('button'));

    expect(onSelect).toHaveBeenCalledWith('DEMO-2');
  });
  it('é uma parada de Tab na lista, com setas e End, sem selecionar ao andar', async () => {
    const onSelect = vi.fn();

    await view.render(<ProductCards products={PRODUCTS} onSelect={onSelect} />);

    const buttons = () => cards().map((card) => card.querySelector('button'));

    expect(buttons().map((button) => button.tabIndex)).toEqual([0, -1]);

    await view.focus(buttons()[0]);
    await view.press('End');

    expect(document.activeElement).toBe(buttons()[1]);

    await view.press('ArrowUp');

    expect(document.activeElement).toBe(buttons()[0]);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
