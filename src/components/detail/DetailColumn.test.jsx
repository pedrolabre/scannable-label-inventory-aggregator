// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { buildInventoryReport } from '../../domain/services/inventoryReport.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import {
  lf1Text,
  readingOf,
  sourceOf,
  summaryProductOf,
} from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import DetailColumn from './DetailColumn.jsx';

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
});

function reportOf(readings) {
  return buildInventoryReport({
    session: { id: 'sessao-teste', name: 'Inventário' },
    sources: [sourceOf('f1', { fileName: 'gondola-1.jpg' })],
    readings,
    resolutions: [],
    generatedAt: '2026-10-06T12:00:00.000Z',
  });
}

function title() {
  return view.container.querySelector('h3');
}

describe('DetailColumn', () => {
  it('diz que nenhum produto está selecionado', async () => {
    await view.render(<DetailColumn />);

    expect(view.container.querySelector('section').getAttribute('aria-label')).toBe('Detalhe');
    expect(view.container.querySelector('[data-estado-detalhe]').textContent).toBe(
      'Nenhum produto selecionado.',
    );
    expect(title()).toBeNull();
  });

  it('mostra o nome e o código do produto selecionado, como texto', async () => {
    const product = summaryProductOf('<i>A-1</i>', { displayName: '<b>Café</b> 500g' });

    await view.render(<DetailColumn product={product} />);

    expect(view.container.querySelector('[data-estado-detalhe]').textContent).toBe(
      'Produto selecionado',
    );
    expect(title().textContent).toBe('<b>Café</b> 500g');
    expect(view.container.textContent).toContain('Código <i>A-1</i>');
    expect(view.container.querySelector('b, i')).toBeNull();
  });

  it('mostra o travessão com o motivo quando o nome está em conflito', async () => {
    const product = summaryProductOf('A-1', {
      displayName: null,
      openConflictFields: ['displayName'],
    });

    await view.render(<DetailColumn product={product} />);

    expect(title().textContent).toBe('—indisponível: nome em conflito');
  });

  it('leva o foco ao nome a cada pedido e não o move sem pedido', async () => {
    const product = summaryProductOf('A-1');

    await view.render(<DetailColumn product={product} />);

    expect(document.activeElement).not.toBe(title());

    await view.render(<DetailColumn product={product} focusRequest={1} />);

    expect(document.activeElement).toBe(title());
    expect(title().getAttribute('tabindex')).toBe('-1');
    expect(title().className).toContain('focus-visible:outline');
  });

  it('mostra dados, conflitos e exemplares do produto, nessa ordem, numa só região que rola', async () => {
    const report = reportOf([
      readingOf('l1', 'f1', lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 900 })),
      readingOf(
        'l2',
        'f1',
        lf1Text({
          systemCode: 'A-1',
          displayName: 'CAFÉ',
          price: 1000,
          ean: '20000042',
          copy: 'c2',
        }),
      ),
      readingOf('l3', 'f1', lf1Text({ systemCode: 'B-2', displayName: 'OUTRO', price: 1 })),
    ]);
    const product = report.products.find((item) => item.systemCode === 'A-1');

    await view.render(<DetailColumn report={report} product={product} />);

    const body = view.container.querySelector('[data-corpo]');
    const headings = [...body.querySelectorAll('h3, h4')].map((title) => title.textContent);

    expect(headings).toEqual(['CAFÉ', 'Conflitos', 'Exemplares']);
    expect(body.textContent).toContain('conflito em preço e EAN');
    expect(body.querySelector('[data-dado="Quantidade"] dd').textContent).toBe('2 exemplares');
    expect(body.querySelector('[data-dado="NCM"] dd').textContent).toBe('sem NCM');
    expect([...body.querySelectorAll('[data-campo]')].map((field) => field.dataset.campo)).toEqual([
      'priceInCentavos',
      'ean',
    ]);
    expect(
      [...body.querySelectorAll('[data-exemplar]')].map((copy) => copy.dataset.exemplar),
    ).toEqual(['c1', 'c2']);
    expect(body.textContent).toContain('Foto: gondola-1.jpg');
    expect(view.container.querySelectorAll('.overflow-y-auto')).toHaveLength(1);
    expect(body.textContent).not.toContain('OUTRO');
  });

  it('não mostra a seção de conflitos no produto sem conflito', async () => {
    const report = reportOf([
      readingOf('l1', 'f1', lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 900 })),
    ]);

    await view.render(<DetailColumn report={report} product={report.products[0]} />);

    expect(view.container.querySelector('[data-conflitos]')).toBeNull();
    expect(view.container.querySelectorAll('[data-exemplar]')).toHaveLength(1);
  });
});
