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

function reportOf({
  texts = [COFFEE],
  resolutions = [],
  name = 'Inventário',
  sources = [sourceOf('f1')],
} = {}) {
  return buildInventoryReport({
    session: { id: 'sessao-teste', name },
    sources,
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

/** Promessa cumprida ou recusada de fora, para o teste ver o meio da geracao. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });

  return { promise, resolve, reject };
}

async function render(report, props = {}) {
  await view.render(
    <ExportDialog
      report={report}
      onClose={props.onClose ?? (() => {})}
      onReviewConflicts={props.onReviewConflicts ?? (() => {})}
      now={() => INSTANT}
      download={props.download ?? vi.fn()}
      renderPdf={props.renderPdf ?? (async () => new Uint8Array([37, 80, 68, 70]))}
    />,
  );
}

describe('ExportDialog', () => {
  it('mostra o CSV com os dois arquivos, o XML, o PDF, o nome da sessão como texto e fecha pelo Esc', async () => {
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
    expect(dialog().querySelector('[data-formato="xml"] h3').textContent).toBe('XML');
    expect(downloadButton('xml').textContent).toBe('Baixar XML');
    expect(downloadButton('xml').disabled).toBe(false);
    expect(downloadButton('xml').className).toContain('h-controle');
    expect(downloadButton('xml').className).toContain('bg-neutro-branco');
    expect(dialog().querySelector('[data-formato="pdf"] h3').textContent).toBe('PDF');
    expect(downloadButton('pdf').textContent).toBe('Baixar PDF');
    expect(downloadButton('pdf').disabled).toBe(false);
    expect(downloadButton('pdf').hasAttribute('aria-disabled')).toBe(false);
    expect(downloadButton('pdf').className).toContain('h-controle');
    expect(downloadButton('pdf').className).toContain('bg-neutro-branco');
    expect(
      [...dialog().querySelectorAll('[data-formato]')].map((node) => node.dataset.formato),
    ).toEqual(['csv', 'xml', 'pdf']);
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

    for (const file of ['resumo', 'exemplares', 'xml', 'pdf']) {
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
    expect(downloadButton('xml').disabled).toBe(false);
    expect(downloadButton('pdf').disabled).toBe(false);
  });

  it('desliga o CSV e libera o XML e o PDF na sessão com foto e sem produto', async () => {
    const download = vi.fn();

    await render(reportOf({ texts: [] }), { download });

    const empty = dialog().querySelector('[data-sessao-vazia]');

    expect(empty.getAttribute('data-sessao-vazia')).toBe('sem-produto');
    expect(empty.textContent).toBe(
      'Nenhum produto nesta sessão. O XML e o PDF ainda levam as fotos e os textos rejeitados.',
    );
    expect(downloadButton('resumo').disabled).toBe(true);
    expect(downloadButton('exemplares').getAttribute('aria-describedby')).toBe('export-empty');
    expect(downloadButton('xml').disabled).toBe(false);
    expect(downloadButton('xml').hasAttribute('aria-describedby')).toBe(false);
    expect(downloadButton('pdf').disabled).toBe(false);
    expect(downloadButton('pdf').hasAttribute('aria-describedby')).toBe(false);
    expect(dialog().querySelector('[data-revisar-conflitos]')).toBeNull();

    await view.click(downloadButton('xml'));
    await view.click(downloadButton('pdf'));

    expect(download).toHaveBeenCalledTimes(2);
    expect(download.mock.calls[0][1]).toMatch(/^inventario-\d{4}-\d{2}-\d{2}-\d{4}\.xml$/);
    expect(download.mock.calls[1][1]).toMatch(/^inventario-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/);
  });

  it('desliga todos os arquivos na sessão sem foto', async () => {
    await render(reportOf({ texts: [], sources: [] }));

    const empty = dialog().querySelector('[data-sessao-vazia]');

    expect(empty.getAttribute('data-sessao-vazia')).toBe('sem-foto');
    expect(empty.textContent).toBe('Nenhuma foto nesta sessão.');

    for (const file of ['resumo', 'exemplares', 'xml', 'pdf']) {
      expect(downloadButton(file).disabled).toBe(true);
      expect(downloadButton(file).getAttribute('aria-describedby')).toBe('export-empty');
    }
  });

  it('avisa a escolha gravada de produto que saiu da sessão, sem bloquear', async () => {
    await render(
      reportOf({
        resolutions: [{ sessionId: 'sessao-teste', systemCode: 'Z-9', choices: { ean: null } }],
      }),
    );

    const note = dialog().querySelector('[data-escolhas-sem-produto]');

    expect(note.textContent).toContain('1 escolha gravada ficou de fora do CSV');
    expect(note.textContent).toContain('O XML e o PDF a listam entre as escolhas ignoradas.');
    expect(note.textContent).toContain('(Z-9)');
    expect(note.className).toContain('amarelo');
    expect(downloadButton('resumo').disabled).toBe(false);
    expect(downloadButton('xml').disabled).toBe(false);
    expect(downloadButton('pdf').disabled).toBe(false);
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

    await view.focus(downloadButton('xml'));
    await view.click(downloadButton('xml'));

    expect(download).toHaveBeenCalledTimes(2);
    expect(dialog().querySelector('[data-arquivo-gerado]').textContent).toMatch(
      /^Arquivo gerado: inventario-\d{4}-\d{2}-\d{2}-\d{4}\.xml$/,
    );
    expect(document.activeElement).toBe(downloadButton('xml'));
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

  it('trava os botões durante a geração do PDF, com o andamento escrito e o foco no botão tocado', async () => {
    const pending = deferred();
    const download = vi.fn();
    const renderPdf = vi.fn(() => pending.promise);

    await render(reportOf(), { download, renderPdf });
    await view.focus(downloadButton('pdf'));
    await view.click(downloadButton('pdf'));

    const pdf = downloadButton('pdf');

    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(pdf.textContent).toBe('Gerando PDF…');
    expect(pdf.disabled).toBe(false);
    expect(pdf.getAttribute('aria-disabled')).toBe('true');
    expect(pdf.className).toContain('aria-disabled:opacity-60');
    expect(document.activeElement).toBe(pdf);
    expect(dialog().querySelector('[data-gerando]').textContent).toBe('Gerando PDF…');
    expect(dialog().querySelector('[data-gerando]').parentElement.getAttribute('role')).toBe(
      'status',
    );

    for (const file of ['resumo', 'exemplares', 'xml']) {
      expect(downloadButton(file).disabled).toBe(true);
    }

    // Um segundo toque no botao ocupado nao gera outro arquivo.
    await view.click(pdf);
    expect(renderPdf).toHaveBeenCalledTimes(1);

    await view.update(() => pending.resolve(new Uint8Array([37, 80, 68, 70])));

    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0].type).toBe('application/pdf');
    expect(downloadButton('pdf').textContent).toBe('Baixar PDF');
    expect(downloadButton('pdf').hasAttribute('aria-disabled')).toBe(false);
    expect(downloadButton('resumo').disabled).toBe(false);
    expect(dialog().querySelector('[data-gerando]')).toBeNull();
    expect(dialog().querySelector('[data-arquivo-gerado]').textContent).toMatch(
      /^Arquivo gerado: inventario-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/,
    );
    expect(document.activeElement).toBe(downloadButton('pdf'));
  });

  it('mostra a falha do PDF com a frase e libera os botões', async () => {
    const pending = deferred();

    await render(reportOf(), { renderPdf: () => pending.promise });
    await view.click(downloadButton('pdf'));
    await view.update(() => pending.reject(new Error('motor indisponível')));

    expect(dialog().querySelector('[role="alert"]').textContent).toBe(
      'Não foi possível gerar o arquivo. Tente de novo.',
    );
    expect(downloadButton('pdf').textContent).toBe('Baixar PDF');
    expect(downloadButton('resumo').disabled).toBe(false);
  });
});
