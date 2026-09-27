// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import useImageIntake, { takeSelectedFiles } from './useImageIntake.js';

const view = useReactRoot();

function Harness({ enqueue }) {
  const { onCameraChange, onFilesChange } = useImageIntake(enqueue);

  return (
    <>
      <input type="file" data-origin="camera" onChange={onCameraChange} />
      <input type="file" data-origin="file" multiple onChange={onFilesChange} />
    </>
  );
}

function photo(name) {
  return new File(['x'], name, { type: 'image/jpeg' });
}

/** Registra cada valor escrito no seletor. */
function watchValue(input) {
  const written = [];

  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => '',
    set: (value) => written.push(value),
  });

  return written;
}

describe('useImageIntake', () => {
  it('entrega os arquivos na ordem, com a origem de cada seletor', async () => {
    const enqueue = vi.fn(async () => {});

    await view.render(<Harness enqueue={enqueue} />);

    const camera = view.container.querySelector('[data-origin="camera"]');
    const upload = view.container.querySelector('[data-origin="file"]');
    const first = photo('a.jpg');
    const second = photo('b.jpg');
    const third = photo('c.jpg');

    await view.choose(camera, [first]);
    await view.choose(upload, [second, third]);

    expect(enqueue.mock.calls).toEqual([
      [[first], 'camera'],
      [[second, third], 'file'],
    ]);
  });

  it('limpa o seletor depois da escolha, para aceitar o mesmo arquivo de novo', async () => {
    const enqueue = vi.fn(async () => {});

    await view.render(<Harness enqueue={enqueue} />);

    const upload = view.container.querySelector('[data-origin="file"]');
    const written = watchValue(upload);
    const same = photo('a.jpg');

    await view.choose(upload, [same]);
    await view.choose(upload, [same]);

    expect(written).toEqual(['', '']);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('ignora a escolha vazia', async () => {
    const enqueue = vi.fn(async () => {});

    await view.render(<Harness enqueue={enqueue} />);
    await view.choose(view.container.querySelector('[data-origin="camera"]'), []);

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('não deixa a falha da fila escapar do seletor', async () => {
    const enqueue = vi.fn(async () => {
      throw new Error('fila');
    });

    await view.render(<Harness enqueue={enqueue} />);
    await view.choose(view.container.querySelector('[data-origin="camera"]'), [photo('a.jpg')]);

    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});

describe('takeSelectedFiles', () => {
  it('copia a lista antes de limpar o seletor', () => {
    const files = [photo('a.jpg')];
    const input = { files, value: 'C:\\fakepath\\a.jpg' };

    expect(takeSelectedFiles(input)).toEqual(files);
    expect(input.value).toBe('');
    expect(takeSelectedFiles(null)).toEqual([]);
  });
});
