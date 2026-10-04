// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { buildInventoryReport } from '../domain/services/inventoryReport.js';
import { describeReportDocument } from '../domain/services/reportDocument.js';
import { FONT_CHARACTERS, glyphWidth } from '../domain/services/reportText.js';
import {
  countEmbeddedFonts,
  readFileId,
  readFonts,
  readInfo,
  readMediaBoxes,
  readPageTexts,
} from '../test-fixtures/pdfBytes.js';
import { boxAt, lf1Text, readingOf, sourceOf } from '../test-fixtures/readingFixtures.js';

import { formatCentavosAsBRL } from './currency.js';
import { buildFileId, loadPdfEngine, renderReportDocument } from './pdf.js';

/**
 * Estes testes leem o arquivo gerado, e nao a descricao: a promessa e sobre o
 * que o leitor de PDF abre. A medida em ponto do A4 esta escrita aqui a mao,
 * para uma mudanca silenciosa de unidade quebrar o teste.
 */

const A4_POINTS = [0, 0, (210 * 72) / 25.4, (297 * 72) / 25.4];

function reportWith(count, { name = 'Inventário da loja', generatedAt } = {}) {
  const readings = Array.from({ length: count }, (_, index) =>
    readingOf(
      `l${index + 1}`,
      'f1',
      lf1Text({
        systemCode: `DEMO-${String(index + 1).padStart(3, '0')}`,
        displayName: index === 0 ? 'AÇÚCAR CRISTAL 1KG – “ESPECIAL”' : `PRODUTO ${index + 1}`,
        price: 549 + index,
        ean: '2000000000022',
      }),
      boxAt(index * 200, 0, 100),
    ),
  );

  return buildInventoryReport({
    session: { id: 'sessao-arquivo', name },
    sources: [sourceOf('f1', { fileName: 'gôndola.jpg' })],
    readings,
    resolutions: [],
    generatedAt: generatedAt ?? '2026-10-06T20:03:48.000Z',
  });
}

function descriptionWith(count, options) {
  return describeReportDocument(reportWith(count, options), {
    offsetMinutes: -180,
    formatCentavos: formatCentavosAsBRL,
  });
}

function textsOfPage(page) {
  return page.ops.filter((op) => op.type === 'text').map((op) => op.text);
}

/** Uma pagina so com o texto dado, na forma que a descricao entrega. */
function singleTextDescription(text) {
  return {
    title: 'Conferência',
    subject: 'Conferência',
    creationDate: "D:20261006170348-03'00'",
    replacedCount: 0,
    pages: [
      {
        widthMm: 210,
        heightMm: 297,
        ops: [{ type: 'text', text, xMm: 15, yMm: 20, fontSizePt: 8, bold: false, gray: 0 }],
      },
    ],
  };
}

