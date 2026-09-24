// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  SOURCE_FAILURE_MESSAGES,
  SOURCE_FAILURE_REASONS,
  SOURCE_ORIGINS,
  SOURCE_STATUSES,
  SourceSchema,
} from './sourceSchema.js';

const COMMON = {
  id: '22222222-2222-4222-8222-222222222222',
  sessionId: '11111111-1111-4111-8111-111111111111',
  fileName: 'prateleira-a.jpg',
  byteSize: 2_345_678,
  lastModified: 1_790_000_000_000,
  sha256: '0f'.repeat(32),
  origin: 'file',
  processedAt: '2026-09-24T12:00:00.000Z',
};

const READ = { ...COMMON, status: 'read', width: 4032, height: 3024 };

const FAILED = { ...COMMON, status: 'failed', failureReason: 'unsupported-format' };

function messagesOf(value) {
  const result = SourceSchema.safeParse(value);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('SourceSchema', () => {
  it('expõe os códigos estáveis e a frase de cada motivo', () => {
    expect(SOURCE_ORIGINS).toEqual({ CAMERA: 'camera', FILE: 'file' });
    expect(SOURCE_STATUSES).toEqual({ READ: 'read', FAILED: 'failed' });
    expect(SOURCE_FAILURE_REASONS).toEqual({
      UNSUPPORTED_FORMAT: 'unsupported-format',
      CORRUPTED_FILE: 'corrupted-file',
    });
    expect(SOURCE_FAILURE_MESSAGES).toEqual({
      'unsupported-format': 'formato de imagem não suportado',
      'corrupted-file': 'arquivo corrompido ou incompleto',
    });
  });

  it('aceita a fonte lida e a que falhou, das duas origens', () => {
    expect(SourceSchema.parse(READ)).toEqual(READ);
    expect(SourceSchema.parse(FAILED)).toEqual(FAILED);
    expect(SourceSchema.parse({ ...READ, origin: 'camera' }).origin).toBe('camera');
    expect(SourceSchema.parse({ ...FAILED, failureReason: 'corrupted-file' })).toBeTruthy();
  });

  it('aceita arquivo vazio e data de modificação zero, como o navegador entrega', () => {
    expect(SourceSchema.parse({ ...FAILED, byteSize: 0, lastModified: 0 })).toBeTruthy();
  });

  it('recusa os bytes da imagem em qualquer forma', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    expect(messagesOf({ ...READ, bytes })).toEqual(['Fonte não aceita campo fora do registro']);
    expect(messagesOf({ ...READ, blob: new Blob([bytes]) })).toEqual([
      'Fonte não aceita campo fora do registro',
    ]);
    expect(messagesOf({ ...READ, fileName: new Blob([bytes]) })).toEqual([
      'Nome do arquivo deve ser texto',
    ]);
  });

  it('recusa motivo de falha na fonte lida e dimensões na que falhou', () => {
    expect(messagesOf({ ...READ, failureReason: 'corrupted-file' })).toEqual([
      'Fonte não aceita campo fora do registro',
    ]);
    expect(messagesOf({ ...FAILED, width: 10, height: 10 })).toEqual([
      'Fonte não aceita campo fora do registro',
    ]);
  });

  it('exige dimensões na fonte lida e motivo na que falhou', () => {
    const { width, height, ...semDimensoes } = READ;
    const { failureReason, ...semMotivo } = FAILED;

    expect(width + height).toBeGreaterThan(0);
    expect(failureReason).toBe('unsupported-format');
    expect(messagesOf(semDimensoes)).toEqual([
      'Largura da imagem obrigatória',
      'Altura da imagem obrigatória',
    ]);
    expect(messagesOf(semMotivo)).toEqual([
      'Motivo da falha deve ser unsupported-format ou corrupted-file',
    ]);
  });

  it('recusa situação fora das duas gravadas', () => {
    expect(messagesOf({ ...READ, status: 'lida' })).toEqual([
      'Situação da fonte deve ser read ou failed',
    ]);
    expect(messagesOf({ ...READ, status: 'processing' })).toEqual([
      'Situação da fonte deve ser read ou failed',
    ]);
    expect(messagesOf({ ...COMMON })).toEqual(['Situação da fonte deve ser read ou failed']);
  });

  it('escreve em português a mensagem de cada campo', () => {
    expect(
      messagesOf({
        id: '2',
        sessionId: 'sessao',
        fileName: 'a'.repeat(256),
        byteSize: -1,
        lastModified: 1.5,
        sha256: '0F'.repeat(32),
        origin: 'arquivo',
        processedAt: 'ontem',
        status: 'read',
        width: 0,
        height: '3024',
      }),
    ).toEqual([
      'Identificador da fonte deve ser um UUID',
      'Identificador da sessão deve ser um UUID',
      'Nome do arquivo deve ter no máximo 255 caracteres',
      'Tamanho do arquivo não pode ser negativo',
      'Horário de modificação do arquivo deve ser um número inteiro',
      'SHA-256 deve ter 64 caracteres hexadecimais minúsculos',
      'Origem da fonte deve ser camera ou file',
      'Data do processamento deve ser data e hora em ISO 8601 (UTC)',
      'Largura da imagem deve ser maior que zero',
      'Altura da imagem deve ser um número inteiro',
    ]);
  });

  it('recusa campo obrigatório ausente', () => {
    expect(messagesOf({ status: 'failed', failureReason: 'corrupted-file' })).toEqual([
      'Identificador da fonte obrigatório',
      'Identificador da sessão obrigatório',
      'Nome do arquivo obrigatório',
      'Tamanho do arquivo obrigatório',
      'Horário de modificação do arquivo obrigatório',
      'SHA-256 obrigatório',
      'Origem da fonte deve ser camera ou file',
      'Data do processamento obrigatória',
    ]);
  });

  it('recusa registro que não é objeto', () => {
    expect(messagesOf(null)).toEqual(['Situação da fonte deve ser read ou failed']);
  });
});
