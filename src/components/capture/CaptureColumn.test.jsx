// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import CaptureColumn from './CaptureColumn.jsx';

const view = useReactRoot();

describe('CaptureColumn', () => {
  it('é a coluna Entrada, com sessão, fotos, orientação, aviso do aparelho, lote e fotos da sessão nessa ordem', async () => {
    await view.render(<CaptureColumn onOpenSessions={vi.fn()} />);

    const section = view.container.querySelector('section[aria-label="Entrada"]');
    const titles = [...section.querySelectorAll('h2, h3')].map((title) => title.textContent);
    const body = section.querySelector('[data-corpo]');

    expect(titles).toEqual([
      'Entrada',
      'Sessão aberta',
      'Fotos das etiquetas',
      'Fila de fotos',
      'Fotos da sessão',
    ]);
    expect(body.className).toContain('overflow-y-auto');
    expect(section.querySelector('[data-orientacao]').textContent).toBe(
      'Enquadre a folha de frente, inteira e nítida.',
    );
    expect(section.querySelector('[data-aviso-aparelho]').textContent).toBe(
      'Tudo roda neste aparelho: as fotos e as leituras ficam aqui, sem enviar nada pela internet.',
    );
  });

  it('entrega o toque em Sessões a quem abre o diálogo', async () => {
    const onOpenSessions = vi.fn();

    await view.render(<CaptureColumn onOpenSessions={onOpenSessions} />);

    const button = [...view.container.querySelectorAll('button')].find(
      (item) => item.textContent === 'Sessões',
    );

    await view.click(button);

    expect(onOpenSessions).toHaveBeenCalledTimes(1);
  });
});
