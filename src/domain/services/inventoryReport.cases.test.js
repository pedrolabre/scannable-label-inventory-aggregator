// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';
import {
  TOTAL_VALUE_ISSUES,
  TOTAL_VALUE_ISSUE_MESSAGES,
  buildInventoryReport,
} from './inventoryReport.js';

const SESSION = { id: 'sessao-teste', name: 'Inventário 29/09/2026' };
const GENERATED_AT = '2026-09-29T22:00:00.000Z';

const at = (minute) => `2026-09-29T12:${String(minute).padStart(2, '0')}:00.000Z`;

const resolution = (systemCode, choices) => ({ sessionId: SESSION.id, systemCode, choices });

function report(overrides = {}) {
  return buildInventoryReport({
    session: SESSION,
    sources: [],
    readings: [],
    resolutions: [],
    generatedAt: GENERATED_AT,
    ...overrides,
  });
}

describe('buildInventoryReport: ordem', () => {
  it('ordena produto pelo código com números como número e exemplar com c2 antes de c10', () => {
    const texts = [
      lf1Text({ systemCode: '10', displayName: 'DEZ', price: 1, copy: 'c10' }),
      lf1Text({ systemCode: 'A-10', displayName: 'A DEZ', price: 1 }),
      lf1Text({ systemCode: '2', displayName: 'DOIS', price: 1 }),
      lf1Text({ systemCode: '10', displayName: 'DEZ', price: 1, copy: 'c2' }),
      lf1Text({ systemCode: 'A-2', displayName: 'A DOIS', price: 1 }),
      lf1Text({ systemCode: '10', displayName: 'DEZ', price: 1, copy: 'c1' }),
    ];
    const result = report({
      sources: [sourceOf('f1')],
      readings: texts.map((text, index) => readingOf(`r${index}`, 'f1', text)),
      resolutions: [],
    });

    expect(result.products.map((product) => product.systemCode)).toEqual([
      '2',
      '10',
      'A-2',
      'A-10',
    ]);
    expect(result.copies.map((copy) => `${copy.systemCode}/${copy.copy}`)).toEqual([
      '2/c1',
      '10/c1',
      '10/c2',
      '10/c10',
      'A-2/c1',
      'A-10/c1',
    ]);
  });

  it('põe as leituras de uma foto na ordem do banco, e não na ordem recebida', () => {
    const text = lf1Text({ systemCode: 'A', displayName: 'A', price: 1 });
    const inBank = [
      readingOf('r1', 'f1', text),
      readingOf('r3', 'f1', 'x'),
      readingOf('r4', 'f1', 'y'),
      readingOf('r2', 'f2', text),
    ];
    const sources = [
      sourceOf('f2', { processedAt: at(2) }),
      sourceOf('f1', { processedAt: at(1) }),
    ];
    const result = report({ sources, readings: [...inBank].reverse(), resolutions: [] });

    expect(result.copies[0].sources.map((source) => source.sourceId)).toEqual(['f1', 'f2']);
    expect(result.rejected.map((entry) => entry.readingId)).toEqual(['r3', 'r4']);
    expect(result.sources.map((source) => source.sourceId)).toEqual(['f1', 'f2']);
  });
});

