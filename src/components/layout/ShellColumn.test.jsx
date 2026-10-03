// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ShellColumn from './ShellColumn.jsx';

const view = useReactRoot();

function body() {
  return view.container.querySelector('[data-corpo]');
}

describe('ShellColumn', () => {
  it('nomeia a região pelo título quando não recebe rótulo', async () => {
    await view.render(<ShellColumn title="Entrada">conteúdo</ShellColumn>);

    const section = view.container.querySelector('section');

    expect(section.getAttribute('aria-label')).toBe('Entrada');
    expect(section.querySelector('h2').textContent).toBe('Entrada');
  });

  it('prefere o rótulo ao título quando os dois chegam', async () => {
    await view.render(
      <ShellColumn title="Detalhe" label="Detalhe do produto">
        conteúdo
      </ShellColumn>,
    );

    expect(view.container.querySelector('section').getAttribute('aria-label')).toBe(
      'Detalhe do produto',
    );
  });

  it('rola só o corpo, que pode encolher dentro da coluna', async () => {
    await view.render(
      <ShellColumn title="Produtos">
        {Array.from({ length: 50 }, (_, index) => (
          <p key={index}>Linha {index}</p>
        ))}
      </ShellColumn>,
    );

    const section = view.container.querySelector('section');

    expect(section.className).toContain('min-h-0');
    expect(section.className).toContain('flex-col');
    expect(body().className).toContain('min-h-0');
    expect(body().className).toContain('overflow-y-auto');
    expect(body().className).toContain('relative');
    expect(body().children).toHaveLength(50);
  });

  it('põe as ações ao lado do título e soma o arranjo ao recuo do corpo', async () => {
    await view.render(
      <ShellColumn
        title="Entrada"
        actions={<button type="button">Ação</button>}
        bodyClassName="space-y-6"
      >
        conteúdo
      </ShellColumn>,
    );

    const heading = view.container.querySelector('h2');

    expect(heading.nextElementSibling.textContent).toBe('Ação');
    expect(body().className).toContain('px-recuo');
    expect(body().className).toContain('space-y-6');
  });

  it('troca o título pela faixa própria e mantém o nome da região pelo rótulo', async () => {
    await view.render(
      <ShellColumn label="Produtos" header={<div data-faixa="">busca</div>} flush>
        conteúdo
      </ShellColumn>,
    );

    const section = view.container.querySelector('section');

    expect(section.getAttribute('aria-label')).toBe('Produtos');
    expect(section.querySelector('[data-faixa]').textContent).toBe('busca');
    expect(section.querySelector('h2')).toBeNull();
    expect(section.querySelectorAll('[data-corpo]')).toHaveLength(1);
  });

  it('tira o recuo do corpo com flush, que continua sendo a região que rola', async () => {
    await view.render(
      <ShellColumn title="Produtos" flush>
        conteúdo
      </ShellColumn>,
    );

    expect(body().className).not.toContain('px-recuo');
    expect(body().className).toContain('overflow-y-auto');
    expect(view.container.querySelector('h2').textContent).toBe('Produtos');
  });
});
