// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import FileRow from './FileRow.jsx';

const view = useReactRoot();

describe('FileRow', () => {
  it('mostra o nome, a frase como texto e o botão ao lado a partir de sm', async () => {
    await view.render(
      <FileRow title="Relatório <completo>" description="Tudo & mais.">
        <button type="button">Baixar</button>
      </FileRow>,
    );

    const row = view.container.querySelector('[data-linha-arquivo]');
    const [title, description] = row.querySelectorAll('p');

    expect(title.textContent).toBe('Relatório <completo>');
    expect(description.textContent).toBe('Tudo & mais.');
    expect(row.querySelector('button').textContent).toBe('Baixar');
    expect(row.className).toContain('flex-col');
    expect(row.className).toContain('sm:flex-row');
    expect(row.className).toContain('border-neutro-divisor');
  });
});
