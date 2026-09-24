// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ResolutionSchema } from './resolutionSchema.js';

const RESOLUTION = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  systemCode: '118789',
  choices: {
    displayName: 'CANTINHO CAFE RUBI',
    priceInCentavos: 85990,
    ean: '7899075420416',
    ncm: '94035000',
  },
};

function messagesOf(value) {
  const result = ResolutionSchema.safeParse(value);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('ResolutionSchema', () => {
  it('aceita a escolha dos quatro campos', () => {
    expect(ResolutionSchema.parse(RESOLUTION)).toEqual(RESOLUTION);
  });

  it('aceita só o campo resolvido, sem as outras chaves', () => {
    const soPreco = { ...RESOLUTION, choices: { priceInCentavos: 0 } };

    expect(ResolutionSchema.parse(soPreco)).toEqual(soPreco);
  });

  it('grava a escolha da variante sem EAN ou sem NCM como null', () => {
    const semCodigos = { ...RESOLUTION, choices: { ean: null, ncm: null } };

    expect(ResolutionSchema.parse(semCodigos)).toEqual(semCodigos);
  });

  it('recusa nome e preço nulos, que a etiqueta sempre traz', () => {
    expect(
      messagesOf({ ...RESOLUTION, choices: { displayName: null, priceInCentavos: null } }),
    ).toEqual(['Nome deve ser texto', 'Preço em centavos deve ser um número inteiro']);
  });

  it('recusa resolução sem nenhum campo escolhido', () => {
    expect(messagesOf({ ...RESOLUTION, choices: {} })).toEqual([
      'Resolução precisa de pelo menos um campo escolhido',
    ]);
    expect(messagesOf({ ...RESOLUTION, choices: { ean: undefined } })).toEqual([
      'Resolução precisa de pelo menos um campo escolhido',
    ]);
  });

  it('segue a regra de cada campo da etiqueta', () => {
    expect(
      messagesOf({
        ...RESOLUTION,
        systemCode: 'AB 12',
        choices: { displayName: 'MESA | CADEIRA', priceInCentavos: -1, ean: '123', ncm: '9403.50' },
      }),
    ).toEqual([
      'Código do sistema aceita apenas letras, números e hífen',
      'Nome não pode ter barra vertical (|) nem caractere de controle',
      'Preço em centavos não pode ser negativo',
      'Código de barras deve ter 8, 12, 13 ou 14 dígitos',
      'NCM deve ter 8 dígitos, sem ponto',
    ]);
  });

  it('recusa campo fora do registro e fora dos quatro campos', () => {
    expect(messagesOf({ ...RESOLUTION, resolvedBy: 'operador' })).toEqual([
      'Resolução não aceita campo fora do registro',
    ]);
    expect(messagesOf({ ...RESOLUTION, choices: { copy: 'c1', ean: null } })).toEqual([
      'Resolução aceita só nome, preço, código de barras e NCM',
    ]);
  });

  it('recusa campo obrigatório ausente', () => {
    expect(messagesOf({})).toEqual([
      'Identificador da sessão obrigatório',
      'Código do sistema obrigatório',
      'Valores escolhidos obrigatórios',
    ]);
    expect(messagesOf({ ...RESOLUTION, choices: [] })).toEqual([
      'Valores escolhidos devem ser um objeto',
    ]);
  });
});
