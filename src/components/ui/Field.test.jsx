// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import Field, { TextInput } from './Field.jsx';

const view = useReactRoot();

describe('Field e TextInput', () => {
  it('liga o rótulo e a dica ao campo, com a altura de controle e o realce de foco', async () => {
    await view.render(
      <Field id="nome-sessao" label="Nome da sessão" hint="12/80">
        {(control) => <TextInput {...control} defaultValue="Depósito" />}
      </Field>,
    );

    const input = view.container.querySelector('input');

    expect(input.type).toBe('text');
    expect(input.labels[0].textContent).toBe('Nome da sessão12/80');
    expect(input.getAttribute('aria-describedby')).toBe('nome-sessao-dica');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.className).toContain('h-controle');
    expect(input.className).toContain('focus-visible:ring-2');
    expect(input.className).toContain('focus-visible:border-neutro-tintaFraca');
  });

  it('marca o campo recusado e o descreve pela frase do erro', async () => {
    await view.render(
      <Field id="nome-sessao" label="Nome da sessão" hint="0/80" error="Nome da sessão obrigatório">
        {(control) => <TextInput {...control} focus="brand" />}
      </Field>,
    );

    const input = view.container.querySelector('input');
    const error = view.container.querySelector('#nome-sessao-erro');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('nome-sessao-erro nome-sessao-dica');
    expect(error.textContent).toBe('Nome da sessão obrigatório');
    expect(input.className).toContain('border-marca-vermelhoTexto');
  });

  it('mostra o texto digitado como texto, sem marcação', async () => {
    await view.render(
      <Field id="nome" label="Nome" error="<b>x</b>">
        {(control) => <TextInput {...control} />}
      </Field>,
    );

    expect(view.container.querySelector('b')).toBeNull();
    expect(view.container.textContent).toContain('<b>x</b>');
  });
});
