/**
 * Abre a foto e entrega os pixels para o decodificador.
 *
 * A foto e aberta pelo proprio navegador, com a orientacao gravada pela camera
 * aplicada: a foto tirada com o celular em pe chega em pe, e as dimensoes e as
 * posicoes dos simbolos ficam na mesma orientacao em que o usuario a ve.
 *
 * A resolucao e a original. O modulo do simbolo impresso e pequeno, e reduzir a
 * foto antes de decodificar derruba a leitura. A memoria e controlada de outro
 * jeito: uma foto por vez, e o bitmap liberado assim que os pixels saem dele.
 *
 * Quando o navegador nao consegue abrir o arquivo, os primeiros bytes dizem se
 * e um formato comum que veio estragado ou um formato que este navegador nao
 * abre.
 */

import { DECODER_ERROR_CODES, DecoderError } from './decoderError.js';

const BITMAP_OPTIONS = Object.freeze({ imageOrientation: 'from-image' });

const SIGNATURE_BYTES = 12;

function startsWith(bytes, signature, offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

const ascii = (text) => [...text].map((character) => character.charCodeAt(0));

/** Assinaturas dos formatos que todo navegador atual abre. */
const COMMON_FORMATS = Object.freeze([
  (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]), // JPEG
  (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG
  (bytes) => startsWith(bytes, ascii('GIF8')), // GIF
  (bytes) => startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8), // WebP
  (bytes) => startsWith(bytes, ascii('BM')), // BMP
]);

/**
 * Motivo da foto que nao abriu. Arquivo vazio ou com cabecalho de formato
 * comum esta corrompido; qualquer outro (HEIC fora do Safari, por exemplo) e
 * formato que este navegador nao abre.
 */
async function failureCodeOf(file) {
  if (file.size === 0) {
    return DECODER_ERROR_CODES.CORRUPTED_FILE;
  }

  let bytes;

  try {
    bytes = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
  } catch {
    return DECODER_ERROR_CODES.CORRUPTED_FILE;
  }

  return COMMON_FORMATS.some((matches) => matches(bytes))
    ? DECODER_ERROR_CODES.CORRUPTED_FILE
    : DECODER_ERROR_CODES.UNSUPPORTED_FORMAT;
}

/** Canvas fora da tela; sem `OffscreenCanvas`, um `<canvas>` que nunca entra no documento. */
function createCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function readPixels(bitmap) {
  const { width, height } = bitmap;
  const context = createCanvas(width, height).getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Canvas 2D indisponível.');
  }

  context.drawImage(bitmap, 0, 0);

  return context.getImageData(0, 0, width, height);
}

/**
 * Abre o arquivo da foto e devolve o `ImageData` dela, no tamanho natural e
 * na orientacao da camera. `width` e `height` do resultado sao as dimensoes
 * gravadas na fonte.
 */
export async function loadImage(file) {
  let bitmap;

  try {
    bitmap = await createImageBitmap(file, BITMAP_OPTIONS);
  } catch (cause) {
    throw new DecoderError(await failureCodeOf(file), { cause });
  }

  try {
    return readPixels(bitmap);
  } catch (cause) {
    throw new DecoderError(DECODER_ERROR_CODES.READ_FAILED, { cause });
  } finally {
    bitmap.close();
  }
}
