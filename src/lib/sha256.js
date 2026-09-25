/**
 * SHA-256 dos bytes do arquivo, em 64 caracteres hexadecimais minusculos, como
 * a fonte grava. E pelo resumo que a mesma foto e reconhecida numa sessao,
 * mesmo com outro nome de arquivo.
 *
 * O calculo e o do proprio navegador. Ele so existe em pagina segura (https ou
 * o endereco local do aparelho), e fora dela a falha sai com o que fazer.
 */

const INSECURE_CONTEXT_MESSAGE =
  'Este endereço não permite identificar as fotos. Abra o StockVision por https ou pelo endereço local do aparelho.';

const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));

async function toBytes(input) {
  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (typeof input?.arrayBuffer === 'function') {
    return new Uint8Array(await input.arrayBuffer());
  }

  throw new TypeError('sha256Hex espera Blob, File, ArrayBuffer ou Uint8Array.');
}

/** Resumo de um `Blob`/`File`, `ArrayBuffer` ou `Uint8Array`. */
export async function sha256Hex(input) {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error(INSECURE_CONTEXT_MESSAGE);
  }

  const digest = new Uint8Array(await subtle.digest('SHA-256', await toBytes(input)));

  return Array.from(digest, (value) => HEX[value]).join('');
}
