// @vitest-environment jsdom

import { act } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildCopiesCsv, buildSummaryCsv } from '../../domain/services/csvExport.js';
import { buildInventoryReport } from '../../domain/services/inventoryReport.js';
import { describeReportDocument } from '../../domain/services/reportDocument.js';
import { buildInventoryXml } from '../../domain/services/xmlExport.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';
import { renderReportDocument } from '../../lib/pdf.js';
import { lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import {
  CSV_FILES,
  EXPORT_STATUS,
  PDF_FILE,
  XML_FILE,
  useReportExport,
} from './useReportExport.js';

const view = useReactRoot();

const previousTimeZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/Sao_Paulo';
});

afterAll(() => {
  if (previousTimeZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = previousTimeZone;
  }
});

const INSTANT = new Date('2026-10-06T19:03:48.000Z');

const report = buildInventoryReport({
  session: { id: 'sessao-teste', name: 'Inventário' },
  sources: [sourceOf('f1')],
  readings: [
    readingOf('l1', 'f1', lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 123456 })),
  ],
  resolutions: [],
  generatedAt: '2026-01-01T00:00:00.000Z',
});

let latest = null;

function Harness({ now, download, renderPdf }) {
  latest = useReportExport({ now, download, renderPdf });

  return <p data-status={latest.status}>{latest.fileName}</p>;
}

function readBlob(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => resolve([...new Uint8Array(reader.result)]);
    reader.readAsArrayBuffer(blob);
  });
}

