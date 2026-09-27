// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { lf1Text, qrFixtureReadings, readingOf } from '../../test-fixtures/readingFixtures.js';
import { detectConflicts } from './conflictDetection.js';
import {
  IGNORED_CHOICE_MESSAGES,
  IGNORED_CHOICE_REASONS,
  applyResolutions,
  countConflicts,
} from './conflictResolution.js';
import { identifyCopies } from './copyIdentity.js';
import { summarizeProducts } from './inventoryAggregation.js';

const SUGAR = {
  systemCode: 'DEMO-002',
  displayName: 'AÇÚCAR CRISTAL 1KG',
  price: 549,
  ean: '2000000000022',
  ncm: '17019900',
};

const SUGAR_READINGS = [
  lf1Text({ ...SUGAR, copy: 'c1' }),
  lf1Text({ ...SUGAR, price: 599, copy: 'c2' }),
  lf1Text({ ...SUGAR, price: 599, copy: 'c3' }),
].map((text, index) => readingOf(`s${index}`, 'foto-a', text));

const CANTINHO_READINGS = [
  ...qrFixtureReadings('qr-4.png', 'foto-4'),
  ...qrFixtureReadings('qr-8.png', 'foto-8'),
];

function resolution(systemCode, choices) {
  return { sessionId: 'sessao-teste', systemCode, choices };
}

/** O mesmo caminho que o relatorio faz: leituras, exemplares, resumo, conflitos e escolhas. */
function resolve(readings, resolutions) {
  const { copies } = identifyCopies(readings);

  return applyResolutions(summarizeProducts(copies), detectConflicts(copies), resolutions);
}

const productOf = (result, systemCode) =>
  result.products.find((product) => product.systemCode === systemCode);

