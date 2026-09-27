// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { lf1Text, qrFixtureReadings, readingOf } from '../../test-fixtures/readingFixtures.js';
import { identifyCopies } from './copyIdentity.js';
import { PRODUCT_FIELDS, summarizeProducts } from './inventoryAggregation.js';

function productsOf(texts) {
  const readings = texts.map((text, index) => readingOf(`l${index}`, 'foto-a', text));

  return summarizeProducts(identifyCopies(readings).copies);
}

const SUGAR = {
  systemCode: 'DEMO-002',
  displayName: 'AÇÚCAR CRISTAL 1KG',
  price: 549,
  ean: '2000000000022',
  ncm: '17019900',
};

describe('summarizeProducts', () => {
  it('conta os exemplares únicos por código e multiplica pelo preço em centavos inteiros', () => {
    const products = productsOf([
      lf1Text({ ...SUGAR, copy: 'c1' }),
      lf1Text({ ...SUGAR, copy: 'c2' }),
      lf1Text({ ...SUGAR, copy: 'c2' }),
      lf1Text({ ...SUGAR, copy: 'c3' }),
      lf1Text({ systemCode: 'DEMO-001', displayName: 'CAFÉ', price: 1899 }),
    ]);

    expect(products).toEqual([
      {
        systemCode: 'DEMO-001',
        quantity: 1,
        displayName: 'CAFÉ',
        priceInCentavos: 1899,
        ean: null,
        ncm: null,
        totalInCentavos: 1899,
        totalOutOfRange: false,
        conflictingFields: [],
      },
      {
        systemCode: 'DEMO-002',
        quantity: 3,
        displayName: 'AÇÚCAR CRISTAL 1KG',
        priceInCentavos: 549,
        ean: '2000000000022',
        ncm: '17019900',
        totalInCentavos: 1647,
        totalOutOfRange: false,
        conflictingFields: [],
      },
    ]);
  });

  it('deixa preço e total sem valor quando os exemplares divergem no preço, com a mesma quantidade', () => {
    const [product] = productsOf([
      lf1Text({ ...SUGAR, copy: 'c1' }),
      lf1Text({ ...SUGAR, price: 599, copy: 'c2' }),
      lf1Text({ ...SUGAR, price: 599, copy: 'c3' }),
    ]);

    expect(product).toMatchObject({
      quantity: 3,
      displayName: SUGAR.displayName,
      priceInCentavos: null,
      totalInCentavos: null,
      totalOutOfRange: false,
      conflictingFields: ['priceInCentavos'],
    });
  });

  it('deixa o nome sem valor quando diverge e mantém o total do preço único', () => {
    const [product] = productsOf([
      lf1Text({ ...SUGAR, copy: 'c1' }),
      lf1Text({ ...SUGAR, displayName: 'ACUCAR CRISTAL 1 KG', copy: 'c2' }),
    ]);

    expect(product).toMatchObject({
      displayName: null,
      priceInCentavos: 549,
      totalInCentavos: 1098,
      conflictingFields: ['displayName'],
    });
  });

  it('trata código de barras e NCM presentes num exemplar e ausentes no outro como divergência', () => {
    const readings = [
      ...qrFixtureReadings('qr-4.png', 'foto-4'),
      ...qrFixtureReadings('qr-8.png', 'foto-8'),
    ];
    const products = summarizeProducts(identifyCopies(readings).copies);
    const cantinho = products.find((product) => product.systemCode === '118789');

    expect(cantinho).toMatchObject({
      quantity: 2,
      displayName: 'CANTINHO CAFE RUBI',
      priceInCentavos: 85990,
      ean: null,
      ncm: null,
      totalInCentavos: 171980,
      conflictingFields: ['ean', 'ncm'],
    });
  });

  it('dá a lista dos campos divergentes na ordem das posições', () => {
    const [product] = productsOf([
      lf1Text({
        systemCode: 'X',
        displayName: 'A',
        price: 1,
        ean: '20000042',
        ncm: '12345678',
        copy: 'c1',
      }),
      lf1Text({ systemCode: 'X', displayName: 'B', price: 2, copy: 'c2' }),
    ]);

    expect(PRODUCT_FIELDS).toEqual(['displayName', 'priceInCentavos', 'ean', 'ncm']);
    expect(product.conflictingFields).toEqual(PRODUCT_FIELDS);
  });

  it('marca o total fora do limite quando quantidade vezes preço passa do inteiro seguro', () => {
    const max = Number.MAX_SAFE_INTEGER;
    const [atLimit, above] = productsOf([
      lf1Text({ systemCode: 'A', displayName: 'NO LIMITE', price: max, copy: 'c1' }),
      lf1Text({ systemCode: 'B', displayName: 'ACIMA', price: max, copy: 'c1' }),
      lf1Text({ systemCode: 'B', displayName: 'ACIMA', price: max, copy: 'c2' }),
    ]);

    expect(atLimit).toMatchObject({ quantity: 1, totalInCentavos: max, totalOutOfRange: false });
    expect(above).toMatchObject({
      quantity: 2,
      priceInCentavos: max,
      totalInCentavos: null,
      totalOutOfRange: true,
    });
  });

  it('ordena os produtos pelo código, com números comparados como número', () => {
    const products = productsOf(
      ['10', '9', 'DEMO-10', 'DEMO-2'].map((systemCode) =>
        lf1Text({ systemCode, displayName: 'P', price: 1 }),
      ),
    );

    expect(products.map((product) => product.systemCode)).toEqual(['9', '10', 'DEMO-2', 'DEMO-10']);
  });

  it('devolve lista vazia sem exemplar', () => {
    expect(summarizeProducts([])).toEqual([]);
  });
});

describe('summarizeProducts com 10.000 exemplares', () => {
  const PRODUCT_COUNT = 250;
  const COPIES_PER_PRODUCT = 40;
  const priceOf = (index) => 1 + index * 7919 + (index % 3) * 100_000_007;

  const texts = [];

  for (let product = 0; product < PRODUCT_COUNT; product += 1) {
    for (let copy = 1; copy <= COPIES_PER_PRODUCT; copy += 1) {
      texts.push(
        lf1Text({
          systemCode: `VOL-${product}`,
          displayName: `PRODUTO ${product}`,
          price: priceOf(product),
          copy: `c${copy}`,
        }),
      );
    }
  }

  const readings = [
    ...texts.map((text, index) => readingOf(`a${index}`, 'foto-a', text)),
    ...texts.map((text, index) => readingOf(`b${index}`, 'foto-b', text)),
  ];
  const { copies } = identifyCopies(readings);
  const products = summarizeProducts(copies);

  it('conta cada texto uma vez, mesmo lido em duas fotos', () => {
    expect(texts).toHaveLength(10_000);
    expect(copies).toHaveLength(10_000);
    expect(copies.every((copy) => copy.readingCount === 2)).toBe(true);
    expect(products).toHaveLength(PRODUCT_COUNT);
  });

  it('soma os totais em inteiros, igual à soma exata', () => {
    let expected = 0n;

    for (let product = 0; product < PRODUCT_COUNT; product += 1) {
      expected += BigInt(COPIES_PER_PRODUCT) * BigInt(priceOf(product));
    }

    const sum = products.reduce((total, product) => total + product.totalInCentavos, 0);

    expect(products.every((product) => product.quantity === COPIES_PER_PRODUCT)).toBe(true);
    expect(products.every((product) => Number.isSafeInteger(product.totalInCentavos))).toBe(true);
    expect(Number.isSafeInteger(sum)).toBe(true);
    expect(BigInt(sum)).toBe(expected);
  });
});