describe('useReportExport', () => {
  it('baixa o resumo com o nome na hora local do instante e o conteúdo do relatório', async () => {
    const download = vi.fn();

    await view.render(<Harness now={() => INSTANT} download={download} />);
    await view.update(() => latest.exportFile(report, CSV_FILES.SUMMARY));

    expect(download).toHaveBeenCalledTimes(1);

    const [blob, fileName] = download.mock.calls[0];
    const expected = buildSummaryCsv(report, { formatCentavos: formatCentavosAsBRL });

    expect(fileName).toBe('inventario-2026-10-06-1603.csv');
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(await readBlob(blob)).toEqual([...new TextEncoder().encode(expected)]);
    expect(expected).toContain('R$ 1.234,56');
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
    expect(latest.fileName).toBe('inventario-2026-10-06-1603.csv');
    expect(latest.error).toBeNull();
  });

  it('baixa os exemplares com o sufixo e toma um instante novo a cada arquivo', async () => {
    const download = vi.fn();
    const instants = [INSTANT, new Date('2026-10-06T19:05:00.000Z')];
    const now = vi.fn(() => instants.shift());

    await view.render(<Harness now={now} download={download} />);
    await view.update(() => latest.exportFile(report, CSV_FILES.SUMMARY));
    await view.update(() => latest.exportFile(report, CSV_FILES.COPIES));

    expect(now).toHaveBeenCalledTimes(2);
    expect(download.mock.calls.map(([, name]) => name)).toEqual([
      'inventario-2026-10-06-1603.csv',
      'inventario-2026-10-06-1605-exemplares.csv',
    ]);
    expect(await readBlob(download.mock.calls[1][0])).toEqual([
      ...new TextEncoder().encode(buildCopiesCsv(report)),
    ]);
  });

  it('baixa o XML com o nome .xml e a hora local com o deslocamento do fuso', async () => {
    const download = vi.fn();

    await view.render(<Harness now={() => INSTANT} download={download} />);
    await view.update(() => latest.exportFile(report, XML_FILE));

    const [blob, fileName] = download.mock.calls[0];
    const stamped = { ...report, header: { ...report.header, generatedAt: INSTANT.toISOString() } };
    const expected = buildInventoryXml(stamped, { offsetMinutes: -180 });

    expect(fileName).toBe('inventario-2026-10-06-1603.xml');
    expect(blob.type).toBe('application/xml;charset=utf-8');
    expect(await readBlob(blob)).toEqual([...new TextEncoder().encode(expected)]);
    expect(expected).toContain('gerado-em="2026-10-06T16:03:48-03:00"');
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
    expect(latest.fileName).toBe('inventario-2026-10-06-1603.xml');
  });

  it('mostra a falha quando o relatório não pode virar XML', async () => {
    const download = vi.fn();

    await view.render(<Harness now={() => INSTANT} download={download} />);
    await view.update(() => latest.exportFile({ ...report, exportable: false }, XML_FILE));

    expect(download).not.toHaveBeenCalled();
    expect(latest.status).toBe(EXPORT_STATUS.FAILED);
    expect(latest.error).toBe('Não foi possível gerar o arquivo. Tente de novo.');
  });

  it('faz uma exportação por vez', async () => {
    const download = vi.fn(() => {
      latest.exportFile(report, CSV_FILES.COPIES);
    });

    await view.render(<Harness now={() => INSTANT} download={download} />);
    await view.update(() => latest.exportFile(report, CSV_FILES.SUMMARY));

    expect(download).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
  });

  it('mostra a frase da falha e libera a tentativa seguinte', async () => {
    const download = vi.fn(() => {
      throw new Error('bloqueado');
    });

    await view.render(<Harness now={() => INSTANT} download={download} />);
    await view.update(() => latest.exportFile(report, CSV_FILES.SUMMARY));

    expect(latest.status).toBe(EXPORT_STATUS.FAILED);
    expect(latest.error).toBe('Não foi possível gerar o arquivo. Tente de novo.');
    expect(latest.fileName).toBeNull();

    download.mockImplementation(() => {});
    await view.update(() => latest.exportFile(report, CSV_FILES.SUMMARY));

    expect(download).toHaveBeenCalledTimes(2);
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
    expect(latest.error).toBeNull();
  });

  it('baixa o PDF com o nome .pdf, o tipo e os bytes da descrição com a hora local', async () => {
    const download = vi.fn();

    await view.render(<Harness now={() => INSTANT} download={download} />);
    await act(async () => {
      await latest.exportFile(report, PDF_FILE);
    });

    const [blob, fileName] = download.mock.calls[0];
    const stamped = { ...report, header: { ...report.header, generatedAt: INSTANT.toISOString() } };
    const description = describeReportDocument(stamped, {
      offsetMinutes: -180,
      formatCentavos: formatCentavosAsBRL,
    });
    const expected = await renderReportDocument(description);

    expect(fileName).toBe('inventario-2026-10-06-1603.pdf');
    expect(blob.type).toBe('application/pdf');
    expect(await readBlob(blob)).toEqual([...expected]);
    expect(description.subject).toBe('Inventário gerado em 06/10/2026 às 16:03:48 (UTC-03:00)');
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
    expect(latest.fileName).toBe('inventario-2026-10-06-1603.pdf');
  });

  it('fica em andamento com o PDF até ele sair, uma exportação por vez', async () => {
    let finish;
    const download = vi.fn();
    const renderPdf = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    await view.render(<Harness now={() => INSTANT} download={download} renderPdf={renderPdf} />);

    let pending;

    await view.update(() => {
      pending = latest.exportFile(report, PDF_FILE);
    });

    expect(latest.status).toBe(EXPORT_STATUS.RUNNING);
    expect(latest.file).toBe(PDF_FILE);

    await view.update(() => latest.exportFile(report, CSV_FILES.SUMMARY));

    expect(download).not.toHaveBeenCalled();
    expect(renderPdf.mock.calls[0][0].pages.length).toBeGreaterThan(0);

    await view.update(async () => {
      finish(new Uint8Array([37, 80, 68, 70]));
      await pending;
    });

    expect(download).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
    expect(latest.file).toBe(PDF_FILE);
  });

  it('mostra a falha quando a geração do PDF falha, e libera a tentativa seguinte', async () => {
    const download = vi.fn();
    const renderPdf = vi.fn(() => Promise.reject(new Error('motor indisponível')));

    await view.render(<Harness now={() => INSTANT} download={download} renderPdf={renderPdf} />);
    await view.update(() => latest.exportFile(report, PDF_FILE));

    expect(download).not.toHaveBeenCalled();
    expect(latest.status).toBe(EXPORT_STATUS.FAILED);
    expect(latest.error).toBe('Não foi possível gerar o arquivo. Tente de novo.');

    renderPdf.mockResolvedValue(new Uint8Array([37]));
    await view.update(() => latest.exportFile(report, PDF_FILE));

    expect(download).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
  });

  it('mostra a falha quando o relatório não pode virar PDF', async () => {
    const renderPdf = vi.fn();

    await view.render(<Harness now={() => INSTANT} download={vi.fn()} renderPdf={renderPdf} />);
    await view.update(() => latest.exportFile({ ...report, exportable: false }, PDF_FILE));

    expect(renderPdf).not.toHaveBeenCalled();
    expect(latest.status).toBe(EXPORT_STATUS.FAILED);
  });
});
