// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  buildProductSearchIndex,
  normalizeSearchText,
  searchProductIndex,
} from './productSearch.js';

const product = (systemCode, displayName, ean = null) => ({ systemCode, displayName, ean });

const COFFEE = product('DEMO-010', 'Café Torrado 500g', '2000000000107');
const SUGAR = product('DEMO-002', 'AÇÚCAR CRISTAL 1KG');
const SOAP = product('DEMO-004', 'SABÃO EM PÓ 800G', '20000042');
const PRODUCTS = [SUGAR, SOAP, COFFEE];

const codes = (list) => list.map((item) => item.systemCode);

function search(query, products = PRODUCTS, conflicts = []) {
  return searchProductIndex(buildProductSearchIndex(products, conflicts), query);
}

describe('normalizeSearchText', () => {
  it('tira acento, caixa e espaço das pontas', () => {
    expect(normalizeSearchText('  Açúcar Cristal ')).toBe('acucar cristal');
    expect(normalizeSearchText('SABÃO EM PÓ')).toBe('sabao em po');
  });

  it('devolve texto vazio para o que não é texto', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
    expect(normalizeSearchText(1099)).toBe('');
  });
});

describe('searchProductIndex', () => {
  it('encontra pela parte do nome sem diferença de acento e de caixa', () => {
    expect(codes(search('CAFE'))).toEqual(['DEMO-010']);
    expect(codes(search('café'))).toEqual(['DEMO-010']);
    expect(codes(search('acucar'))).toEqual(['DEMO-002']);
    expect(codes(search('sabão em'))).toEqual(['DEMO-004']);
  });

  it('encontra pelo código do sistema e pelo código de barras', () => {
    expect(codes(search('demo-004'))).toEqual(['DEMO-004']);
    expect(codes(search('000107'))).toEqual(['DEMO-010']);
    expect(codes(search('DEMO'))).toEqual(['DEMO-002', 'DEMO-004', 'DEMO-010']);
  });

  it('mantém a ordem recebida e não procura no preço', () => {
    const priced = PRODUCTS.map((item) => ({ ...item, priceInCentavos: 1099 }));

    expect(codes(search('0', priced))).toEqual(['DEMO-002', 'DEMO-004', 'DEMO-010']);
    expect(search('1099', priced)).toEqual([]);
  });

  it('devolve a própria lista com termo vazio ou só de espaços', () => {
    const index = buildProductSearchIndex(PRODUCTS);

    expect(searchProductIndex(index, '')).toBe(PRODUCTS);
    expect(searchProductIndex(index, '   ')).toBe(PRODUCTS);
  });

  it('devolve lista vazia quando nada corresponde', () => {
    expect(search('arroz')).toEqual([]);
  });

  it('encontra o produto com nome ou código de barras em conflito pelas variantes', () => {
    const disputed = product('DEMO-020', null, null);
    const conflicts = [
      {
        systemCode: 'DEMO-020',
        field: 'displayName',
        status: 'open',
        chosenValue: null,
        variants: [
          { value: 'FEIJÃO PRETO 1KG', copyCount: 1, texts: [] },
          { value: 'FEIJAO PRETO 1KG', copyCount: 1, texts: [] },
        ],
      },
      {
        systemCode: 'DEMO-020',
        field: 'ean',
        status: 'open',
        chosenValue: null,
        variants: [
          { value: '2000000000206', copyCount: 1, texts: [] },
          { value: null, copyCount: 1, texts: [] },
        ],
      },
      {
        systemCode: 'DEMO-020',
        field: 'priceInCentavos',
        status: 'open',
        chosenValue: null,
        variants: [
          { value: 899, copyCount: 1, texts: [] },
          { value: 999, copyCount: 1, texts: [] },
        ],
      },
    ];

    expect(codes(search('feijao', [disputed], conflicts))).toEqual(['DEMO-020']);
    expect(codes(search('0206', [disputed], conflicts))).toEqual(['DEMO-020']);
    expect(search('899', [disputed], conflicts)).toEqual([]);
  });
});
