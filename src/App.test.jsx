// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { APP_NAME } from './lib/app-meta.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

async function render() {
  await act(async () => {
    root.render(<App />);
  });
}

describe('App', () => {
  it('mostra o nome do produto como título da tela', async () => {
    await render();

    const titulo = container.querySelector('h1');

    expect(titulo).toBeTruthy();
    expect(titulo.textContent).toBe(APP_NAME);
    expect(APP_NAME).toBe('StockVision');
  });

  it('avisa que tudo roda no aparelho, sem enviar nada', async () => {
    await render();

    const aviso = container.querySelector('p');

    expect(aviso.textContent).toContain('Tudo roda neste aparelho');
    expect(aviso.textContent).toContain('sem enviar nada');
  });

  it('monta a tela sem nenhuma chamada de rede', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await render();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
