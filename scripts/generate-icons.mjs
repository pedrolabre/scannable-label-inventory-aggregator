/**
 * Gera os icones da aplicacao instalada em `public/icons/`.
 *
 * Uso: `npm run icons`. Rodar de novo produz os mesmos bytes.
 *
 * O desenho e feito so de retangulos, com canto reto como o resto do produto:
 * um quadrado na cor de marca, quatro cantos de mira e tres colunas de
 * alturas crescentes: a leitura e a contagem. As coordenadas vivem numa
 * grade de 512 unidades e cada arquivo as escala para o proprio tamanho, com a
 * borda de cada retangulo suavizada pela fracao do pixel que ele cobre.
 *
 * As duas cores sao lidas do `tailwind.config.js`, a unica fonte de cor do
 * produto. O PNG e escrito em RGB, 8 bits, sem filtro, com `node:zlib`, e sem
 * trecho de data ou de texto, para o arquivo depender so do desenho.
 *
 * As funcoes sao exportadas para a suite conferir que os arquivos publicados
 * continuam iguais ao desenho daqui.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

import tailwindConfig from '../tailwind.config.js';

const { colors } = tailwindConfig.theme.extend;

export const ICON_GRID = 512;

export const ICON_COLORS = Object.freeze({
  background: colors.marca.vermelho,
  drawing: colors.neutro.branco,
});

/**
 * Arquivos gerados. A escala amplia o desenho em torno do centro: no icone
 * recortavel ele fica no tamanho da grade, inteiro dentro do circulo central
 * que o sistema sempre mostra (raio de 40% do lado); nos outros ocupa mais do
 * quadrado, e no SVG, que tambem e o icone da aba, mais ainda.
 */
export const ICON_FILES = Object.freeze([
  Object.freeze({ file: 'icon-192.png', size: 192, scale: 1.12 }),
  Object.freeze({ file: 'icon-512.png', size: 512, scale: 1.12 }),
  Object.freeze({ file: 'icon-maskable-512.png', size: 512, scale: 1 }),
  Object.freeze({ file: 'apple-touch-icon-180.png', size: 180, scale: 1.12 }),
]);

export const SVG_ICON = Object.freeze({ file: 'icon.svg', scale: 1.2 });

/** Retangulos `[x0, y0, x1, y1]` do desenho na grade, sem sobreposicao. */
const SHAPES = Object.freeze([
  // cantos de mira: cada um e uma barra deitada e uma em pe, sem a quina repetida
  [112, 112, 192, 140],
  [112, 140, 140, 192],
  [320, 112, 400, 140],
  [372, 140, 400, 192],
  [112, 372, 192, 400],
  [112, 320, 140, 372],
  [320, 372, 400, 400],
  [372, 320, 400, 372],
  // colunas da contagem, crescendo da esquerda para a direita
  [178, 260, 214, 332],
  [238, 220, 274, 332],
  [298, 180, 334, 332],
]);

/** Retangulos ampliados em torno do centro da grade. */
export function iconShapes(scale = 1) {
  const center = ICON_GRID / 2;
  const grow = (value) => center + (value - center) * scale;

  return SHAPES.map(([x0, y0, x1, y1]) => [grow(x0), grow(y0), grow(x1), grow(y1)]);
}

function rgbOf(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);

  if (!match) {
    throw new TypeError(`Cor fora do formato #RRGGBB: ${hex}`);
  }

  return match.slice(1).map((pair) => Number.parseInt(pair, 16));
}

function overlap(start, end, pixel) {
  return Math.max(0, Math.min(end, pixel + 1) - Math.max(start, pixel));
}

/** Pixels RGB do icone, linha a linha, no lado pedido. */
export function rasterizeIcon(size, scale) {
  const factor = size / ICON_GRID;
  const shapes = iconShapes(scale).map((shape) => shape.map((value) => value * factor));
  const coverage = new Float64Array(size * size);

  for (const [x0, y0, x1, y1] of shapes) {
    for (let y = Math.floor(y0); y < Math.ceil(y1); y += 1) {
      const coverY = overlap(y0, y1, y);

      for (let x = Math.floor(x0); x < Math.ceil(x1); x += 1) {
        coverage[y * size + x] += coverY * overlap(x0, x1, x);
      }
    }
  }

  const background = rgbOf(ICON_COLORS.background);
  const drawing = rgbOf(ICON_COLORS.drawing);
  const pixels = Buffer.alloc(size * size * 3);

  for (let index = 0; index < coverage.length; index += 1) {
    const amount = Math.min(1, coverage[index]);

    for (let channel = 0; channel < 3; channel += 1) {
      pixels[index * 3 + channel] = Math.round(
        background[channel] + (drawing[channel] - background[channel]) * amount,
      );
    }
  }

  return pixels;
}

function pngChunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(typeAndData));

  return Buffer.concat([length, typeAndData, checksum]);
}

/** PNG RGB de 8 bits, sem filtro e sem entrelacamento. */
export function encodeRgbPng(size, pixels) {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por amostra
  header[9] = 2; // RGB
  header[10] = 0; // compressao deflate
  header[11] = 0; // filtro por linha
  header[12] = 0; // sem entrelacamento

  // Cada linha comeca com o byte do filtro; zero e nenhum filtro.
  const rowLength = size * 3;
  const raw = Buffer.alloc((rowLength + 1) * size);

  for (let y = 0; y < size; y += 1) {
    raw[y * (rowLength + 1)] = 0;
    pixels.copy(raw, y * (rowLength + 1) + 1, y * rowLength, (y + 1) * rowLength);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function svgNumber(value) {
  return String(Math.round(value * 100) / 100);
}

/** O mesmo desenho em SVG, na grade de 512. */
export function buildSvgIcon(scale = SVG_ICON.scale) {
  const rects = iconShapes(scale).map(
    ([x0, y0, x1, y1]) =>
      `    <rect x="${svgNumber(x0)}" y="${svgNumber(y0)}" width="${svgNumber(x1 - x0)}" height="${svgNumber(y1 - y0)}" />`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_GRID} ${ICON_GRID}" width="${ICON_GRID}" height="${ICON_GRID}">`,
    `  <rect width="${ICON_GRID}" height="${ICON_GRID}" fill="${ICON_COLORS.background}" />`,
    `  <g fill="${ICON_COLORS.drawing}">`,
    ...rects,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

/** Conteudo de cada arquivo, pelo nome. */
export function renderIconFiles() {
  const files = new Map();

  for (const { file, size, scale } of ICON_FILES) {
    files.set(file, encodeRgbPng(size, rasterizeIcon(size, scale)));
  }

  files.set(SVG_ICON.file, Buffer.from(buildSvgIcon(), 'utf8'));

  return files;
}

const OUTPUT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

if (basename(process.argv[1] ?? '') === 'generate-icons.mjs') {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

  for (const [file, content] of renderIconFiles()) {
    writeFileSync(join(OUTPUT_DIRECTORY, file), content);
    console.log(`${file}  ${content.length} bytes`);
  }
}
