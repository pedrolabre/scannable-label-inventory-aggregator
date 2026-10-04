// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { summaryProductOf } from '../../test-fixtures/readingFixtures.js';

import {
  blockerText,
  doneText,
  emptySessionText,
  firstOpenConflictCode,
  missingProductChoicesOf,
  missingProductText,
} from './exportText.js';

const NO_PRODUCT = 'o produto não aparece mais nas leituras da sessão';

function choice(systemCode, field, reason = 'no-product') {
  return { systemCode, field, value: 'X', reason, message: NO_PRODUCT };
}

describe('textos da exportação', () => {
  it('abre a frase do bloqueio com maiúscula e ponto final', () => {
    expect(
      blockerText({
        code: 'open-conflicts',
        count: 2,
        message: 'exportação bloqueada: 2 conflitos abertos',
      }),
    ).toBe('Exportação bloqueada: 2 conflitos abertos.');
  });

  it('acha o primeiro produto com conflito aberto na ordem do relatório', () => {
    const report = {
      products: [
        summaryProductOf('A'),
        summaryProductOf('B', { openConflictFields: ['ean'] }),
        summaryProductOf('C', { openConflictFields: ['displayName'] }),
      ],
    };

    expect(firstOpenConflictCode(report)).toBe('B');
    expect(firstOpenConflictCode({ products: [summaryProductOf('A')] })).toBeNull();
  });

  it('separa as escolhas sem produto e as descreve com a contagem e os códigos sem repetição', () => {
    const report = {
      ignoredChoices: [
        choice('118789', 'ean'),
        choice('DEMO-001', 'displayName', 'no-conflict'),
        choice('118789', 'ncm'),
        choice('DEMO-002', 'priceInCentavos'),
      ],
    };
    const missing = missingProductChoicesOf(report);

    expect(missing.map((entry) => entry.systemCode)).toEqual(['118789', '118789', 'DEMO-002']);
    expect(missingProductText(missing)).toBe(
      `3 escolhas gravadas ficaram de fora do CSV: ${NO_PRODUCT} (118789, DEMO-002). O XML e o PDF as listam entre as escolhas ignoradas. Elas voltam a valer se a foto do produto for enviada de novo.`,
    );
    expect(missingProductText([choice('118789', 'ean')])).toBe(
      `1 escolha gravada ficou de fora do CSV: ${NO_PRODUCT} (118789). O XML e o PDF a listam entre as escolhas ignoradas. Ela volta a valer se a foto do produto for enviada de novo.`,
    );
  });

  it('diz o que falta na sessão sem foto e na sessão sem produto', () => {
    const withPhotos = (sourceCount, products) => ({ header: { sourceCount }, products });

    expect(emptySessionText(withPhotos(0, []))).toBe('Nenhuma foto nesta sessão.');
    expect(emptySessionText(withPhotos(2, []))).toBe(
      'Nenhum produto nesta sessão. O XML e o PDF ainda levam as fotos e os textos rejeitados.',
    );
    expect(emptySessionText(withPhotos(2, [summaryProductOf('A')]))).toBeNull();
  });

  it('confirma o arquivo gerado pelo nome', () => {
    expect(doneText('inventario-2026-10-06-1603.csv')).toBe(
      'Arquivo gerado: inventario-2026-10-06-1603.csv',
    );
  });
});
