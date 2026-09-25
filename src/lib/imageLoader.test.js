// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFixtureBytes } from '../test-fixtures/readPngFixture.js';

import { DECODER_ERROR_CODES } from './decoderError.js';
import { loadImage } from './imageLoader.js';

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10];
const HEIC_HEADER = [0x00, 0x00, 0x00, 0x18, ...new TextEncoder().encode('ftypheic')];

function fakeBitmap(width, height) {
  return { width, height, close: vi.fn() };
}

/** Canvas falso que registra o tamanho e devolve pixels do tamanho pedido. */
function installCanvas({ failRead = false } = {}) {
  const canvases = [];
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn((x, y, width, height) => {
      if (failRead) {
        throw new Error('sem memória');
      }

      return { data: new Uint8ClampedArray(width * height * 4), width, height };
    }),
  };

  class FakeOffscreenCanvas {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      canvases.push(this);
    }

    getContext(type, options) {
      this.contextType = type;
      this.contextOptions = options;

      return context;
    }
  }

  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);

  return { canvases, context };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadImage', () => {
  it('abre a foto com a orientação da câmera, no tamanho natural', async () => {
    const bitmap = fakeBitmap(4032, 3024);
    const createImageBitmap = vi.fn(async () => bitmap);
    const { canvases, context } = installCanvas();
    const file = new File([readFixtureBytes('qr-1.png')], 'foto.png', { type: 'image/png' });

    vi.stubGlobal('createImageBitmap', createImageBitmap);

    const image = await loadImage(file);

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(canvases).toHaveLength(1);
    expect([canvases[0].width, canvases[0].height]).toEqual([4032, 3024]);
    expect(canvases[0].contextType).toBe('2d');
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(context.getImageData).toHaveBeenCalledWith(0, 0, 4032, 3024);
    expect([image.width, image.height]).toEqual([4032, 3024]);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('usa um canvas solto quando não há OffscreenCanvas', async () => {
    const bitmap = fakeBitmap(10, 20);
    const element = {
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: (x, y, width, height) => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        }),
      }),
    };

    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.stubGlobal('document', { createElement: vi.fn(() => element) });
    vi.stubGlobal('createImageBitmap', async () => bitmap);

    const image = await loadImage(new Blob([new Uint8Array(8)]));

    expect(document.createElement).toHaveBeenCalledWith('canvas');
    expect([element.width, element.height]).toEqual([10, 20]);
    expect([image.width, image.height]).toEqual([10, 20]);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('libera o bitmap também quando a leitura dos pixels falha', async () => {
    const bitmap = fakeBitmap(100, 100);

    installCanvas({ failRead: true });
    vi.stubGlobal('createImageBitmap', async () => bitmap);

    const failure = await loadImage(new Blob([new Uint8Array(8)])).catch((error) => error);

    expect(failure.code).toBe(DECODER_ERROR_CODES.READ_FAILED);
    expect(failure.cause.message).toBe('sem memória');
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['JPEG truncado', JPEG_HEADER, DECODER_ERROR_CODES.CORRUPTED_FILE],
    [
      'PNG truncado',
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0],
      DECODER_ERROR_CODES.CORRUPTED_FILE,
    ],
    ['GIF truncado', [...new TextEncoder().encode('GIF89a')], DECODER_ERROR_CODES.CORRUPTED_FILE],
    [
      'WebP truncado',
      [...new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBP')],
      DECODER_ERROR_CODES.CORRUPTED_FILE,
    ],
    ['BMP truncado', [0x42, 0x4d, 0, 0], DECODER_ERROR_CODES.CORRUPTED_FILE],
    ['HEIC', HEIC_HEADER, DECODER_ERROR_CODES.UNSUPPORTED_FORMAT],
    [
      'texto',
      [...new TextEncoder().encode('não é imagem')],
      DECODER_ERROR_CODES.UNSUPPORTED_FORMAT,
    ],
    ['arquivo vazio', [], DECODER_ERROR_CODES.CORRUPTED_FILE],
  ])('classifica %s que o navegador não abre', async (_, header, code) => {
    const cause = new DOMException('The source image could not be decoded.', 'InvalidStateError');

    installCanvas();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => Promise.reject(cause)),
    );

    const failure = await loadImage(new File([new Uint8Array(header)], 'foto')).catch(
      (error) => error,
    );

    expect(failure.name).toBe('DecoderError');
    expect(failure.code).toBe(code);
    expect(failure.cause).toBe(cause);
  });
});
