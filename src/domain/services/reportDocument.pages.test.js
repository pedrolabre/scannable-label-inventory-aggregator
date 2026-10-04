// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  boxAt,
  formatTestCentavos,
  lf1Text,
  readingOf,
  sourceOf,
} from '../../test-fixtures/readingFixtures.js';

import { buildInventoryReport } from './inventoryReport.js';
import { COPY_COLUMNS, SUMMARY_COLUMNS } from './reportColumns.js';
import { MISSING_VALUE, describeReportDocument } from './reportDocument.js';
import { CONTENT_BOTTOM_MM, FONT_SIZES, GUTTER_MM, MARGIN_MM } from './reportLayout.js';
import { ELLIPSIS, textWidthMm } from './reportText.js';

/**
 * Paginacao do documento com sessoes inventadas: muitas linhas, uma pagina
 * so, sessao so com fotos, valores fora do limite e textos que nao cabem.
 */

const SESSION = { id: 'sessao-paginas', name: 'Contagem geral' };
const GENERATED_AT = '2026-10-06T20:03:48.000Z';

function code(index) {
  return `DEMO-${String(index).padStart(3, '0')}`;
}

function describeSession({ sources, readings, resolutions = [] }) {
  const report = buildInventoryReport({
    session: SESSION,
    sources,
    readings,
    resolutions,
    generatedAt: GENERATED_AT,
  });

  return describeReportDocument(report, {
    offsetMinutes: -180,
    formatCentavos: formatTestCentavos,
  });
}

/** Sessao com `count` produtos de um exemplar cada, todos na mesma foto. */
function manyProducts(count) {
  const readings = Array.from({ length: count }, (_, index) =>
    readingOf(
      `l${index + 1}`,
      'f1',
      lf1Text({
        systemCode: code(index + 1),
        displayName: `PRODUTO ${index + 1}`,
        price: 1000 + index,
        ean: '7890000000017',
        ncm: '12345678',
      }),
      boxAt(index * 200, 0, 100),
    ),
  );

  return describeSession({ sources: [sourceOf('f1', { fileName: 'gondola.jpg' })], readings });
}

function textOps(page) {
  return page.ops.filter((op) => op.type === 'text');
}

function bodyTexts(description) {
  return description.pages.flatMap((page) => textOps(page).map((op) => op.text));
}