describe('buildInventoryReport: valor total', () => {
  const single = (systemCode, price, copy = 'c1') =>
    lf1Text({ systemCode, displayName: systemCode, price, copy });

  function totalsOf(texts, resolutions = []) {
    return report({
      sources: [sourceOf('f1')],
      readings: texts.map((text, index) => readingOf(`r${index}`, 'f1', text)),
      resolutions,
    }).totals;
  }

  it('sai sem valor com preço em conflito aberto, e com valor depois da escolha', () => {
    const texts = [single('A', 100), single('A', 150, 'c2'), single('B', 7)];

    expect(totalsOf(texts)).toMatchObject({
      totalValueInCentavos: null,
      totalValueIssue: {
        code: TOTAL_VALUE_ISSUES.OPEN_PRICE_CONFLICT,
        message: TOTAL_VALUE_ISSUE_MESSAGES[TOTAL_VALUE_ISSUES.OPEN_PRICE_CONFLICT],
      },
    });
    expect(totalsOf(texts, [resolution('A', { priceInCentavos: 150 })])).toMatchObject({
      totalValueInCentavos: 307,
      totalValueIssue: null,
    });
  });

  it('sai sem valor quando a soma passa do inteiro seguro, com cada total dentro dele', () => {
    const half = 5_000_000_000_000_000;

    expect(totalsOf([single('A', half), single('B', half)])).toMatchObject({
      totalValueInCentavos: null,
      totalValueIssue: {
        code: TOTAL_VALUE_ISSUES.OUT_OF_RANGE,
        message: 'o valor passa do limite de cálculo',
      },
    });
  });

  it('sai sem valor quando o total de um produto já passa do limite', () => {
    const half = 5_000_000_000_000_000;

    expect(totalsOf([single('A', half), single('A', half, 'c2')])).toMatchObject({
      totalValueInCentavos: null,
      totalValueIssue: { code: TOTAL_VALUE_ISSUES.OUT_OF_RANGE },
    });
  });

  it('soma exata até o maior inteiro seguro', () => {
    const texts = [single('A', Number.MAX_SAFE_INTEGER - 1), single('B', 1)];

    expect(totalsOf(texts)).toMatchObject({
      totalValueInCentavos: Number.MAX_SAFE_INTEGER,
      totalValueIssue: null,
    });
  });
});

describe('buildInventoryReport: casos de borda', () => {
  it('sessão vazia sai com as seções vazias, valor zero e exportável', () => {
    const result = report({ sources: [], readings: [], resolutions: [] });

    expect(result).toEqual({
      header: {
        sessionId: SESSION.id,
        sessionName: SESSION.name,
        generatedAt: GENERATED_AT,
        sourceCount: 0,
        failedSourceCount: 0,
      },
      totals: {
        copyCount: 0,
        productCount: 0,
        totalValueInCentavos: 0,
        totalValueIssue: null,
        rejectedCount: 0,
        warningCount: 0,
        resolvedConflictCount: 0,
        openConflictCount: 0,
      },
      products: [],
      copies: [],
      rejected: [],
      sources: [],
      conflicts: [],
      ignoredChoices: [],
      exportable: true,
      exportBlockers: [],
    });
  });

  it('sessão só com fotos com falha', () => {
    const failed = [
      sourceOf('f2', { processedAt: at(2), failureReason: 'corrupted-file' }),
      sourceOf('f1', { processedAt: at(1), failureReason: 'unsupported-format' }),
    ];
    const result = report({ sources: failed, readings: [], resolutions: [] });

    expect(result.header).toMatchObject({ sourceCount: 2, failedSourceCount: 2 });
    expect(result.totals).toMatchObject({ copyCount: 0, totalValueInCentavos: 0 });
    expect(result.sources.map((source) => [source.sourceId, source.failureMessage])).toEqual([
      ['f1', 'formato de imagem não suportado'],
      ['f2', 'arquivo corrompido ou incompleto'],
    ]);
    expect(result.exportable).toBe(true);
  });

  it('repassa o generatedAt como veio, sem converter', () => {
    const local = '2026-09-29T19:00:00-03:00';

    expect(report({ generatedAt: local }).header.generatedAt).toBe(local);
  });

  it('conta a leitura de foto desconhecida, sem nome de arquivo e fora da seção Fotos', () => {
    const text = lf1Text({ systemCode: 'A', displayName: 'A', price: 1 });
    const result = report({
      sources: [sourceOf('f1')],
      readings: [readingOf('r1', 'sumida', text), readingOf('r2', 'sumida', 'x')],
      resolutions: [],
    });

    expect(result.totals).toMatchObject({ copyCount: 1, rejectedCount: 1 });
    expect(result.copies[0].sources).toEqual([{ sourceId: 'sumida', fileName: null }]);
    expect(result.rejected[0].fileName).toBeNull();
    expect(result.sources.map((source) => source.sourceId)).toEqual(['f1']);
  });
});
