// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { summaryProductOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import {
  ProductMarks,
  ProductName,
  ProductPrice,
  ProductTotal,
  fieldList,
  productMarks,
} from './productDisplay.jsx';

const view = useReactRoot();

describe('fieldList', () => {
  it('junta os campos com vírgula e "e"', () => {
    expect(fieldList(['displayName'])).toBe('nome');
    expect(fieldList(['displayName', 'priceInCentavos'])).toBe('nome e preço');
    expect(fieldList(['displayName', 'priceInCentavos', 'ean', 'ncm'])).toBe(
      'nome, preço, EAN e NCM',
    );
  });
});

describe('productMarks', () => {
  it('não marca o produto sem conflito e sem aviso', () => {
    expect(productMarks(summaryProductOf('A-1'))).toEqual([]);
  });

  it('marca conflito aberto, aviso e resolvido, nessa ordem, por escrito', () => {
    const product = summaryProductOf('A-1', {
      conflictingFields: ['displayName', 'priceInCentavos', 'ean'],
      openConflictFields: ['displayName', 'priceInCentavos'],
      resolvedFields: ['ean'],
      warningCount: 2,
    });

    expect(productMarks(product)).toEqual([
      { kind: 'conflict', text: 'conflito em nome e preço' },
      { kind: 'warning', text: '2 avisos de reimpressão' },
      { kind: 'resolved', text: 'resolvido em EAN' },
    ]);
    expect(productMarks(summaryProductOf('B-2', { warningCount: 1 }))[0].text).toBe(
      '1 aviso de reimpressão',
    );
  });

  it('pinta cada etiqueta pelo tom do papel dela, com amarelo só no aviso', async () => {
    const product = summaryProductOf('A-1', {
      openConflictFields: ['priceInCentavos'],
      resolvedFields: ['ean'],
      warningCount: 1,
    });

    await view.render(<ProductMarks product={product} id="marcas" />);

    const tag = (kind) => view.container.querySelector(`[data-marca="${kind}"]`);

    expect(view.container.querySelector('#marcas')).toBeTruthy();
    expect(tag('conflict').className).toContain('text-marca-vermelhoTexto');
    expect(tag('warning').className).toContain('text-marca-amareloTexto');
    expect(tag('resolved').className).toContain('text-neutro-tintaMedia');
    expect(tag('resolved').className).not.toContain('verde');
  });

  it('não desenha nada sem etiqueta', async () => {
    await view.render(<ProductMarks product={summaryProductOf('A-1')} />);

    expect(view.container.innerHTML).toBe('');
  });
});

describe('valores do produto', () => {
  it('escreve preço e total em reais', async () => {
    const product = summaryProductOf('A-1', { quantity: 3, priceInCentavos: 85990 });

    await view.render(
      <p>
        <ProductPrice product={product} />|<ProductTotal product={product} />
      </p>,
    );

    expect(view.container.textContent).toBe('R$ 859,90|R$ 2.579,70');
  });

  it('troca o valor ausente pelo travessão, com o motivo no nome acessível e na dica', async () => {
    const disputed = summaryProductOf('A-1', {
      displayName: null,
      priceInCentavos: null,
      openConflictFields: ['displayName', 'priceInCentavos'],
    });
    const huge = summaryProductOf('B-2', { totalInCentavos: null, totalOutOfRange: true });

    await view.render(
      <>
        <p data-nome="">
          <ProductName product={disputed} />
        </p>
        <p data-preco="">
          <ProductPrice product={disputed} />
        </p>
        <p data-total="">
          <ProductTotal product={disputed} />
        </p>
        <p data-limite="">
          <ProductTotal product={huge} />
        </p>
      </>,
    );

    const cell = (name) => view.container.querySelector(`[data-${name}]`);

    expect(cell('nome').textContent).toBe('—indisponível: nome em conflito');
    expect(cell('nome').querySelector('[aria-hidden="true"]').textContent).toBe('—');
    expect(cell('preco').querySelector('[title]').title).toBe('Indisponível: preço em conflito');
    expect(cell('total').textContent).toContain('preço em conflito');
    expect(cell('limite').textContent).toContain('o valor passa do limite de cálculo');
  });
});
