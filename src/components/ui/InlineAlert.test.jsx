// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import InlineAlert from './InlineAlert.jsx';

const view = useReactRoot();

describe('InlineAlert', () => {
  it('anuncia o texto como alerta, sem preenchimento vermelho', async () => {
    await view.render(<InlineAlert>Nenhuma sessão está aberta.</InlineAlert>);

    const alert = view.container.querySelector('[role="alert"]');

    expect(alert.textContent).toBe('Nenhuma sessão está aberta.');
    expect(alert.className).toContain('bg-marca-vermelhoTenue');
    expect(alert.className).toContain('text-marca-vermelhoTexto');
  });

  it('mostra o ícone de alerta fora da leitura', async () => {
    await view.render(<InlineAlert>Falhou.</InlineAlert>);

    const icon = view.container.querySelector('[role="alert"] svg');

    expect(icon).toBeTruthy();
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.parentElement.textContent).toBe('Falhou.');
  });
});
