// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { buildInventoryReport } from '../../domain/services/inventoryReport.js';
import { lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ExportDialog from './ExportDialog.jsx';

const view = useReactRoot();

const INSTANT = new Date('2026-10-06T19:03:48.000Z');

const COFFEE = lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 900 });
const COFFEE_NEW_PRICE = lf1Text({
  systemCode: 'A-1',
  displayName: 'CAFÉ',
  price: 1000,
  copy: 'c2',
});
const SUGAR = lf1Text({ systemCode: 'B-2', displayName: 'AÇÚCAR', price: 500 });

function reportOf({ texts = [COFFEE], resolutions = [], name = 'Inventário' } = {}) {
  return buildInventoryReport({
    session: { id: 'sessao-teste', name },
    sources: [sourceOf('f1')],
    readings: texts.map((text, index) => readingOf(`l${index}`, 'f1', text)),
    resolutions,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
}

function dialog() {
  return document.body.querySelector('[role="dialog"]');
}

function downloadButton(file) {
  return dialog().querySelector(`[data-baixar="${file}"]`);
}

async function render(report, props = {}) {
  await view.render(
    <ExportDialog
      report={report}
      onClose={props.onClose ?? (() => {})}
      onReviewConflicts={props.onReviewConflicts ?? (() => {})}
      now={() => INSTANT}
      download={props.download ?? vi.fn()}
    />,
  );
}

describe('ExportDialog', () => {
  it('mostra o CSV com os dois arquivos, o nome da sessão como texto e fecha pelo Esc', async () => {
    const onClose = vi.fn();

    await render(reportOf({ name: '<b>Loja</b> centro' }), { onClose });

    expect(dialog().querySelector('h2').textContent).toBe('Exportar relatório');
    expect(dialog().textContent).toContain('<b>Loja</b> centro');
    expect(dialog().querySelector('b')).toBeNull();
    expect(dialog().querySelector('[data-formato="csv"] h3').textContent).toBe('CSV');
    expect(downloadButton('resumo').textContent).toBe('Baixar resumo');
    expect(downloadButton('exemplares').textContent).toBe('Baixar exemplares');
    expect(downloadButton('resumo').disabled).toBe(false);
    expect(downloadButton('resumo').className).toContain('h-controle');
    expect(dialog().querySelector('[data-bloqueio-exportacao]')).toBeNull();

    await view.press('Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bloqueia os arquivos com conflito aberto, com a contagem, e leva ao primeiro produto em conflito', async () => {
    const onReviewConflicts = vi.fn();

    await render(reportOf({ texts: [SUGAR, COFFEE, COFFEE_NEW_PRICE] }), { onReviewConflicts });

    const blocker = dialog().querySelector('[data-bloqueio-exportacao]');

    expect(blocker.getAttribute('data-bloqueio-exportacao')).toBe('1');
    expect(blocker.textContent).toContain('Exportação bloqueada: 1 conflito aberto.');
    expect(blocker.className).toContain('amarelo');

    for (const file of ['resumo', 'exemplares']) {
      expect(downloadButton(file).disabled).toBe(true);
      expect(downloadButton(file).getAttribute('aria-describedby')).toBe('export-blocker');
    }

    await view.click(dialog().querySelector('[data-revisar-conflitos]'));

    expect(onReviewConflicts).toHaveBeenCalledWith('A-1');
  });

  it('libera os arquivos quando o conflito está resolvido', async () => {
    await render(
      reportOf({
        texts: [COFFEE, COFFEE_NEW_PRICE],
        resolutions: [
          { sessionId: 'sessao-teste', systemCode: 'A-1', choices: { priceInCentavos: 900 } },
        ],
      }),
    );

    expect(dialog().querySelector('[data-bloqueio-exportacao]')).toBeNull();
    expect(downloadButton('resumo').disabled).toBe(false);
  });

  it('desliga os arquivos na sessão sem produto', async () => {
    await render(reportOf({ texts: [] }));

    expect(dialog().querySelector('[data-sessao-vazia]').textContent).toBe(
      'Nenhum produto nesta sessão.',
    );
    expect(downloadButton('resumo').disabled).toBe(true);
    expect(downloadButton('exemplares').getAttribute('aria-describedby')).toBe('export-empty');
    expect(dialog().querySelector('[data-revisar-conflitos]')).toBeNull();
  });

  it('avisa a escolha gravada de produto que saiu da sessão, sem bloquear', async () => {
    await render(
      reportOf({
        resolutions: [{ sessionId: 'sessao-teste', systemCode: 'Z-9', choices: { ean: null } }],
      }),
    );

    const note = dialog().querySelector('[data-escolhas-sem-produto]');

    expect(note.textContent).toContain('1 escolha gravada ficou de fora dos arquivos');
    expect(note.textContent).toContain('(Z-9)');
    expect(note.className).toContain('amarelo');
    expect(downloadButton('resumo').disabled).toBe(false);
  });

  it('confirma o arquivo gerado em verde e mantém o foco no botão tocado', async () => {
    const download = vi.fn();

    await render(reportOf(), { download });
    await view.focus(downloadButton('exemplares'));
    await view.click(downloadButton('exemplares'));

    expect(download).toHaveBeenCalledTimes(1);

    const done = dialog().querySelector('[data-arquivo-gerado]');

    expect(done.textContent).toMatch(
      /^Arquivo gerado: inventario-\d{4}-\d{2}-\d{2}-\d{4}-exemplares\.csv$/,
    );
    expect(done.className).toContain('verde');
    expect(done.parentElement.getAttribute('role')).toBe('status');
    expect(document.activeElement).toBe(downloadButton('exemplares'));
  });

  it('mostra a falha junto dos botões', async () => {
    const download = vi.fn(() => {
      throw new Error('bloqueado');
    });

    await render(reportOf(), { download });
    await view.click(downloadButton('resumo'));

    expect(dialog().querySelector('[role="alert"]').textContent).toBe(
      'Não foi possível gerar o arquivo. Tente de novo.',
    );
    expect(dialog().querySelector('[data-arquivo-gerado]')).toBeNull();
  });
});
