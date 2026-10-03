// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { summaryProductOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ProductFacts from './ProductFacts.jsx';

const view = useReactRoot();

function facts() {
  return Object.fromEntries(
    [...view.container.querySelectorAll('[data-dado]')].map((row) => [
      row.dataset.dado,
      row.querySelector('dd').textContent,
    ]),
  );
}

describe('ProductFacts', () => {
  it('mostra quantidade, preço, total, EAN e NCM, com os valores em reais', async () => {
    const product = summaryProductOf('A-1', {
      quantity: 2,
      priceInCentavos: 85990,
      ean: '7899075420416',
      ncm: '94035000',
    });

    await view.render(<ProductFacts product={product} />);

    expect(facts()).toEqual({
      Quantidade: '2 exemplares',
      Preço: 'R$ 859,90',
      Total: 'R$ 1.719,80',
      EAN: '7899075420416',
      NCM: '94035000',
    });
  });

  it('separa o campo em conflito aberto do campo em branco em todos os exemplares', async () => {
    const product = summaryProductOf('A-1', {
      priceInCentavos: null,
      ean: null,
      ncm: null,
      openConflictFields: ['priceInCentavos', 'ean'],
    });

    await view.render(<ProductFacts product={product} />);

    expect(facts()).toEqual({
      Quantidade: '1 exemplar',
      Preço: '—indisponível: preço em conflito',
      Total: '—indisponível: preço em conflito',
      EAN: '—indisponível: EAN em conflito',
      NCM: 'sem NCM',
    });
  });
});