describe('applyResolutions', () => {
  it('preenche o preço escolhido e recalcula o total, com a mesma quantidade', () => {
    const before = productOf(resolve(SUGAR_READINGS, []), 'DEMO-002');
    const result = resolve(SUGAR_READINGS, [resolution('DEMO-002', { priceInCentavos: 599 })]);

    expect(before).toMatchObject({
      quantity: 3,
      priceInCentavos: null,
      totalInCentavos: null,
      conflictingFields: ['priceInCentavos'],
      resolvedFields: [],
      openConflictFields: ['priceInCentavos'],
    });
    expect(result).toEqual({
      products: [
        {
          systemCode: 'DEMO-002',
          quantity: 3,
          displayName: SUGAR.displayName,
          priceInCentavos: 599,
          ean: SUGAR.ean,
          ncm: SUGAR.ncm,
          totalInCentavos: 1797,
          totalOutOfRange: false,
          conflictingFields: ['priceInCentavos'],
          resolvedFields: ['priceInCentavos'],
          openConflictFields: [],
        },
      ],
      ignoredChoices: [],
    });
  });

  it('reaplica a escolha depois de recalcular com mais uma leitura', () => {
    const choice = [resolution('DEMO-002', { priceInCentavos: 549 })];
    const more = readingOf('s9', 'foto-b', lf1Text({ ...SUGAR, price: 599, copy: 'c4' }));
    const product = productOf(resolve([...SUGAR_READINGS, more], choice), 'DEMO-002');

    expect(product).toMatchObject({
      quantity: 4,
      priceInCentavos: 549,
      totalInCentavos: 2196,
      resolvedFields: ['priceInCentavos'],
      openConflictFields: [],
    });
  });

  it('aplica a escolha sem código de barras e deixa o NCM aberto', () => {
    const result = resolve(CANTINHO_READINGS, [resolution('118789', { ean: null })]);
    const cantinho = productOf(result, '118789');

    expect(cantinho).toMatchObject({
      quantity: 2,
      ean: null,
      ncm: null,
      totalInCentavos: 171980,
      conflictingFields: ['ean', 'ncm'],
      resolvedFields: ['ean'],
      openConflictFields: ['ncm'],
    });
    expect(result.ignoredChoices).toEqual([]);
    expect(countConflicts(result.products)).toEqual({ open: 1, resolved: 1 });
  });

  it('aplica as duas escolhas do mesmo produto', () => {
    const result = resolve(CANTINHO_READINGS, [
      resolution('118789', { ean: '7899075420416', ncm: '94035000' }),
    ]);

    expect(productOf(result, '118789')).toMatchObject({
      ean: '7899075420416',
      ncm: '94035000',
      resolvedFields: ['ean', 'ncm'],
      openConflictFields: [],
    });
    expect(countConflicts(result.products)).toEqual({ open: 0, resolved: 2 });
  });

  it('ignora a escolha quando a foto sai e o conflito some, com os dados que sobraram', () => {
    const onlyQr4 = qrFixtureReadings('qr-4.png', 'foto-4');
    const result = resolve(onlyQr4, [resolution('118789', { ean: null, ncm: null })]);

    expect(productOf(result, '118789')).toMatchObject({
      quantity: 1,
      ean: '7899075420416',
      ncm: '94035000',
      conflictingFields: [],
      resolvedFields: [],
      openConflictFields: [],
    });
    expect(result.ignoredChoices).toEqual([
      {
        systemCode: '118789',
        field: 'ean',
        value: null,
        reason: 'no-conflict',
        message: 'os exemplares não divergem mais neste campo',
      },
      {
        systemCode: '118789',
        field: 'ncm',
        value: null,
        reason: 'no-conflict',
        message: 'os exemplares não divergem mais neste campo',
      },
    ]);
  });

  it('ignora o valor que deixou de ser variante e mantém o campo aberto', () => {
    // O exemplar de 549 saiu; sobraram duas variantes, e a escolhida nao e nenhuma.
    const readings = [
      ...SUGAR_READINGS.slice(1),
      readingOf('s9', 'foto-b', lf1Text({ ...SUGAR, price: 649, copy: 'c5' })),
    ];
    const result = resolve(readings, [
      resolution('DEMO-002', { displayName: SUGAR.displayName, priceInCentavos: 549 }),
    ]);

    expect(productOf(result, 'DEMO-002')).toMatchObject({
      quantity: 3,
      priceInCentavos: null,
      totalInCentavos: null,
      resolvedFields: [],
      openConflictFields: ['priceInCentavos'],
    });
    expect(result.ignoredChoices).toEqual([
      {
        systemCode: 'DEMO-002',
        field: 'displayName',
        value: SUGAR.displayName,
        reason: IGNORED_CHOICE_REASONS.NO_CONFLICT,
        message: IGNORED_CHOICE_MESSAGES['no-conflict'],
      },
      {
        systemCode: 'DEMO-002',
        field: 'priceInCentavos',
        value: 549,
        reason: IGNORED_CHOICE_REASONS.NOT_A_VARIANT,
        message: 'o valor escolhido não está mais entre as variantes',
      },
    ]);
  });

  it('lista a escolha de produto que não aparece mais nas leituras, pela ordem dos códigos', () => {
    const result = resolve(SUGAR_READINGS, [
      resolution('DEMO-10', { ncm: null }),
      resolution('DEMO-9', { displayName: 'SAL', priceInCentavos: 199 }),
      resolution('DEMO-002', { priceInCentavos: 1 }),
    ]);

    expect(
      result.ignoredChoices.map(({ systemCode, field, reason }) => [systemCode, field, reason]),
    ).toEqual([
      ['DEMO-002', 'priceInCentavos', 'not-a-variant'],
      ['DEMO-9', 'displayName', 'no-product'],
      ['DEMO-9', 'priceInCentavos', 'no-product'],
      ['DEMO-10', 'ncm', 'no-product'],
    ]);
    expect(result.ignoredChoices[1].message).toBe(
      'o produto não aparece mais nas leituras da sessão',
    );
    expect(result.products).toHaveLength(1);
  });

  it('mantém a quantidade e a ordem dos produtos com e sem resolução', () => {
    const readings = [...CANTINHO_READINGS, ...SUGAR_READINGS];
    const without = resolve(readings, []);
    const withChoices = resolve(readings, [
      resolution('118789', { ean: null, ncm: null }),
      resolution('DEMO-002', { priceInCentavos: 549 }),
    ]);
    const quantities = (result) =>
      result.products.map(({ systemCode, quantity }) => [systemCode, quantity]);

    expect(quantities(withChoices)).toEqual(quantities(without));
    expect(countConflicts(without.products)).toEqual({ open: 3, resolved: 0 });
    expect(countConflicts(withChoices.products)).toEqual({ open: 0, resolved: 3 });
  });

  it('marca o total fora do limite quando o preço escolhido passa do inteiro seguro', () => {
    const max = Number.MAX_SAFE_INTEGER;
    const readings = [
      lf1Text({ systemCode: 'A', displayName: 'CARO', price: max, copy: 'c1' }),
      lf1Text({ systemCode: 'A', displayName: 'CARO', price: 1, copy: 'c2' }),
    ].map((text, index) => readingOf(`m${index}`, 'foto-a', text));
    const product = productOf(resolve(readings, [resolution('A', { priceInCentavos: max })]), 'A');

    expect(product).toMatchObject({
      priceInCentavos: max,
      totalInCentavos: null,
      totalOutOfRange: true,
      resolvedFields: ['priceInCentavos'],
    });
  });

  it('devolve listas vazias sem produto e sem resolução', () => {
    expect(applyResolutions([], [], [])).toEqual({ products: [], ignoredChoices: [] });
  });
});

describe('countConflicts', () => {
  it('conta por produto e campo', () => {
    const readings = [
      lf1Text({ systemCode: 'X', displayName: 'A', price: 1, ean: '20000042', copy: 'c1' }),
      lf1Text({ systemCode: 'X', displayName: 'B', price: 2, copy: 'c2' }),
      ...CANTINHO_READINGS.map((reading) => reading.text),
    ].map((text, index) => readingOf(`k${index}`, 'foto-a', text));

    const result = resolve(readings, [resolution('X', { displayName: 'B' })]);

    expect(countConflicts(result.products)).toEqual({ open: 4, resolved: 1 });
    expect(countConflicts([])).toEqual({ open: 0, resolved: 0 });
  });
});
