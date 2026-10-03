// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { summaryProductOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import DetailColumn from './DetailColumn.jsx';

const view = useReactRoot();

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
});
