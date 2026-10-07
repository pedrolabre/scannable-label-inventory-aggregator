// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { summaryProductOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ProductSummaryTable from './ProductSummaryTable.jsx';

const view = useReactRoot();

const PRODUCTS = [
  summaryProductOf('DEMO-2', {
    displayName: 'AÇÚCAR CRISTAL 1KG',
    quantity: 2,
    priceInCentavos: 549,
  }),
  summaryProductOf('DEMO-10', {
    displayName: null,
    priceInCentavos: null,
    totalInCentavos: null,
    conflictingFields: ['displayName', 'priceInCentavos'],
    openConflictFields: ['displayName', 'priceInCentavos'],
  }),
  summaryProductOf('DEMO-11', { warningCount: 1, resolvedFields: ['ean'] }),
];

function rows() {
  return [...view.container.querySelectorAll('tbody tr')];
}

function cells(row) {
  return [...row.querySelectorAll('td')].map((cell) => cell.textContent);
}

describe('ProductSummaryTable', () => {
  it('mostra código, produto, preço, quantidade e total na ordem recebida', async () => {
    await view.render(<ProductSummaryTable products={PRODUCTS} onSelect={() => {}} />);

    const heads = [...view.container.querySelectorAll('thead th')].map((th) => th.textContent);

    expect(view.container.querySelector('caption').textContent).toBe('Resumo por produto');
    expect(heads).toEqual(['Código', 'Produto', 'Preço', 'Qtd.Quantidade', 'Total']);
    expect(rows().map((row) => row.dataset.produto)).toEqual(['DEMO-2', 'DEMO-10', 'DEMO-11']);
    expect(cells(rows()[0])).toEqual(['DEMO-2', 'AÇÚCAR CRISTAL 1KG', 'R$ 5,49', '2', 'R$ 10,98']);
  });

  it('marca o produto com conflito aberto, com aviso e com conflito resolvido', async () => {
    await view.render(<ProductSummaryTable products={PRODUCTS} onSelect={() => {}} />);

    const [, disputed, warned] = rows();
    const disputedButton = disputed.querySelector('button');

    expect(cells(disputed)[1]).toContain('conflito em nome e preço');
    expect(cells(disputed)[2]).toBe('—indisponível: preço em conflito');
    expect(cells(disputed)[4]).toBe('—indisponível: preço em conflito');
    expect(
      view.container.querySelector(
        `#${CSS.escape(disputedButton.getAttribute('aria-describedby'))}`,
      ).textContent,
    ).toBe('conflito em nome e preço');
    expect(warned.querySelector('[data-marca="warning"]').textContent).toBe(
      '1 aviso de reimpressão',
    );
    expect(warned.querySelector('[data-marca="resolved"]').textContent).toBe('resolvido em EAN');
    expect(rows()[0].querySelector('button').hasAttribute('aria-describedby')).toBe(false);
  });

  it('alterna as faixas em neutro.faixa e marca o selecionado sem depender só da cor', async () => {
    await view.render(
      <ProductSummaryTable products={PRODUCTS} selectedCode="DEMO-11" onSelect={() => {}} />,
    );

    const [first, second, selected] = rows();

    expect(view.container.querySelector('table').className).toContain('bg-neutro-branco');
    expect(first.className).not.toContain('bg-neutro-faixa');
    expect(second.className).toContain('bg-neutro-faixa');
    expect(selected.className).toContain('bg-marca-vermelhoTenue');
    expect(selected.querySelector('button').getAttribute('aria-current')).toBe('true');
    expect(selected.querySelector('button').className).toContain('font-bold');
    expect(first.querySelector('button').hasAttribute('aria-current')).toBe(false);
  });

  it('seleciona pelo botão do nome e pelo resto da linha, uma vez por clique', async () => {
    const onSelect = vi.fn();

    await view.render(<ProductSummaryTable products={PRODUCTS} onSelect={onSelect} />);

    await view.click(rows()[0].querySelector('button'));
    await view.click(rows()[2].querySelectorAll('td')[4]);

    expect(onSelect.mock.calls).toEqual([['DEMO-2'], ['DEMO-11']]);
  });

  it('deixa um botão por linha, com a altura de controle e o realce de foco', async () => {
    await view.render(<ProductSummaryTable products={PRODUCTS} onSelect={() => {}} />);

    for (const row of rows()) {
      const buttons = row.querySelectorAll('button');

      expect(buttons).toHaveLength(1);
      expect(buttons[0].className).toContain('min-h-controle');
      expect(buttons[0].className).toContain('focus-visible:outline');
    }
  });

  it('mostra nome e código com marcação como texto', async () => {
    const tricky = summaryProductOf('<b>X</b>', { displayName: '<img src=x onerror=alert(1)>' });

    await view.render(<ProductSummaryTable products={[tricky]} onSelect={() => {}} />);

    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.querySelector('tbody b')).toBeNull();
    expect(cells(rows()[0]).slice(0, 2)).toEqual(['<b>X</b>', '<img src=x onerror=alert(1)>']);
  });
  it('é uma parada de Tab na tabela, no selecionado, e as setas só movem o foco', async () => {
    const onSelect = vi.fn();

    await view.render(
      <ProductSummaryTable products={PRODUCTS} selectedCode="DEMO-10" onSelect={onSelect} />,
    );

    const buttons = () => rows().map((row) => row.querySelector('button'));

    expect(buttons().map((button) => button.tabIndex)).toEqual([-1, 0, -1]);

    await view.focus(buttons()[1]);
    await view.press('ArrowDown');

    expect(document.activeElement).toBe(buttons()[2]);

    await view.press('Home');

    expect(document.activeElement).toBe(buttons()[0]);
    expect(buttons().map((button) => button.tabIndex)).toEqual([0, -1, -1]);
    expect(onSelect).not.toHaveBeenCalled();

    await view.click(document.activeElement);

    expect(onSelect).toHaveBeenCalledWith('DEMO-2');
  });
});
