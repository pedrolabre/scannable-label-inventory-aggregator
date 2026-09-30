// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import CaptureColumn from './CaptureColumn.jsx';

const view = useReactRoot();

describe('CaptureColumn', () => {
  it('é a coluna Entrada, com sessão, fotos, aviso do aparelho e fila nessa ordem', async () => {
    await view.render(<CaptureColumn />);

    const section = view.container.querySelector('section[aria-label="Entrada"]');
    const titles = [...section.querySelectorAll('h2, h3')].map((title) => title.textContent);
    const body = section.querySelector('[data-corpo]');

    expect(titles).toEqual(['Entrada', 'Sessão aberta', 'Fotos das etiquetas', 'Fila de fotos']);
    expect(body.className).toContain('overflow-y-auto');
    expect(section.querySelector('[data-aviso-aparelho]').textContent).toBe(
      'Tudo roda neste aparelho: as fotos e as leituras ficam aqui, sem enviar nada pela internet.',
    );
  });
});
