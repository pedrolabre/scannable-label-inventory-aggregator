// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  COPY_COLUMNS,
  IGNORED_COLUMNS,
  REJECTED_COLUMNS,
  RESOLVED_COLUMNS,
  SOURCE_COLUMNS,
  SUMMARY_COLUMNS,
} from './reportColumns.js';
import { CONTENT_WIDTH_MM, FONT_SIZES, GUTTER_MM } from './reportLayout.js';
import { textWidthMm } from './reportText.js';

const TABLES = {
  resumo: SUMMARY_COLUMNS,
  resolvidos: RESOLVED_COLUMNS,
  exemplares: COPY_COLUMNS,
  rejeitados: REJECTED_COLUMNS,
  fotos: SOURCE_COLUMNS,
  ignoradas: IGNORED_COLUMNS,
};

describe('colunas do relatório em PDF', () => {
  it.each(Object.entries(TABLES))('%s ocupa a largura do conteúdo', (_, columns) => {
    expect(columns.reduce((sum, column) => sum + column.widthMm, 0)).toBe(CONTENT_WIDTH_MM);
  });

  it.each(Object.entries(TABLES))(
    '%s tem o título de cada coluna inteiro, em negrito',
    (_, columns) => {
      for (const column of columns) {
        expect(textWidthMm(column.label, FONT_SIZES.body, true)).toBeLessThanOrEqual(
          column.widthMm - GUTTER_MM,
        );
      }
    },
  );

  it('alinha à direita só os números, que nunca são cortados', () => {
    for (const columns of Object.values(TABLES)) {
      for (const column of columns) {
        expect(column.align === 'right').toBe(column.kind === 'number');
        expect(['text', 'number', 'wrap']).toContain(column.kind);
      }
    }
  });
});
