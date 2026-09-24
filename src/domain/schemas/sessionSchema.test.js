// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { SESSION_NAME_MAX_LENGTH, SessionSchema, defaultSessionName } from './sessionSchema.js';

const SESSION = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Inventário da loja de teste',
  createdAt: '2026-09-24T12:00:00.000Z',
  updatedAt: '2026-09-24T12:30:00.000Z',
};

function messagesOf(value) {
  const result = SessionSchema.safeParse(value);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('SessionSchema', () => {
  it('aceita a sessão completa', () => {
    expect(SessionSchema.parse(SESSION)).toEqual(SESSION);
  });

  it('apara os espaços das pontas do nome', () => {
    expect(SessionSchema.parse({ ...SESSION, name: '  Depósito  ' }).name).toBe('Depósito');
  });

  it('aceita o nome no limite e recusa acima dele', () => {
    const limite = 'a'.repeat(SESSION_NAME_MAX_LENGTH);

    expect(SESSION_NAME_MAX_LENGTH).toBe(80);
    expect(SessionSchema.parse({ ...SESSION, name: limite }).name).toBe(limite);
    expect(messagesOf({ ...SESSION, name: `${limite}a` })).toEqual([
      'Nome da sessão deve ter no máximo 80 caracteres',
    ]);
  });

  it('recusa nome vazio ou só de espaços', () => {
    expect(messagesOf({ ...SESSION, name: '' })).toEqual(['Nome da sessão obrigatório']);
    expect(messagesOf({ ...SESSION, name: '   ' })).toEqual(['Nome da sessão obrigatório']);
  });

  it('recusa campo fora do registro', () => {
    expect(messagesOf({ ...SESSION, sources: [] })).toEqual([
      'Sessão não aceita campo fora do registro',
    ]);
  });

  it('escreve em português a mensagem de cada campo', () => {
    expect(
      messagesOf({
        id: 'sessao-1',
        name: 42,
        createdAt: '2026-09-24',
        updatedAt: '2026-09-24T09:30:00.000-03:00',
      }),
    ).toEqual([
      'Identificador da sessão deve ser um UUID',
      'Nome da sessão deve ser texto',
      'Data de criação da sessão deve ser data e hora em ISO 8601 (UTC)',
      'Data de atualização da sessão deve ser data e hora em ISO 8601 (UTC)',
    ]);
  });

  it('recusa campo obrigatório ausente', () => {
    expect(messagesOf({})).toEqual([
      'Identificador da sessão obrigatório',
      'Nome da sessão obrigatório',
      'Data de criação da sessão obrigatória',
      'Data de atualização da sessão obrigatória',
    ]);
  });
});

describe('defaultSessionName', () => {
  it('usa a data local com dia e mês de dois dígitos', () => {
    expect(defaultSessionName(new Date(2026, 8, 24, 23, 59))).toBe('Inventário 24/09/2026');
    expect(defaultSessionName(new Date(2027, 0, 5, 0, 0))).toBe('Inventário 05/01/2027');
  });

  it('produz um nome que passa no schema', () => {
    const name = defaultSessionName(new Date(2026, 8, 24));

    expect(SessionSchema.parse({ ...SESSION, name }).name).toBe(name);
  });
});
