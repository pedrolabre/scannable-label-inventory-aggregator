// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ReadingSchema } from './readingSchema.js';

const POSITION = {
  topLeft: { x: 120.5, y: 80 },
  topRight: { x: 320, y: 82.25 },
  bottomRight: { x: 318, y: 280 },
  bottomLeft: { x: 118, y: 278 },
};

const READING = {
  id: '33333333-3333-4333-8333-333333333333',
  sessionId: '11111111-1111-4111-8111-111111111111',
  sourceId: '22222222-2222-4222-8222-222222222222',
  text: 'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1',
  position: POSITION,
  readAt: '2026-09-24T12:00:00.000Z',
};

function messagesOf(value) {
  const result = ReadingSchema.safeParse(value);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('ReadingSchema', () => {
  it('aceita a leitura com e sem posição', () => {
    const { position, ...semPosicao } = READING;

    expect(position).toBe(POSITION);
    expect(ReadingSchema.parse(READING)).toEqual(READING);
    expect(ReadingSchema.parse(semPosicao)).toEqual(semPosicao);
  });

  it('guarda o texto exatamente como veio, inclusive vazio ou fora do formato', () => {
    for (const text of ['', ' LF1|x', 'WIFI:S:loja;T:WPA;;', 'CAFÉ́\n|']) {
      expect(ReadingSchema.parse({ ...READING, text }).text).toBe(text);
    }
  });

  it('recusa campos derivados do texto', () => {
    const extras = [
      { systemCode: '118789' },
      { fields: { copy: 'c1' } },
      { parsed: { ok: true } },
      { reason: 'not-lf1' },
    ];

    for (const extra of extras) {
      expect(messagesOf({ ...READING, ...extra })).toEqual([
        'Leitura não aceita campo fora do registro',
      ]);
    }
  });

  it('recusa posição incompleta, com canto a mais ou coordenada inválida', () => {
    const { bottomLeft, ...tresCantos } = POSITION;

    expect(bottomLeft.x).toBe(118);
    expect(messagesOf({ ...READING, position: tresCantos })).toEqual([
      'Canto inferior esquerdo obrigatório',
    ]);
    expect(messagesOf({ ...READING, position: { ...POSITION, center: { x: 1, y: 1 } } })).toEqual([
      'Posição aceita só os quatro cantos',
    ]);
    expect(
      messagesOf({
        ...READING,
        position: {
          topLeft: { x: Number.NaN, y: 0 },
          topRight: { x: Number.POSITIVE_INFINITY, y: 0 },
          bottomRight: { x: 1, y: 1, z: 0 },
          bottomLeft: [1, 1],
        },
      }),
    ).toEqual([
      'Canto superior esquerdo: x deve ser um número',
      'Canto superior direito: x deve ser um número finito',
      'Canto inferior direito aceita só x e y',
      'Canto inferior esquerdo deve ter x e y',
    ]);
    expect(messagesOf({ ...READING, position: 'topo' })).toEqual([
      'Posição deve ter os quatro cantos',
    ]);
  });

  it('escreve em português a mensagem de cada campo', () => {
    expect(
      messagesOf({ id: 3, sessionId: '', sourceId: 'fonte', text: 42, readAt: 1_790_000_000_000 }),
    ).toEqual([
      'Identificador da leitura deve ser texto',
      'Identificador da sessão deve ser um UUID',
      'Identificador da fonte deve ser um UUID',
      'Texto lido deve ser texto',
      'Data da leitura deve ser texto',
    ]);
  });

  it('recusa campo obrigatório ausente', () => {
    expect(messagesOf({})).toEqual([
      'Identificador da leitura obrigatório',
      'Identificador da sessão obrigatório',
      'Identificador da fonte obrigatório',
      'Texto lido obrigatório',
      'Data da leitura obrigatória',
    ]);
  });
});
