// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { buildInventoryReport } from '../../domain/services/inventoryReport.js';
import { lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import RejectedDialog from './RejectedDialog.jsx';

const view = useReactRoot();

const LONG = `<b>${'X'.repeat(200)}</b>`;

function reportOf() {
  return buildInventoryReport({
    session: { id: 'sessao-teste', name: 'Inventário' },
    sources: [
      sourceOf('f1', { fileName: '<i>gondola</i>.jpg' }),
      sourceOf('f2', { fileName: 'quebrada.heic', failureReason: 'unsupported-format' }),
    ],
    readings: [
      readingOf('l1', 'f1', LONG),
      readingOf('l2', 'f1', 'LF1|A-1||100|||c1'),
      readingOf('l3', 'f1', lf1Text({ systemCode: 'A-1', displayName: 'OK', price: 100 })),
    ],
    resolutions: [],
    generatedAt: '2026-10-06T12:00:00.000Z',
  });
}

function section(id) {
  return document.body.querySelector(`section[aria-labelledby="${id}"]`);
}

describe('RejectedDialog', () => {
  it('lista os rejeitados com a foto, o motivo e o texto cortado, e as fotos com falha', async () => {
    const report = reportOf();

    await view.render(
      <RejectedDialog rejected={report.rejected} sources={report.sources} onClose={vi.fn()} />,
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    const rejected = [...section('rejected-texts-title').querySelectorAll('li')];
    const failed = [...section('failed-sources-title').querySelectorAll('li')];

    expect(dialog.querySelector('h2').textContent).toBe('Rejeitados e fotos com falha');
    expect(dialog.textContent).toContain(
      '2 textos rejeitados, 1 foto com falha. Nada disso entra na contagem.',
    );
    expect(section('rejected-texts-title').querySelector('h3').textContent).toBe(
      'Textos rejeitados (2)',
    );
    expect(rejected.map((item) => item.dataset.rejeitado)).toEqual(['not-lf1', 'invalid-field']);
    expect(rejected[0].querySelector('p').textContent).toBe('<i>gondola</i>.jpg');
    expect(rejected[0].textContent).toContain('não é LF1');

    const shown = rejected[0].querySelector('[data-texto-rejeitado]').textContent;

    expect(shown).toBe(report.rejected[0].displayText);
    expect([...shown]).toHaveLength(121);
    expect(shown.endsWith('…')).toBe(true);
    expect(rejected[1].textContent).toContain('campo inválido: nome');
    expect(failed).toHaveLength(1);
    expect(failed[0].textContent).toBe('quebrada.heicformato de imagem não suportado');
    expect(dialog.querySelector('b, i')).toBeNull();
  });

  it('diz quando uma das listas está vazia', async () => {
    await view.render(<RejectedDialog rejected={[]} sources={[]} onClose={vi.fn()} />);

    expect(section('rejected-texts-title').textContent).toContain(
      'Nenhum texto rejeitado nesta sessão.',
    );
    expect(section('failed-sources-title').textContent).toContain(
      'Nenhuma foto com falha nesta sessão.',
    );
  });

  it('fecha pelo Esc e pelo botão Fechar', async () => {
    const onClose = vi.fn();

    await view.render(<RejectedDialog rejected={[]} sources={[]} onClose={onClose} />);

    expect(document.activeElement.getAttribute('aria-label')).toBe('Fechar');

    await view.press('Escape');
    await view.click(document.activeElement);

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
