// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import CaptureButtons from './CaptureButtons.jsx';

const view = useReactRoot();

function inputs() {
  return [...view.container.querySelectorAll('input[type="file"]')];
}

describe('CaptureButtons', () => {
  it('abre a câmera traseira para uma foto e o envio para várias imagens', async () => {
    await view.render(<CaptureButtons enqueue={vi.fn()} />);

    const [camera, upload] = inputs();

    expect(inputs()).toHaveLength(2);
    expect(camera.getAttribute('accept')).toBe('image/*');
    expect(camera.getAttribute('capture')).toBe('environment');
    expect(camera.multiple).toBe(false);
    expect(upload.getAttribute('accept')).toBe('image/*');
    expect(upload.hasAttribute('capture')).toBe(false);
    expect(upload.multiple).toBe(true);
  });

  it('dá a cada seletor o nome do rótulo e o alvo de toque da altura de controle', async () => {
    await view.render(<CaptureButtons enqueue={vi.fn()} />);

    const [camera, upload] = inputs();

    expect(camera.labels[0].textContent).toBe('Fotografar');
    expect(upload.labels[0].textContent).toBe('Enviar fotos');

    for (const input of [camera, upload]) {
      const label = input.labels[0];

      expect(label.className).toContain('h-controle');
      expect(label.className).toContain('has-[:focus-visible]:outline-2');
      expect(input.className).toContain('sr-only');
      expect(input.tabIndex).toBe(0);
    }
  });

  it('entrega a escolha de cada seletor com a origem certa', async () => {
    const enqueue = vi.fn(async () => {});
    const shot = new File(['x'], 'camera.jpg', { type: 'image/jpeg' });
    const sent = [
      new File(['y'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['z'], 'b.jpg', { type: 'image/jpeg' }),
    ];

    await view.render(<CaptureButtons enqueue={enqueue} />);

    const [camera, upload] = inputs();

    await view.choose(camera, [shot]);
    await view.choose(upload, sent);

    expect(enqueue.mock.calls).toEqual([
      [[shot], 'camera'],
      [sent, 'file'],
    ]);
  });

  it('orienta o enquadramento logo abaixo dos botões de foto', async () => {
    await view.render(<CaptureButtons enqueue={vi.fn()} />);

    const guidance = view.container.querySelector('[data-orientacao]');

    expect(guidance.textContent).toBe('Enquadre a folha de frente, inteira e nítida.');
    expect(guidance.previousElementSibling.querySelectorAll('input[type="file"]')).toHaveLength(2);
  });
});
