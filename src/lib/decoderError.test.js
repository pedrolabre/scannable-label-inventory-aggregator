// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { SOURCE_FAILURE_REASONS } from '../domain/schemas/sourceSchema.js';

import {
  DECODER_ERROR_CODES,
  DECODER_ERROR_MESSAGES,
  DecoderError,
  describeDecoderError,
  sourceFailureReasonOf,
} from './decoderError.js';

describe('decoderError', () => {
  it('usa nos motivos do arquivo os mesmos códigos gravados na fonte', () => {
    expect(DECODER_ERROR_CODES.UNSUPPORTED_FORMAT).toBe(SOURCE_FAILURE_REASONS.UNSUPPORTED_FORMAT);
    expect(DECODER_ERROR_CODES.CORRUPTED_FILE).toBe(SOURCE_FAILURE_REASONS.CORRUPTED_FILE);
  });

  it('tem frase em português para cada código', () => {
    Object.values(DECODER_ERROR_CODES).forEach((code) => {
      const error = new DecoderError(code);

      expect(error.name).toBe('DecoderError');
      expect(error.code).toBe(code);
      expect(error.message).toBe(DECODER_ERROR_MESSAGES[code]);
      expect(error.message).toMatch(/[ãáéíóúçê]/);
      expect(error.message.endsWith('.')).toBe(true);
    });
  });

  it('guarda a causa original', () => {
    const cause = new Error('original');

    expect(new DecoderError(DECODER_ERROR_CODES.READ_FAILED, { cause }).cause).toBe(cause);
  });

  it('entrega o motivo gravável só nas falhas do arquivo', () => {
    expect(sourceFailureReasonOf(new DecoderError(DECODER_ERROR_CODES.CORRUPTED_FILE))).toBe(
      'corrupted-file',
    );
    expect(sourceFailureReasonOf(new DecoderError(DECODER_ERROR_CODES.UNSUPPORTED_FORMAT))).toBe(
      'unsupported-format',
    );
    expect(
      sourceFailureReasonOf(new DecoderError(DECODER_ERROR_CODES.ENGINE_UNAVAILABLE)),
    ).toBeNull();
    expect(sourceFailureReasonOf(new DecoderError(DECODER_ERROR_CODES.READ_FAILED))).toBeNull();
    expect(sourceFailureReasonOf(new Error('corrupted-file'))).toBeNull();
  });

  it('cai no texto geral para qualquer outra falha', () => {
    expect(describeDecoderError(new DecoderError(DECODER_ERROR_CODES.CORRUPTED_FILE))).toBe(
      DECODER_ERROR_MESSAGES[DECODER_ERROR_CODES.CORRUPTED_FILE],
    );
    expect(describeDecoderError(new Error('Failed to load image from memory'))).toBe(
      'A leitura desta foto falhou. Tente de novo.',
    );
    expect(describeDecoderError(undefined)).toBe('A leitura desta foto falhou. Tente de novo.');
  });
});
