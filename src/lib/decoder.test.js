// @vitest-environment node

import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PositionSchema } from '../domain/schemas/readingSchema.js';
import { parseLf1 } from '../domain/services/lf1Contract.js';
import { QR_FIXTURES } from '../test-fixtures/qrFixtures.js';
import { readPngFixture } from '../test-fixtures/readPngFixture.js';

import { decodeImage, prepareDecoder } from './decoder.js';
import { DECODER_ERROR_CODES } from './decoderError.js';

const WASM_BINARY = new Uint8Array(
  readFileSync(new URL('../../public/zxing/zxing_reader.wasm', import.meta.url)),
);

const CORNERS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

const encoder = new TextEncoder();

const fetchSpy = vi.fn(() => Promise.reject(new Error('rede bloqueada no teste')));

function byText(a, b) {
  return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
}

function boxOf(position) {
  const xs = CORNERS.map((corner) => position[corner].x);
  const ys = CORNERS.map((corner) => position[corner].y);

  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchSpy);
  await prepareDecoder({ wasmBinary: WASM_BINARY });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('imagens de teste', () => {
  it('trazem só textos LF1 válidos', () => {
    QR_FIXTURES.flatMap((fixture) => fixture.texts).forEach((text) => {
      expect(parseLf1(text).ok, text).toBe(true);
    });
  });
});

describe('decodeImage', () => {
  it.each(QR_FIXTURES.map((fixture) => [fixture.file, fixture]))(
    '%s devolve cada texto exatamente como foi gerado',
    async (_, fixture) => {
      const image = readPngFixture(fixture.file);
      const symbols = await decodeImage(image);

      expect(symbols).toHaveLength(fixture.texts.length);

      const decoded = symbols.map((symbol) => symbol.text).sort();
      const expected = [...fixture.texts].sort();

      expect(decoded).toEqual(expected);
      decoded.forEach((text, index) => {
        expect(encoder.encode(text)).toEqual(encoder.encode(expected[index]));
      });
    },
  );

  it.each(QR_FIXTURES.map((fixture) => [fixture.file, fixture]))(
    '%s traz os quatro cantos de cada símbolo dentro da imagem',
    async (_, fixture) => {
      const image = readPngFixture(fixture.file);
      const symbols = await decodeImage(image);

      symbols.forEach((symbol) => {
        expect(Object.keys(symbol).sort()).toEqual(['position', 'text']);
        expect(Object.keys(symbol.position)).toEqual(CORNERS);
        expect(PositionSchema.safeParse(symbol.position).success).toBe(true);

        CORNERS.forEach((corner) => {
          const { x, y } = symbol.position[corner];

          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(image.width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(image.height);
        });
      });
    },
  );

  it('devolve só objetos simples, sem nada da biblioteca', async () => {
    const [symbol] = await decodeImage(readPngFixture('qr-1.png'));

    expect(Object.getPrototypeOf(symbol)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(symbol.position)).toBe(Object.prototype);
    CORNERS.forEach((corner) => {
      expect(Object.getPrototypeOf(symbol.position[corner])).toBe(Object.prototype);
      expect(Object.keys(symbol.position[corner])).toEqual(['x', 'y']);
    });
    expect(JSON.parse(JSON.stringify(symbol))).toEqual(symbol);
  });

  it('mantém o acento declarado no símbolo', async () => {
    const [symbol] = await decodeImage(readPngFixture('qr-1.png'));

    expect(symbol.text).toBe(
      'LF1|DEMO-001|CAFÉ TORRADO EM GRÃOS 500G|2490|2000000000015|09012100|c1',
    );
    expect(symbol.text.normalize('NFC')).toBe(symbol.text);
  });

  it('devolve o mesmo texto duas vezes quando aparece em dois lugares da foto', async () => {
    const [fixture] = QR_FIXTURES.filter((item) => item.file === 'qr-8.png');
    const repeated = fixture.texts[0];
    const symbols = (await decodeImage(readPngFixture(fixture.file)))
      .filter((symbol) => symbol.text === repeated)
      .sort(byText);

    expect(symbols).toHaveLength(2);

    const [first, second] = symbols.map((symbol) => boxOf(symbol.position));
    const apart =
      first.right <= second.left ||
      second.right <= first.left ||
      first.bottom <= second.top ||
      second.bottom <= first.top;

    expect(apart).toBe(true);
  });

  it('devolve lista vazia para imagem sem símbolo', async () => {
    const width = 64;
    const height = 48;
    const blank = { data: new Uint8ClampedArray(width * height * 4).fill(255), width, height };

    await expect(decodeImage(blank)).resolves.toEqual([]);
  });

  it('recusa entrada que não é imagem em RGBA', async () => {
    await expect(decodeImage(null)).rejects.toBeInstanceOf(TypeError);
    await expect(decodeImage(new Uint8Array(16))).rejects.toBeInstanceOf(TypeError);
    await expect(
      decodeImage({ data: new Uint8ClampedArray(3), width: 1, height: 1 }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('carrega o motor sem nenhuma requisição de rede', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('prepareDecoder', () => {
  it('busca o binário no endereço da aplicação e tenta de novo depois de uma falha', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const served = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('sem conexão'))
      .mockImplementation(
        async () => new Response(WASM_BINARY, { headers: { 'Content-Type': 'application/wasm' } }),
      );

    vi.stubGlobal('fetch', served);

    try {
      const fresh = await import('./decoder.js');
      const failure = await fresh.prepareDecoder().catch((error) => error);

      expect(failure.name).toBe('DecoderError');
      expect(failure.code).toBe(DECODER_ERROR_CODES.ENGINE_UNAVAILABLE);

      await fresh.prepareDecoder();
      await expect(fresh.decodeImage(readPngFixture('qr-1.png'))).resolves.toHaveLength(1);

      const requested = served.mock.calls.map(([url]) => String(url));

      expect(requested.length).toBeGreaterThanOrEqual(2);
      requested.forEach((url) => {
        expect(url).toBe('/zxing/zxing_reader.wasm');
      });
    } finally {
      vi.stubGlobal('fetch', fetchSpy);
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('traduz o motor que não carrega e tenta de novo na chamada seguinte', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const fresh = await import('./decoder.js');
      const failure = await fresh
        .prepareDecoder({ wasmBinary: new Uint8Array([0, 1, 2, 3]) })
        .catch((error) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(failure.name).toBe('DecoderError');
      expect(failure.code).toBe(DECODER_ERROR_CODES.ENGINE_UNAVAILABLE);
      expect(failure.message).toMatch(/leitor de QR Code/);

      await fresh.prepareDecoder({ wasmBinary: WASM_BINARY });
      const symbols = await fresh.decodeImage(readPngFixture('qr-1.png'));

      expect(symbols).toHaveLength(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
