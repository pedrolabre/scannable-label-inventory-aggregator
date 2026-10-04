// @vitest-environment jsdom

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildCopiesCsv, buildSummaryCsv } from '../../domain/services/csvExport.js';
import { buildInventoryReport } from '../../domain/services/inventoryReport.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';
import { lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import { CSV_FILES, EXPORT_STATUS, useReportExport } from './useReportExport.js';

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

function Harness({ now, download }) {
  latest = useReportExport({ now, download });

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
    await view.update(() => latest.exportCsv(report, CSV_FILES.SUMMARY));

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
    await view.update(() => latest.exportCsv(report, CSV_FILES.SUMMARY));
    await view.update(() => latest.exportCsv(report, CSV_FILES.COPIES));

    expect(now).toHaveBeenCalledTimes(2);
    expect(download.mock.calls.map(([, name]) => name)).toEqual([
      'inventario-2026-10-06-1603.csv',
      'inventario-2026-10-06-1605-exemplares.csv',
    ]);
    expect(await readBlob(download.mock.calls[1][0])).toEqual([
      ...new TextEncoder().encode(buildCopiesCsv(report)),
    ]);
  });

  it('faz uma exportação por vez', async () => {
    const download = vi.fn(() => {
      latest.exportCsv(report, CSV_FILES.COPIES);
    });

    await view.render(<Harness now={() => INSTANT} download={download} />);
    await view.update(() => latest.exportCsv(report, CSV_FILES.SUMMARY));

    expect(download).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
  });

  it('mostra a frase da falha e libera a tentativa seguinte', async () => {
    const download = vi.fn(() => {
      throw new Error('bloqueado');
    });

    await view.render(<Harness now={() => INSTANT} download={download} />);
    await view.update(() => latest.exportCsv(report, CSV_FILES.SUMMARY));

    expect(latest.status).toBe(EXPORT_STATUS.FAILED);
    expect(latest.error).toBe('Não foi possível gerar o arquivo. Tente de novo.');
    expect(latest.fileName).toBeNull();

    download.mockImplementation(() => {});
    await view.update(() => latest.exportCsv(report, CSV_FILES.SUMMARY));

    expect(download).toHaveBeenCalledTimes(2);
    expect(latest.status).toBe(EXPORT_STATUS.DONE);
    expect(latest.error).toBeNull();
  });
});
