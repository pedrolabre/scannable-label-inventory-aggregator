/**
 * Le um PNG de `src/test-fixtures/` como o `ImageData` do canvas: `data` em
 * RGBA, `width` e `height`. Serve so aos testes, que rodam fora do navegador.
 *
 * Entende apenas o formato que `scripts/generate-qr-fixtures.mjs` escreve (tons
 * de cinza, 8 bits, sem filtro, sem entrelacamento) e recusa qualquer outro.
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const FIXTURE_DIRECTORY = new URL('./', import.meta.url);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function readFixtureBytes(name) {
  return new Uint8Array(readFileSync(new URL(name, FIXTURE_DIRECTORY)));
}

export function readPngFixture(name) {
  const bytes = Buffer.from(readFixtureBytes(name));

  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${name} não é PNG.`);
  }

  let offset = 8;
  let header = null;
  const compressed = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      header = data;
    } else if (type === 'IDAT') {
      compressed.push(data);
    }

    offset += 12 + length;
  }

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);

  if (header[8] !== 8 || header[9] !== 0 || header[12] !== 0) {
    throw new Error(`${name} fora do formato das imagens de teste.`);
  }

  const raw = inflateSync(Buffer.concat(compressed));
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const row = y * (width + 1);

    if (raw[row] !== 0) {
      throw new Error(`${name} usa filtro de linha, fora do formato das imagens de teste.`);
    }

    for (let x = 0; x < width; x += 1) {
      const gray = raw[row + 1 + x];
      const pixel = (y * width + x) * 4;

      data[pixel] = gray;
      data[pixel + 1] = gray;
      data[pixel + 2] = gray;
      data[pixel + 3] = 255;
    }
  }

  return { data, width, height };
}
