// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  boxAt,
  lf1Text,
  qrFixtureReadings,
  readingOf,
  sourceOf,
} from '../../test-fixtures/readingFixtures.js';
import { EXPORT_BLOCKERS, buildInventoryReport } from './inventoryReport.js';
import { TRUNCATION_MARK } from './reportSections.js';

const SESSION = {
  id: 'sessao-teste',
  name: 'Inventário 29/09/2026',
  createdAt: '2026-09-29T11:00:00.000Z',
  updatedAt: '2026-09-29T12:30:00.000Z',
};
const GENERATED_AT = '2026-09-29T22:00:00.000Z';

const SUGAR = {
  systemCode: 'DEMO-002',
  displayName: 'AÇÚCAR CRISTAL 1KG',
  ean: '2000000000022',
  ncm: '17019900',
};
const SOAP = {
  systemCode: 'DEMO-004',
  displayName: 'SABÃO EM PÓ 800G',
  price: 1275,
  ean: '20000042',
  ncm: '34022000',
};
const APPLE = 'LF1|DEMO-005|MAÇÃ FUJI KG|1099|||c1';
const CANTINHO_WITH_CODES = 'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1';
const CANTINHO_WITHOUT_CODES = 'LF1|118789|CANTINHO CAFE RUBI|85990|||c1';
const LONG_URL = `https://exemplo.test/produto/${'a'.repeat(120)}`;
const NEXT_VERSION = 'LF2|DEMO-011|ARROZ 5KG|2590|||c1';

const at = (minute) => `2026-09-29T12:${String(minute).padStart(2, '0')}:00.000Z`;

/**
 * Sessao completa: qr-4 e qr-8 com o 118789 divergente no EAN e no NCM e a
 * maca lida em duas posicoes da qr-8, uma terceira foto com dois rejeitados,
 * o acucar com outro preco e o sabao no c10, uma foto com falha e uma lida sem
 * simbolo.
 */
const SOURCES = [
  sourceOf('f1', { fileName: 'IMG_0001.jpg', origin: 'camera', processedAt: at(1) }),
  sourceOf('f2', { fileName: 'IMG_0002.jpg', processedAt: at(2) }),
  sourceOf('f3', { fileName: 'IMG_0003.jpg', origin: 'camera', processedAt: at(3) }),
  sourceOf('f4', {
    fileName: 'IMG_0004.HEIC',
    processedAt: at(4),
    failureReason: 'unsupported-format',
  }),
  sourceOf('f5', { fileName: 'IMG_0005.jpg', processedAt: at(5) }),
];

const READINGS = [
  ...qrFixtureReadings('qr-4.png', 'f1'),
  ...qrFixtureReadings('qr-8.png', 'f2'),
  readingOf('f3-1', 'f3', LONG_URL),
  readingOf('f3-2', 'f3', lf1Text({ ...SUGAR, price: 599, copy: 'c2' }), boxAt(0, 0, 120)),
  readingOf('f3-3', 'f3', NEXT_VERSION),
  readingOf('f3-4', 'f3', lf1Text({ ...SOAP, copy: 'c10' }), boxAt(150, 0, 120)),
];

const resolution = (systemCode, choices) => ({ sessionId: SESSION.id, systemCode, choices });

const SUGAR_PRICE = resolution('DEMO-002', { priceInCentavos: 599 });
const CANTINHO_CODES = resolution('118789', { ean: '7899075420416', ncm: '94035000' });
const VANISHED = resolution('DEMO-999', { displayName: 'PRODUTO REMOVIDO' });

function report(overrides = {}) {
  return buildInventoryReport({
    session: SESSION,
    sources: SOURCES,
    readings: READINGS,
    resolutions: [SUGAR_PRICE, VANISHED],
    generatedAt: GENERATED_AT,
    ...overrides,
  });
}

