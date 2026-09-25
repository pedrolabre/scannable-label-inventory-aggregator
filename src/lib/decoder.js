/**
 * Adaptador entre a imagem da foto e o motor de decodificacao.
 *
 * Aqui e o unico lugar em que o resultado da biblioteca vira dado da
 * aplicacao. Cada simbolo sai como objeto simples `{ text, position }`: o texto
 * exatamente como foi decodificado e os quatro cantos do simbolo em pixels da
 * imagem, no formato gravado na leitura. Nenhum objeto da biblioteca atravessa
 * este arquivo.
 *
 * O motor so e carregado na primeira chamada, pelo `import()` abaixo, que o
 * empacotador separa num arquivo proprio.
 */

import { DECODER_ERROR_CODES, DecoderError } from './decoderError.js';

const CORNERS = Object.freeze(['topLeft', 'topRight', 'bottomRight', 'bottomLeft']);

let preparation = null;

/**
 * Carrega e instancia o motor uma vez para a pagina inteira. A primeira
 * chamada que der certo vale para todas as seguintes, com ou sem opcoes; uma
 * que falhou e esquecida, e a proxima tenta de novo.
 *
 * `wasmBinary` entrega os bytes do binario em vez de busca-lo no endereco da
 * aplicacao; e o caminho da suite de testes, que roda fora do navegador.
 */
export function prepareDecoder({ wasmBinary } = {}) {
  if (preparation === null) {
    preparation = import('./decoderEngine.js')
      .then(async (engine) => {
        await engine.loadEngine({ wasmBinary });

        return engine;
      })
      .catch((cause) => {
        preparation = null;

        throw new DecoderError(DECODER_ERROR_CODES.ENGINE_UNAVAILABLE, { cause });
      });
  }

  return preparation;
}

function isImageData(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Number.isInteger(value.width) &&
    Number.isInteger(value.height) &&
    value.width > 0 &&
    value.height > 0 &&
    value.data?.length === value.width * value.height * 4
  );
}

function toPoint(point) {
  const x = point?.x;
  const y = point?.y;

  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** Os quatro cantos em objeto novo, ou `null` se algum nao for numero. */
function toPosition(position) {
  const corners = CORNERS.map((corner) => toPoint(position?.[corner]));

  if (corners.includes(null)) {
    return null;
  }

  return Object.fromEntries(CORNERS.map((corner, index) => [corner, corners[index]]));
}

function toSymbol(result) {
  const position = toPosition(result.position);
  const text = String(result.text);

  return position === null ? { text } : { text, position };
}

/**
 * Decodifica os QR Codes de uma imagem `{ data, width, height }` em RGBA, como
 * o `ImageData` do canvas. Devolve um item por simbolo, na ordem do motor,
 * inclusive textos repetidos em posicoes diferentes; imagem sem simbolo
 * devolve lista vazia.
 */
export async function decodeImage(imageData) {
  if (!isImageData(imageData)) {
    throw new TypeError('decodeImage espera { data, width, height } em RGBA.');
  }

  const engine = await prepareDecoder();

  let results;

  try {
    results = await engine.readSymbols(imageData);
  } catch (cause) {
    throw new DecoderError(DECODER_ERROR_CODES.READ_FAILED, { cause });
  }

  return results.filter((result) => result.isValid && result.format === 'QRCode').map(toSymbol);
}
