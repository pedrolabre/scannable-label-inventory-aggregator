/**
 * Falhas da leitura de uma foto, do arquivo ao simbolo.
 *
 * A biblioteca de decodificacao e o navegador relatam as proprias falhas em
 * ingles e sem padrao entre si. Nada disso chega ao usuario: o erro sai daqui
 * com codigo estavel e frase em portugues que diz o que fazer.
 *
 * Os dois motivos ligados ao arquivo usam os mesmos codigos gravados na fonte
 * que falhou, entao quem grava a fonte le o motivo direto do erro.
 */

import { SOURCE_FAILURE_REASONS } from '../domain/schemas/sourceSchema.js';

export const DECODER_ERROR_CODES = Object.freeze({
  ENGINE_UNAVAILABLE: 'engine-unavailable',
  READ_FAILED: 'read-failed',
  UNSUPPORTED_FORMAT: SOURCE_FAILURE_REASONS.UNSUPPORTED_FORMAT,
  CORRUPTED_FILE: SOURCE_FAILURE_REASONS.CORRUPTED_FILE,
});

export const DECODER_ERROR_MESSAGES = Object.freeze({
  [DECODER_ERROR_CODES.ENGINE_UNAVAILABLE]:
    'Não foi possível carregar o leitor de QR Code. Confira a conexão, recarregue a página e tente de novo.',
  [DECODER_ERROR_CODES.READ_FAILED]:
    'Não foi possível ler esta foto. Feche outras abas para liberar memória e tente de novo.',
  [DECODER_ERROR_CODES.UNSUPPORTED_FORMAT]:
    'Este navegador não abre o formato desta imagem. Envie a foto em JPEG, PNG ou WebP.',
  [DECODER_ERROR_CODES.CORRUPTED_FILE]:
    'Não foi possível abrir esta imagem: o arquivo está corrompido ou incompleto. Tire ou envie a foto de novo.',
});

const UNEXPECTED_FAILURE_MESSAGE = 'A leitura desta foto falhou. Tente de novo.';

const SOURCE_REASONS = new Set(Object.values(SOURCE_FAILURE_REASONS));

export class DecoderError extends Error {
  constructor(code, options) {
    super(DECODER_ERROR_MESSAGES[code] ?? UNEXPECTED_FAILURE_MESSAGE, options);
    this.name = 'DecoderError';
    this.code = code;
  }
}

/**
 * Motivo gravavel na fonte que falhou, ou `null` quando a falha nao e do
 * arquivo (o motor que nao carregou, por exemplo) e a foto pode ser tentada de
 * novo.
 */
export function sourceFailureReasonOf(error) {
  return error instanceof DecoderError && SOURCE_REASONS.has(error.code) ? error.code : null;
}

/** Texto para a tela. Qualquer falha fora das conhecidas cai no texto geral. */
export function describeDecoderError(error) {
  return error instanceof DecoderError ? error.message : UNEXPECTED_FAILURE_MESSAGE;
}