describe('paginação do documento', () => {
  it('cabe numa página só com poucos produtos', () => {
    const description = manyProducts(3);

    expect(description.pages).toHaveLength(1);
    expect(bodyTexts(description).at(-1)).toBe('Página 1 de 1');
  });

  it('pagina 300 produtos com o cabeçalho das tabelas repetido e cada linha uma vez', () => {
    const description = manyProducts(300);
    const { pages } = description;
    const codes = Array.from({ length: 300 }, (_, index) => code(index + 1));
    const written = bodyTexts(description).filter((text) => /^DEMO-\d{3}$/.test(text));

    expect(pages.length).toBeGreaterThanOrEqual(14);
    expect(pages.length).toBeLessThanOrEqual(18);
    // Cada codigo aparece uma vez no resumo e uma vez nos exemplares, na ordem.
    expect(written).toEqual([...codes, ...codes]);

    pages.forEach((page, index) => {
      const ops = textOps(page);
      const headerRows = ops.filter((op) => op.bold && op.text === 'Código');
      const footer = ops.at(-1);

      expect(headerRows.length).toBeGreaterThanOrEqual(1);
      expect(footer.text).toBe(`Página ${index + 1} de ${pages.length}`);
      ops
        .filter((op) => op.fontSizePt !== FONT_SIZES.footer)
        .forEach((op) => {
          expect(op.yMm).toBeLessThanOrEqual(CONTENT_BOTTOM_MM);
          expect(op.yMm).toBeGreaterThan(MARGIN_MM);
        });
    });
  });

  it('dá a mesma descrição para a mesma entrada', () => {
    expect(manyProducts(120)).toEqual(manyProducts(120));
  });

  it('descreve a sessão só com fotos, sem produto', () => {
    const description = describeSession({
      sources: [
        sourceOf('f1', { fileName: 'vazia.jpg' }),
        sourceOf('f2', {
          fileName: 'heic.heic',
          processedAt: '2026-09-29T12:01:00.000Z',
          failureReason: 'unsupported-format',
        }),
      ],
      readings: [readingOf('l1', 'f1', 'texto qualquer', boxAt(0, 0, 100))],
    });
    const written = bodyTexts(description);

    expect(written).toContain('Resumo por produto (0)');
    expect(written).toContain('Nenhum produto nesta sessão.');
    expect(written).toContain('Nenhum exemplar nesta sessão.');
    expect(written).toContain('Textos rejeitados (1)');
    expect(written).toContain('Fotos (2)');
    expect(written).toContain('formato de imagem não suportado');
    expect(written).not.toContain('Conflitos resolvidos (0)');
    expect(description.replacedCount).toBe(0);
    expect(written.some((text) => text.includes('fora da fonte'))).toBe(false);
  });

  it('escreve o total fora do limite como travessão, com o motivo abaixo dos totais e do resumo', () => {
    const price = Number.MAX_SAFE_INTEGER;
    const description = describeSession({
      sources: [sourceOf('f1')],
      readings: [
        readingOf(
          'l1',
          'f1',
          lf1Text({ systemCode: 'CARO', displayName: 'CARO', price }),
          boxAt(0, 0, 100),
        ),
        readingOf(
          'l2',
          'f1',
          lf1Text({ systemCode: 'CARO', displayName: 'CARO', price, copy: 'c2' }),
          boxAt(400, 0, 100),
        ),
      ],
    });
    const ops = description.pages.flatMap(textOps);
    const priceOp = ops.find((op) => op.text === 'R$ 90.071.992.547.409,91');

    expect(ops.find((op) => op.text === 'Valor total').yMm).toBe(
      ops.find((op) => op.text === MISSING_VALUE).yMm,
    );
    expect(bodyTexts(description)).toContain(
      'Valor total não calculado: o valor passa do limite de cálculo.',
    );
    expect(bodyTexts(description)).toContain(
      `Total não calculado (${MISSING_VALUE}): o valor passa do limite de cálculo.`,
    );
    // O numero nunca e cortado: o corpo diminui para caber na coluna.
    expect(priceOp.fontSizePt).toBeLessThan(FONT_SIZES.body);
    expect(textWidthMm(priceOp.text, priceOp.fontSizePt)).toBeLessThanOrEqual(
      SUMMARY_COLUMNS[2].widthMm - GUTTER_MM,
    );
  });

  it('corta o nome longo e o texto LF1 longo na largura da coluna, com reticências', () => {
    const name = 'NOME DE PRODUTO BEM COMPRIDO, COM ACENTUAÇÃO E SESSENTA LETRAS';
    const text = lf1Text({
      systemCode: 'LONGO-1',
      displayName: name.slice(0, 60),
      price: 123456,
      ean: '7890000000017',
      ncm: '12345678',
    });
    const description = describeSession({
      sources: [sourceOf('f1')],
      readings: [readingOf('l1', 'f1', text, boxAt(0, 0, 100))],
    });
    const ops = description.pages.flatMap(textOps);
    const nameOp = ops.find((op) => op.text.startsWith('NOME DE PRODUTO'));
    const textOp = ops.find((op) => op.text.startsWith('LF1|LONGO-1|'));

    expect(nameOp.text.endsWith(ELLIPSIS)).toBe(true);
    expect(name.startsWith(nameOp.text.slice(0, -1))).toBe(true);
    expect(textWidthMm(nameOp.text, FONT_SIZES.body)).toBeLessThanOrEqual(
      SUMMARY_COLUMNS[1].widthMm - GUTTER_MM,
    );
    expect(textOp.text.endsWith(ELLIPSIS)).toBe(true);
    expect(text.startsWith(textOp.text.slice(0, -1))).toBe(true);
    expect(textWidthMm(textOp.text, FONT_SIZES.body)).toBeLessThanOrEqual(
      COPY_COLUMNS[5].widthMm - GUTTER_MM,
    );
  });
});
