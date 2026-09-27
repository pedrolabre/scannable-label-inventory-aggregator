// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { APP_NAME } from './lib/app-meta.js';
import { useReactRoot } from './test-fixtures/reactRoot.js';

const view = useReactRoot();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('mostra o nome do produto como título da tela', async () => {
    await view.render(<App />);

    const titulo = view.container.querySelector('h1');

    expect(titulo).toBeTruthy();
    expect(titulo.textContent).toBe(APP_NAME);
    expect(APP_NAME).toBe('StockVision');
  });

  it('avisa que tudo roda no aparelho, sem enviar nada', async () => {
    await view.render(<App />);

    const aviso = view.container.querySelector('header p');

    expect(aviso.textContent).toContain('Tudo roda neste aparelho');
    expect(aviso.textContent).toContain('sem enviar nada');
  });

  it('mostra a sessão, a entrada de fotos e a fila numa área que rola', async () => {
    await view.render(<App />);

    const main = view.container.querySelector('main');
    const titles = [...main.querySelectorAll('h2')].map((title) => title.textContent);
    const pickers = [...main.querySelectorAll('input[type="file"]')].map(
      (input) => input.labels[0].textContent,
    );

    expect(main.className).toContain('overflow-y-auto');
    expect(titles).toEqual(['Sessão aberta', 'Fotos das etiquetas', 'Fila de fotos']);
    expect(pickers).toEqual(['Fotografar', 'Enviar fotos']);
    expect(main.textContent).toContain('Nenhuma foto neste lote.');
  });

  it('monta a tela sem nenhuma chamada de rede', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await view.render(<App />);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
