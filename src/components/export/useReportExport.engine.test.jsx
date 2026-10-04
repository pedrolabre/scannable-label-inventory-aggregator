// @vitest-environment jsdom

import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildInventoryReport } from '../../domain/services/inventoryReport.js';
import { lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import { EXPORT_STATUS, PDF_FILE, useReportExport } from './useReportExport.js';

/**
 * O motor de PDF desce pela rede na primeira exportacao. Aqui a carga dele
 * falha, como sem conexao antes de o aplicativo guardar o arquivo, e a
 * exportacao termina com a frase da falha, sem download.
 */
vi.mock('../../lib/pdfEngine.js', () => {
  throw new Error('Falha ao buscar o módulo');
});

const view = useReactRoot();

const report = buildInventoryReport({
  session: { id: 'sessao-teste', name: 'Inventário' },
  sources: [sourceOf('f1')],
  readings: [
    readingOf('l1', 'f1', lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 900 })),
  ],
  resolutions: [],
  generatedAt: '2026-01-01T00:00:00.000Z',
});

let latest = null;

function Harness({ download }) {
  latest = useReportExport({ now: () => new Date('2026-10-06T19:03:48.000Z'), download });

  return null;
}

describe('useReportExport sem o motor de PDF', () => {
  it('mostra a frase da falha quando a carga do motor falha', async () => {
    const download = vi.fn();

    await view.render(<Harness download={download} />);
    await act(async () => {
      await latest.exportFile(report, PDF_FILE);
    });

    expect(download).not.toHaveBeenCalled();
    expect(latest.status).toBe(EXPORT_STATUS.FAILED);
    expect(latest.error).toBe('Não foi possível gerar o arquivo. Tente de novo.');
    expect(latest.file).toBe(PDF_FILE);
  });
});
