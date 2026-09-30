// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { formatSessionDate, sessionNameCount, sessionNameIssue } from './sessionText.js';

describe('formatSessionDate', () => {
  it('escreve a data e a hora locais com dois dígitos', () => {
    const local = new Date(2026, 9, 2, 7, 5).toISOString();

    expect(formatSessionDate(local)).toBe('02/10/2026 07:05');
  });

  it('devolve vazio para data que não se lê', () => {
    expect(formatSessionDate('ontem')).toBe('');
  });
});

describe('sessionNameIssue', () => {
  it('aceita o nome aparado entre 1 e 80 caracteres', () => {
    expect(sessionNameIssue('  Depósito norte  ')).toBeNull();
    expect(sessionNameIssue('x'.repeat(80))).toBeNull();
  });

  it('recusa nome vazio e acima de 80 caracteres com a frase da gravação', () => {
    expect(sessionNameIssue('   ')).toBe('Nome da sessão obrigatório.');
    expect(sessionNameIssue('x'.repeat(81))).toBe(
      'Nome da sessão deve ter no máximo 80 caracteres.',
    );
  });
});

describe('sessionNameCount', () => {
  it('conta o nome aparado contra o limite', () => {
    expect(sessionNameCount('  Loja ')).toBe('4/80');
    expect(sessionNameCount('')).toBe('0/80');
  });
});
