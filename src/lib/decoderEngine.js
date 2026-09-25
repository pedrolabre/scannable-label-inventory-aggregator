/**
 * Unico ponto do projeto que nomeia a biblioteca de decodificacao.
 *
 * Este modulo e carregado sob demanda por `decoder.js`, entao o empacotador o
 * separa num arquivo proprio e a abertura da pagina nao paga por ele: o codigo
 * e o binario do leitor so descem na primeira foto.
 *
 * O binario `zxing_reader.wasm` vem da propria aplicacao, em `public/zxing/`.
 * Sem configuracao, a biblioteca o buscaria num servidor externo; aqui o
 * endereco e sempre trocado antes da primeira leitura, e a leitura funciona sem
 * rede. Na suite de testes o binario chega em bytes, lido do mesmo arquivo.
 */

import {
  ZXING_WASM_SHA256,
  prepareZXingModule,
  purgeZXingModule,
  readBarcodes,
} from 'zxing-wasm/reader';

export const ENGINE_WASM_FILE = 'zxing_reader.wasm';

export const ENGINE_WASM_PATH = `${import.meta.env.BASE_URL}zxing/${ENGINE_WASM_FILE}`;

/** SHA-256 do binario da versao instalada, para conferir a copia servida. */
export const ENGINE_WASM_SHA256 = ZXING_WASM_SHA256;

/**
 * So QR Code, e todos os simbolos da imagem: uma foto de prateleira traz varias
 * etiquetas, e o limite e o maximo que a biblioteca aceita.
 */
export const READ_OPTIONS = Object.freeze({
  formats: Object.freeze(['QRCode']),
  maxNumberOfSymbols: 255,
});

/** Endereco de cada arquivo que o modulo pede: o binario vem da aplicacao. */
export function locateEngineFile(path, prefix) {
  return path.endsWith('.wasm') ? ENGINE_WASM_PATH : `${prefix}${path}`;
}

/**
 * Instancia o leitor. Uma tentativa que falhou fica guardada pela biblioteca,
 * entao o cache dela e limpo antes: a proxima chamada tenta de verdade.
 */
export function loadEngine({ wasmBinary } = {}) {
  purgeZXingModule();

  const overrides = wasmBinary ? { wasmBinary } : { locateFile: locateEngineFile };

  return prepareZXingModule({ overrides, fireImmediately: true });
}

/** Le os simbolos de uma imagem `{ data, width, height }` em RGBA. */
export function readSymbols(imageData) {
  return readBarcodes(imageData, { ...READ_OPTIONS, formats: [...READ_OPTIONS.formats] });
}
