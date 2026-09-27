// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { lf1Text, qrFixtureReadings, readingOf } from '../../test-fixtures/readingFixtures.js';
import { compareVariantValues, detectConflicts, findConflict } from './conflictDetection.js';
import { identifyCopies } from './copyIdentity.js';

function copiesOf(texts) {
  const readings = texts.map((text, index) => readingOf(`l${index}`, 'foto-a', text));

  return identifyCopies(readings).copies;
}

const SUGAR = {
  systemCode: 'DEMO-002',
  displayName: 'AÇÚCAR CRISTAL 1KG',
  price: 549,
  ean: '2000000000022',
  ncm: '17019900',
};

describe('detectConflicts', () => {
  it('dá as duas variantes do preço com quantos exemplares carregam cada uma', () => {
    const c1 = lf1Text({ ...SUGAR, copy: 'c1' });
    const c2 = lf1Text({ ...SUGAR, price: 599, copy: 'c2' });
    const c3 = lf1Text({ ...SUGAR, price: 599, copy: 'c3' });

    expect(detectConflicts(copiesOf([c3, c1, c2]))).toEqual([
      {
        systemCode: 'DEMO-002',
        field: 'priceInCentavos',
        variants: [
          { value: 549, copyCount: 1, texts: [c1] },
          { value: 599, copyCount: 2, texts: [c2, c3] },
        ],
      },
    ]);
  });

  it('compara o preço como número, e não como texto', () => {
    const conflicts = detectConflicts(
      copiesOf([
        lf1Text({ ...SUGAR, price: 1000, copy: 'c1' }),
        lf1Text({ ...SUGAR, price: 999, copy: 'c2' }),
      ]),
    );

    expect(conflicts[0].variants.map((variant) => variant.value)).toEqual([999, 1000]);
  });

  it('dá as variantes do nome pela comparação literal', () => {
    const conflicts = detectConflicts(
      copiesOf([
        lf1Text({ ...SUGAR, copy: 'c1' }),
        lf1Text({ ...SUGAR, displayName: 'ACUCAR CRISTAL 1KG', copy: 'c2' }),
        lf1Text({ ...SUGAR, displayName: 'AÇÚCAR CRISTAL  1KG', copy: 'c3' }),
      ]),
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe('displayName');
    expect(conflicts[0].variants.map(({ value, copyCount }) => ({ value, copyCount }))).toEqual([
      { value: 'ACUCAR CRISTAL 1KG', copyCount: 1 },
      { value: 'AÇÚCAR CRISTAL  1KG', copyCount: 1 },
      { value: 'AÇÚCAR CRISTAL 1KG', copyCount: 1 },
    ]);
  });

  it('dá código de barras e NCM presentes num exemplar e ausentes no outro, com o ausente por último', () => {
    const readings = [
      ...qrFixtureReadings('qr-4.png', 'foto-4'),
      ...qrFixtureReadings('qr-8.png', 'foto-8'),
    ];
    const conflicts = detectConflicts(identifyCopies(readings).copies);
    const withCodes = 'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1';
    const withoutCodes = 'LF1|118789|CANTINHO CAFE RUBI|85990|||c1';

    expect(conflicts).toEqual([
      {
        systemCode: '118789',
        field: 'ean',
        variants: [
          { value: '7899075420416', copyCount: 1, texts: [withCodes] },
          { value: null, copyCount: 1, texts: [withoutCodes] },
        ],
      },
      {
        systemCode: '118789',
        field: 'ncm',
        variants: [
          { value: '94035000', copyCount: 1, texts: [withCodes] },
          { value: null, copyCount: 1, texts: [withoutCodes] },
        ],
      },
    ]);
  });

  it('não vê conflito quando o código de barras e o NCM faltam em todos os exemplares', () => {
    const conflicts = detectConflicts(
      copiesOf([
        lf1Text({ systemCode: 'DEMO-003', displayName: 'FEIJÃO', price: 899, copy: 'c1' }),
        lf1Text({ systemCode: 'DEMO-003', displayName: 'FEIJÃO', price: 899, copy: 'c2' }),
      ]),
    );

    expect(conflicts).toEqual([]);
  });

  it('não vê conflito em produto cujos exemplares concordam, nem na mesma etiqueta lida duas vezes', () => {
    const text = lf1Text({ ...SUGAR, copy: 'c1' });

    expect(detectConflicts(copiesOf([text, text, lf1Text({ ...SUGAR, copy: 'c2' })]))).toEqual([]);
    expect(detectConflicts([])).toEqual([]);
  });

  it('dá os conflitos por código e depois na ordem das posições', () => {
    const conflicts = detectConflicts(
      copiesOf([
        lf1Text({ systemCode: 'DEMO-10', displayName: 'A', price: 1, ncm: '12345678' }),
        lf1Text({ systemCode: 'DEMO-10', displayName: 'B', price: 1, copy: 'c2' }),
        lf1Text({ systemCode: 'DEMO-2', displayName: 'A', price: 1 }),
        lf1Text({ systemCode: 'DEMO-2', displayName: 'A', price: 2, copy: 'c2' }),
      ]),
    );

    expect(conflicts.map(({ systemCode, field }) => `${systemCode} ${field}`)).toEqual([
      'DEMO-2 priceInCentavos',
      'DEMO-10 displayName',
      'DEMO-10 ncm',
    ]);
  });

  it('dá a mesma saída com a entrada invertida', () => {
    const readings = [
      ...qrFixtureReadings('qr-4.png', 'foto-4'),
      ...qrFixtureReadings('qr-8.png', 'foto-8'),
    ];
    const extra = [
      lf1Text({ ...SUGAR, price: 599, copy: 'c2' }),
      lf1Text({ ...SUGAR, displayName: 'AÇUCAR', copy: 'c10' }),
      lf1Text({ ...SUGAR, ean: '', copy: 'c3' }),
    ].map((text, index) => readingOf(`x${index}`, 'foto-x', text));
    const { copies } = identifyCopies([...readings, ...extra]);

    expect(detectConflicts([...copies].reverse())).toEqual(detectConflicts(copies));
    expect(
      detectConflicts(copies).map(({ systemCode, field }) => `${systemCode} ${field}`),
    ).toEqual([
      '118789 ean',
      '118789 ncm',
      'DEMO-002 displayName',
      'DEMO-002 priceInCentavos',
      'DEMO-002 ean',
    ]);
  });
});

describe('compareVariantValues', () => {
  it('põe o valor ausente por último e compara texto pela ordem dos caracteres', () => {
    expect(['B', null, 'A', 'a'].sort((a, b) => compareVariantValues('displayName', a, b))).toEqual(
      ['A', 'B', 'a', null],
    );
    expect(
      [null, '20000042', '12345678'].sort((a, b) => compareVariantValues('ean', a, b)),
    ).toEqual(['12345678', '20000042', null]);
    expect(
      [Number.MAX_SAFE_INTEGER, 0, 10, 9].sort((a, b) =>
        compareVariantValues('priceInCentavos', a, b),
      ),
    ).toEqual([0, 9, 10, Number.MAX_SAFE_INTEGER]);
  });
});

describe('findConflict', () => {
  it('acha o conflito do produto no campo, e nada no campo que não diverge', () => {
    const conflicts = detectConflicts(
      copiesOf([lf1Text({ ...SUGAR, copy: 'c1' }), lf1Text({ ...SUGAR, price: 599, copy: 'c2' })]),
    );

    expect(findConflict(conflicts, 'DEMO-002', 'priceInCentavos')).toBe(conflicts[0]);
    expect(findConflict(conflicts, 'DEMO-002', 'displayName')).toBeUndefined();
    expect(findConflict(conflicts, 'DEMO-999', 'priceInCentavos')).toBeUndefined();
  });
});