describe('buildInventoryReport: sessão completa', () => {
  const result = report();

  it('cabeçalho com a sessão, o instante recebido e as fotos', () => {
    expect(result.header).toEqual({
      sessionId: 'sessao-teste',
      sessionName: 'Inventário 29/09/2026',
      generatedAt: GENERATED_AT,
      sourceCount: 5,
      failedSourceCount: 1,
    });
  });

  it('totais com exemplares, produtos, valor, rejeitados, avisos e conflitos', () => {
    expect(result.totals).toEqual({
      copyCount: 13,
      productCount: 10,
      totalValueInCentavos: 181502,
      totalValueIssue: null,
      rejectedCount: 2,
      warningCount: 1,
      resolvedConflictCount: 1,
      openConflictCount: 2,
    });
  });

  it('resumo por produto na ordem dos códigos, com quantidade e total', () => {
    expect(
      result.products.map((product) => [
        product.systemCode,
        product.quantity,
        product.priceInCentavos,
        product.totalInCentavos,
      ]),
    ).toEqual([
      ['118789', 2, 85990, 171980],
      ['DEMO-002', 2, 599, 1198],
      ['DEMO-003', 1, 899, 899],
      ['DEMO-004', 2, 1275, 2550],
      ['DEMO-005', 1, 1099, 1099],
      ['DEMO-006', 1, 1690, 1690],
      ['DEMO-007', 1, 799, 799],
      ['DEMO-008', 1, 529, 529],
      ['DEMO-009', 1, 459, 459],
      ['DEMO-010', 1, 299, 299],
    ]);
  });

  it('resumo por produto campo a campo: conflito aberto, resolvido e aviso', () => {
    const byCode = new Map(result.products.map((product) => [product.systemCode, product]));

    expect(byCode.get('118789')).toEqual({
      systemCode: '118789',
      quantity: 2,
      displayName: 'CANTINHO CAFE RUBI',
      priceInCentavos: 85990,
      ean: null,
      ncm: null,
      totalInCentavos: 171980,
      totalOutOfRange: false,
      conflictingFields: ['ean', 'ncm'],
      resolvedFields: [],
      openConflictFields: ['ean', 'ncm'],
      warningCount: 0,
    });
    expect(byCode.get('DEMO-002')).toEqual({
      systemCode: 'DEMO-002',
      quantity: 2,
      displayName: SUGAR.displayName,
      priceInCentavos: 599,
      ean: SUGAR.ean,
      ncm: SUGAR.ncm,
      totalInCentavos: 1198,
      totalOutOfRange: false,
      conflictingFields: ['priceInCentavos'],
      resolvedFields: ['priceInCentavos'],
      openConflictFields: [],
      warningCount: 0,
    });
    expect(byCode.get('DEMO-005')).toMatchObject({
      quantity: 1,
      conflictingFields: [],
      resolvedFields: [],
      openConflictFields: [],
      warningCount: 1,
    });
  });

  it('exemplares por código e número, com fotos, leituras e aviso', () => {
    expect(
      result.copies.map((copy) => [
        copy.systemCode,
        copy.copy,
        copy.readingCount,
        copy.sources.map((source) => source.fileName),
        copy.warnings.length,
      ]),
    ).toEqual([
      ['118789', 'c1', 1, ['IMG_0001.jpg'], 0],
      ['118789', 'c1', 1, ['IMG_0002.jpg'], 0],
      ['DEMO-002', 'c1', 1, ['IMG_0001.jpg'], 0],
      ['DEMO-002', 'c2', 1, ['IMG_0003.jpg'], 0],
      ['DEMO-003', 'c1', 1, ['IMG_0001.jpg'], 0],
      ['DEMO-004', 'c2', 1, ['IMG_0001.jpg'], 0],
      ['DEMO-004', 'c10', 1, ['IMG_0003.jpg'], 0],
      ['DEMO-005', 'c1', 2, ['IMG_0002.jpg'], 1],
      ['DEMO-006', 'c3', 1, ['IMG_0002.jpg'], 0],
      ['DEMO-007', 'c1', 1, ['IMG_0002.jpg'], 0],
      ['DEMO-008', 'c1', 1, ['IMG_0002.jpg'], 0],
      ['DEMO-009', 'c1', 1, ['IMG_0002.jpg'], 0],
      ['DEMO-010', 'c1', 1, ['IMG_0002.jpg'], 0],
    ]);
    // Mesmo c1 com dados diferentes: o texto inteiro desempata ('7' antes de '|').
    expect(result.copies[0].text).toBe(CANTINHO_WITH_CODES);
    expect(result.copies[1].text).toBe(CANTINHO_WITHOUT_CODES);
    expect(result.copies[7]).toEqual({
      systemCode: 'DEMO-005',
      copy: 'c1',
      text: APPLE,
      readingCount: 2,
      sources: [{ sourceId: 'f2', fileName: 'IMG_0002.jpg' }],
      warnings: [
        {
          code: 'probable-reprint',
          sourceId: 'f2',
          fileName: 'IMG_0002.jpg',
          positionCount: 2,
          message: 'mesmo texto em 2 posições da mesma foto: provável reimpressão',
        },
      ],
    });
  });

  it('rejeitados com a foto, o motivo e o texto cortado em 120', () => {
    expect(result.rejected).toEqual([
      {
        readingId: 'f3-1',
        sourceId: 'f3',
        fileName: 'IMG_0003.jpg',
        reason: 'not-lf1',
        message: 'não é LF1',
        field: null,
        text: LONG_URL,
        displayText: `${LONG_URL.slice(0, 120)}${TRUNCATION_MARK}`,
        textTruncated: true,
      },
      {
        readingId: 'f3-3',
        sourceId: 'f3',
        fileName: 'IMG_0003.jpg',
        reason: 'unsupported-version',
        message: 'versão não suportada',
        field: null,
        text: NEXT_VERSION,
        displayText: NEXT_VERSION,
        textTruncated: false,
      },
    ]);
  });

  it('fotos na ordem do processamento, com situação, falha e símbolos', () => {
    expect(
      result.sources.map((source) => [
        source.fileName,
        source.origin,
        source.statusMessage,
        source.failureMessage,
        source.symbolCount,
        source.validCount,
        source.rejectedCount,
        source.warnings.map((warning) => warning.code),
      ]),
    ).toEqual([
      ['IMG_0001.jpg', 'camera', 'lida', null, 4, 4, 0, []],
      ['IMG_0002.jpg', 'file', 'lida', null, 8, 8, 0, []],
      ['IMG_0003.jpg', 'camera', 'lida', null, 4, 2, 2, []],
      ['IMG_0004.HEIC', 'file', 'com falha', 'formato de imagem não suportado', 0, 0, 0, []],
      ['IMG_0005.jpg', 'file', 'lida', null, 0, 0, 0, ['no-symbols']],
    ]);
  });

  it('conflitos com a situação e escolhas que deixaram de valer', () => {
    expect(
      result.conflicts.map((conflict) => [
        conflict.systemCode,
        conflict.field,
        conflict.status,
        conflict.chosenValue,
        conflict.variants.map((variant) => [variant.value, variant.copyCount]),
      ]),
    ).toEqual([
      ['118789', 'ean', 'open', null, [['7899075420416', 1], [null, 1]]],
      ['118789', 'ncm', 'open', null, [['94035000', 1], [null, 1]]],
      ['DEMO-002', 'priceInCentavos', 'resolved', 599, [[549, 1], [599, 1]]],
    ]);
    expect(result.ignoredChoices).toEqual([
      {
        systemCode: 'DEMO-999',
        field: 'displayName',
        value: 'PRODUTO REMOVIDO',
        reason: 'no-product',
        message: 'o produto não aparece mais nas leituras da sessão',
      },
    ]);
  });
});

