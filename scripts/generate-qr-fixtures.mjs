/**
 * Gera os PNGs de teste com QR Codes LF1 em `src/test-fixtures/`.
 *
 * Uso: `npm run fixtures:qr`. Rodar de novo com os mesmos textos produz os
 * mesmos bytes.
 *
 * Cada simbolo sai com correcao de erro M, zona de silencio de quatro modulos e
 * a declaracao de UTF-8 (ECI 26) sempre que o texto tem caractere fora do
 * ASCII, que e como o formato LF1 pede para nomes com acento. Os simbolos sao
 * desenhados lado a lado numa grade, em modulos inteiros, sem reamostragem.
 *
 * A imagem e escrita em PNG de tons de cinza, 8 bits, sem filtro, com
 * `node:zlib`: o formato mais simples que qualquer navegador abre.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

import bwipjs from 'bwip-js';

import {
  QR_FIXTURES,
  QR_FIXTURE_MODULE_PIXELS,
  QR_FIXTURE_QUIET_ZONE_MODULES,
} from '../src/test-fixtures/qrFixtures.js';

const OUTPUT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'test-fixtures',
);

const BLACK = 0;
const WHITE = 255;

const NON_ASCII = /[^\x00-\x7F]/;
const UTF8_DECLARATION = '^ECI000026';

function encoderOptions(text) {
  const base = { bcid: 'qrcode', eclevel: 'M' };

  if (!NON_ASCII.test(text)) {
    return { ...base, text };
  }

  // Com os caracteres de funcao ligados, o circunflexo do proprio texto passa
  // a ser especial e entra dobrado.
  return { ...base, text: `${UTF8_DECLARATION}${text.replace(/\^/g, '^^')}`, parsefnc: true };
}

/** Matriz de modulos do simbolo: `true` e modulo escuro. */
function symbolMatrix(text) {
  const [symbol] = bwipjs.raw(encoderOptions(text));
  const size = symbol.pixx;

  if (symbol.pixy !== size) {
    throw new Error(`Símbolo não quadrado para ${text}`);
  }

  return { size, dark: (column, row) => symbol.pixs[row * size + column] === 1 };
}

function drawGrid(texts, columns) {
  const matrices = texts.map(symbolMatrix);
  const largest = Math.max(...matrices.map((matrix) => matrix.size));
  const cell = (largest + QR_FIXTURE_QUIET_ZONE_MODULES * 2) * QR_FIXTURE_MODULE_PIXELS;
  const rows = Math.ceil(matrices.length / columns);
  const width = columns * cell;
  const height = rows * cell;
  const pixels = new Uint8Array(width * height).fill(WHITE);

  matrices.forEach((matrix, index) => {
    const originX =
      (index % columns) * cell + QR_FIXTURE_QUIET_ZONE_MODULES * QR_FIXTURE_MODULE_PIXELS;
    const originY =
      Math.floor(index / columns) * cell + QR_FIXTURE_QUIET_ZONE_MODULES * QR_FIXTURE_MODULE_PIXELS;

    for (let row = 0; row < matrix.size; row += 1) {
      for (let column = 0; column < matrix.size; column += 1) {
        if (!matrix.dark(column, row)) {
          continue;
        }

        for (let dy = 0; dy < QR_FIXTURE_MODULE_PIXELS; dy += 1) {
          const y = originY + row * QR_FIXTURE_MODULE_PIXELS + dy;
          const start = y * width + originX + column * QR_FIXTURE_MODULE_PIXELS;

          pixels.fill(BLACK, start, start + QR_FIXTURE_MODULE_PIXELS);
        }
      }
    }
  });

  return { width, height, pixels };
}

function pngChunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(typeAndData));

  return Buffer.concat([length, typeAndData, checksum]);
}

function encodeGrayPng({ width, height, pixels }) {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits por amostra
  header[9] = 0; // tons de cinza
  header[10] = 0; // compressao deflate
  header[11] = 0; // filtro por linha
  header[12] = 0; // sem entrelacamento

  // Cada linha comeca com o byte do filtro; zero e nenhum filtro.
  const raw = Buffer.alloc((width + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const fixture of QR_FIXTURES) {
  const image = drawGrid(fixture.texts, fixture.columns);
  const path = join(OUTPUT_DIRECTORY, fixture.file);

  writeFileSync(path, encodeGrayPng(image));
  const count = fixture.texts.length;

  console.log(
    `${fixture.file}: ${count} ${count === 1 ? 'símbolo' : 'símbolos'}, ${image.width} x ${image.height} px`,
  );
}
