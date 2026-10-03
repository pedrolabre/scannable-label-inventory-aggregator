// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { buildInventoryReport } from '../../domain/services/inventoryReport.js';
import { lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';

import { copyNumberByText, copyNumbersOf, productDetailOf } from './productDetail.js';

const SESSION = { id: 'sessao-teste', name: 'Inventário' };

function reportOf(readings, resolutions = []) {
  return buildInventoryReport({
    session: SESSION,
    sources: [sourceOf('f1')],
    readings,
    resolutions,
    generatedAt: '2026-10-06T12:00:00.000Z',
  });
}

const text = (code, price, copy, ean = '') =>
  lf1Text({ systemCode: code, displayName: `PRODUTO ${code}`, price, ean, copy });

describe('productDetailOf', () => {
  it('recorta conflitos, exemplares e escolhas ignoradas do produto, na ordem do relatório', () => {
    const report = reportOf(
      [
        readingOf('l1', 'f1', text('A-1', 900, 'c2', '20000042')),
        readingOf('l2', 'f1', text('A-1', 1000, 'c1')),
        readingOf('l3', 'f1', text('B-2', 500, 'c1')),
      ],
      [
        { sessionId: SESSION.id, systemCode: 'A-1', choices: { displayName: 'OUTRO' } },
        { sessionId: SESSION.id, systemCode: 'SUMIU', choices: { ean: null } },
      ],
    );
    const detail = productDetailOf(report, 'A-1');

    expect(detail.conflicts.map((conflict) => conflict.field)).toEqual(['priceInCentavos', 'ean']);
    expect(detail.copies.map((copy) => copy.copy)).toEqual(['c1', 'c2']);
    expect(detail.ignoredChoices).toEqual([
      expect.objectContaining({ systemCode: 'A-1', field: 'displayName', reason: 'no-conflict' }),
    ]);
  });

  it('deixa de fora a escolha de produto que saiu da sessão', () => {
    const report = reportOf(
      [readingOf('l1', 'f1', text('A-1', 900, 'c1'))],
      [{ sessionId: SESSION.id, systemCode: 'SUMIU', choices: { ean: null } }],
    );

    expect(report.ignoredChoices).toHaveLength(1);
    expect(productDetailOf(report, 'SUMIU').ignoredChoices).toEqual([]);
  });
});

describe('copyNumbersOf', () => {
  it('diz o cN de cada texto de uma variante e ignora texto desconhecido', () => {
    const copies = [
      { text: 'LF1|A|N|1|||c1', copy: 'c1' },
      { text: 'LF1|A|N|2|||c1', copy: 'c1' },
      { text: 'LF1|A|N|1|||c3', copy: 'c3' },
    ];
    const numbers = copyNumberByText(copies);

    expect(copyNumbersOf(['LF1|A|N|1|||c1', 'LF1|A|N|1|||c3'], numbers)).toEqual(['c1', 'c3']);
    expect(copyNumbersOf(['LF1|A|N|9|||c9'], numbers)).toEqual([]);
  });
});