describe('renderReportDocument', () => {
  it('sai em A4 retrato, uma página por página da descrição', async () => {
    const description = descriptionWith(80);
    const bytes = await renderReportDocument(description);

    expect(description.pages.length).toBeGreaterThan(1);
    expect(readMediaBoxes(bytes)).toHaveLength(description.pages.length);
    readMediaBoxes(bytes).forEach((box) => {
      box.forEach((value, index) => expect(value).toBeCloseTo(A4_POINTS[index], 2));
    });
  });

  it('escreve na helvetica do leitor, sem fonte embutida', async () => {
    const bytes = await renderReportDocument(descriptionWith(2));

    expect(Object.values(readFonts(bytes))).toEqual([
      { baseFont: 'Helvetica', encoding: 'WinAnsiEncoding' },
      { baseFont: 'Helvetica-Bold', encoding: 'WinAnsiEncoding' },
    ]);
    expect(countEmbeddedFonts(bytes)).toBe(0);
  });

  it('escreve cada texto da descrição, com os acentos, lido de volta pelos bytes', async () => {
    const description = descriptionWith(80);
    const pages = readPageTexts(await renderReportDocument(description));

    expect(pages.map((page) => page.map((run) => run.text))).toEqual(
      description.pages.map(textsOfPage),
    );
    expect(pages[0].map((run) => run.text)).toContain('AÇÚCAR CRISTAL 1KG – “ESPECIAL”');
    expect(pages[0][0]).toEqual({ font: 'F2', size: 14, text: 'Relatório de inventário' });
  });

  it('escreve e lê de volta todos os caracteres que a descrição aceita', async () => {
    const all = FONT_CHARACTERS.join('');
    const [[run]] = readPageTexts(await renderReportDocument(singleTextDescription(all)));

    expect(run.text).toBe(all);
  });

  it('mede como a biblioteca, com a diferença do arredondamento dela', async () => {
    const { PdfDocument } = await loadPdfEngine();
    const doc = new PdfDocument({ unit: 'mm', format: 'a4' });

    for (const [style, bold] of [
      ['normal', false],
      ['bold', true],
    ]) {
      doc.setFont('helvetica', style);

      const known = doc.getFont().metadata.Unicode.widths;
      const measured = FONT_CHARACTERS.filter((character) => known[character.codePointAt(0)]);

      expect(measured.length).toBeGreaterThan(190);
      measured.forEach((character) => {
        const library = Math.round(doc.getStringUnitWidth(character) * 1000);

        expect(Math.abs(library - glyphWidth(character, bold))).toBeLessThanOrEqual(7);
      });
    }
  });

  it('sai igual byte a byte para a mesma descrição', async () => {
    const first = await renderReportDocument(descriptionWith(40));
    const second = await renderReportDocument(descriptionWith(40));

    expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
  });

  it('leva a data de criação da descrição e o identificador tirado do conteúdo', async () => {
    const description = descriptionWith(3);
    const bytes = await renderReportDocument(description);
    const id = buildFileId(JSON.stringify(description));

    expect(readInfo(bytes).CreationDate).toBe("D:20261006170348-03'00'");
    expect(readFileId(bytes)).toEqual([id, id]);
    expect(id).toMatch(/^[0-9A-F]{32}$/);

    const otherContent = await renderReportDocument(descriptionWith(4));
    const otherInstant = await renderReportDocument(
      descriptionWith(3, { generatedAt: '2026-10-06T20:04:00.000Z' }),
    );

    expect(readFileId(otherContent)[0]).not.toBe(id);
    expect(readFileId(otherInstant)[0]).not.toBe(id);
    expect(readInfo(otherInstant).CreationDate).toBe("D:20261006170400-03'00'");
  });

  it('leva título, assunto e criador, e nada além do produtor que a biblioteca escreve', async () => {
    const info = readInfo(
      await renderReportDocument(descriptionWith(1, { name: 'Sessão “A” – 1' })),
    );

    expect(info).toEqual({
      Title: 'Relatório de inventário - Sessão “A” – 1',
      Subject: 'Inventário gerado em 06/10/2026 às 17:03:48 (UTC-03:00)',
      Creator: 'StockVision',
      Producer: expect.stringMatching(/^jsPDF \d+\.\d+\.\d+$/),
      CreationDate: "D:20261006170348-03'00'",
    });
  });

  it('cede o laço de eventos entre uma página e a seguinte', async () => {
    const description = descriptionWith(80);
    const events = [];

    await loadPdfEngine();
    setTimeout(() => events.push('outra tarefa'), 0);
    await renderReportDocument(description, {
      onPage: (page, total) => events.push(`página ${page} de ${total}`),
    });

    const total = description.pages.length;

    expect(events.slice(0, 3)).toEqual([
      `página 1 de ${total}`,
      'outra tarefa',
      `página 2 de ${total}`,
    ]);
    expect(events).toHaveLength(total + 1);
  });

  it('não espera o laço quando o documento tem uma página só', async () => {
    await loadPdfEngine();

    const spy = vi.spyOn(globalThis, 'setTimeout');

    try {
      await renderReportDocument(descriptionWith(1));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('recusa a descrição sem página', async () => {
    await expect(renderReportDocument({ ...descriptionWith(1), pages: [] })).rejects.toThrow(
      'Documento sem página',
    );
  });
});

describe('loadPdfEngine', () => {
  it('carrega o motor uma vez só para a página inteira', async () => {
    const first = loadPdfEngine();

    expect(loadPdfEngine()).toBe(first);
    expect(typeof (await first).PdfDocument).toBe('function');
  });

  it('esquece a carga que falhou e tenta de novo na chamada seguinte', async () => {
    vi.resetModules();
    vi.doMock('./pdfEngine.js', () => {
      throw new Error('sem rede');
    });

    const fresh = await import('./pdf.js');

    await expect(fresh.loadPdfEngine()).rejects.toThrow();

    vi.doUnmock('./pdfEngine.js');
    vi.resetModules();

    const engine = await fresh.loadPdfEngine();

    expect(typeof engine.PdfDocument).toBe('function');
  });
});