describe('buildInventoryReport: exportação', () => {
  it('bloqueia com conflito aberto e mostra a contagem', () => {
    const result = report();

    expect(result.exportable).toBe(false);
    expect(result.exportBlockers).toEqual([
      {
        code: EXPORT_BLOCKERS.OPEN_CONFLICTS,
        count: 2,
        message: 'exportação bloqueada: 2 conflitos abertos',
      },
    ]);
  });

  it('usa o singular com um conflito aberto', () => {
    const result = report({
      resolutions: [SUGAR_PRICE, resolution('118789', { ean: null })],
    });

    expect(result.exportBlockers[0]).toMatchObject({
      count: 1,
      message: 'exportação bloqueada: 1 conflito aberto',
    });
  });

  it('libera depois de resolver o EAN e o NCM do 118789', () => {
    const result = report({ resolutions: [SUGAR_PRICE, CANTINHO_CODES] });
    const cantinho = result.products[0];

    expect(result.exportable).toBe(true);
    expect(result.exportBlockers).toEqual([]);
    expect(result.totals).toMatchObject({ resolvedConflictCount: 3, openConflictCount: 0 });
    expect(cantinho).toMatchObject({
      quantity: 2,
      ean: '7899075420416',
      ncm: '94035000',
      resolvedFields: ['ean', 'ncm'],
      openConflictFields: [],
    });
    expect(result.conflicts.map((conflict) => conflict.status)).toEqual([
      'resolved',
      'resolved',
      'resolved',
    ]);
  });
});

describe('buildInventoryReport: determinismo', () => {
  it('devolve objetos iguais em profundidade para a mesma entrada', () => {
    const first = report();
    const second = report();

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it('devolve a mesma saída com fontes, leituras e resoluções em outra ordem', () => {
    const shuffled = report({
      sources: [...SOURCES].reverse(),
      readings: [...READINGS].reverse(),
      resolutions: [VANISHED, SUGAR_PRICE],
    });

    expect(shuffled).toEqual(report());
  });

  it('não altera as listas recebidas', () => {
    const sources = [...SOURCES].reverse();
    const readings = [...READINGS].reverse();

    report({ sources, readings });

    expect(sources).toEqual([...SOURCES].reverse());
    expect(readings).toEqual([...READINGS].reverse());
  });
});
