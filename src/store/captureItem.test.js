// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { DECODER_ERROR_CODES, DecoderError } from '../lib/decoderError.js';

import {
  CAPTURE_ITEM_STATUSES,
  CAPTURE_ITEM_STATUS_LABELS,
  describeProcessingError,
  formatProgress,
  isQueueBlockingError,
  selectProgress,
} from './captureItem.js';

describe('describeProcessingError', () => {
  it('escolhe a frase pelo passo, sem repassar texto em inglês', () => {
    const insecure = new Error(
      'Este endereço não permite identificar as fotos. Abra o StockVision por https ou pelo endereço local do aparelho.',
    );
    const notReadable = Object.assign(new Error('The file could not be read'), {
      name: 'NotReadableError',
    });
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    const missing = Object.assign(new Error('x'), { name: 'MissingSessionError' });

    expect(describeProcessingError('hash', insecure)).toBe(insecure.message);
    expect(describeProcessingError('hash', notReadable)).toBe(
      'Não foi possível ler o arquivo desta foto. Envie a foto de novo.',
    );
    expect(describeProcessingError('lookup', new Error('x'))).toBe(
      'O armazenamento deste dispositivo não respondeu à leitura. Recarregue a página e tente de novo.',
    );
    expect(describeProcessingError('save', quota)).toBe(
      'O armazenamento deste dispositivo está cheio. Libere espaço no navegador e tente de novo.',
    );
    expect(describeProcessingError('save', missing)).toBe(
      'A sessão não existe mais neste dispositivo. Escolha outra sessão e tente de novo.',
    );
    expect(describeProcessingError('load', new Error('Canvas'))).toBe(
      'A leitura desta foto falhou. Tente de novo.',
    );
  });
});

describe('textos', () => {
  it('tem uma frase para cada situação da foto', () => {
    expect(Object.keys(CAPTURE_ITEM_STATUS_LABELS).sort()).toEqual(
      Object.values(CAPTURE_ITEM_STATUSES).sort(),
    );
    expect(CAPTURE_ITEM_STATUS_LABELS.duplicate).toBe('recusada: foto repetida');
  });

  it('escreve o andamento, e nada sem foto no lote', () => {
    expect(formatProgress({ position: 3, total: 12 })).toBe('Foto 3 de 12');
    expect(formatProgress({ position: 0, total: 0 })).toBe('');
  });
});

describe('andamento', () => {
  const items = (...statuses) => ({ items: statuses.map((status) => ({ status })) });

  it('aponta a foto em processamento, a próxima da fila ou a última', () => {
    expect(selectProgress(items('pending', 'pending'))).toEqual({ position: 1, total: 2 });
    expect(selectProgress(items('read', 'processing', 'pending'))).toEqual({
      position: 2,
      total: 3,
    });
    expect(selectProgress(items('read', 'error', 'pending'))).toEqual({ position: 3, total: 3 });
    expect(selectProgress(items('read', 'duplicate', 'failed'))).toEqual({ position: 3, total: 3 });
    expect(selectProgress(items())).toEqual({ position: 0, total: 0 });
  });
});

describe('isQueueBlockingError', () => {
  it('pausa a fila só quando o leitor não carrega', () => {
    expect(isQueueBlockingError(new DecoderError(DECODER_ERROR_CODES.ENGINE_UNAVAILABLE))).toBe(
      true,
    );
    expect(isQueueBlockingError(new DecoderError(DECODER_ERROR_CODES.READ_FAILED))).toBe(false);
    expect(isQueueBlockingError(new Error('x'))).toBe(false);
  });
});
