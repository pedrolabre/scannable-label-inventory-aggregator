// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { Lf1FieldsSchema } from './lf1FieldsSchema.js';

const FIELDS = {
  version: 'LF1',
  systemCode: '118789',
  displayName: 'CANTINHO CAFE RUBI',
  priceInCentavos: 85990,
  ean: '7899075420416',
  ncm: '94035000',
  copy: 'c1',
};

function without(fields, ...keys) {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !keys.includes(key)));
}

function messagesOf(fields) {
  const result = Lf1FieldsSchema.safeParse(fields);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('Lf1FieldsSchema', () => {
  it('aceita os campos completos e sem opcionais', () => {
    const withoutOptionals = without(FIELDS, 'ean', 'ncm');

    expect(Lf1FieldsSchema.parse(FIELDS)).toEqual(FIELDS);
    expect(Lf1FieldsSchema.parse(withoutOptionals)).toEqual(withoutOptionals);
  });

  it('recusa campo fora das sete posições', () => {
    expect(messagesOf({ ...FIELDS, lote: 'A1' })).toEqual([
      'Leitura LF1 não aceita campo fora das sete posições',
    ]);
  });

  it('recusa a barra vertical no nome', () => {
    expect(messagesOf({ ...FIELDS, displayName: 'MESA | CADEIRA' })).toEqual([
      'Nome não pode ter barra vertical (|) nem caractere de controle',
    ]);
  });

  it('recusa preço em texto, com casas decimais ou acima do maior inteiro exato', () => {
    expect(messagesOf({ ...FIELDS, priceInCentavos: '85990' })).toEqual([
      'Preço em centavos deve ser um número inteiro',
    ]);
    expect(messagesOf({ ...FIELDS, priceInCentavos: 859.9 })).toEqual([
      'Preço em centavos deve ser um número inteiro',
    ]);
    expect(messagesOf({ ...FIELDS, priceInCentavos: Number.MAX_SAFE_INTEGER + 1 })).toEqual([
      `Preço em centavos deve ser no máximo ${Number.MAX_SAFE_INTEGER}`,
    ]);
  });

  it('escreve em português a mensagem de cada campo', () => {
    expect(
      messagesOf({
        version: 'LF2',
        systemCode: 'AB 12',
        displayName: '',
        priceInCentavos: -1,
        ean: '123',
        ncm: '9403500',
        copy: 'c0',
      }),
    ).toEqual([
      'Versão deve ser LF1',
      'Código do sistema aceita apenas letras, números e hífen',
      'Nome obrigatório',
      'Preço em centavos não pode ser negativo',
      'Código de barras deve ter 8, 12, 13 ou 14 dígitos',
      'NCM deve ter 8 dígitos, sem ponto',
      'Exemplar deve ser c1, c2, c3 e assim por diante',
    ]);
  });

  it('recusa campo obrigatório ausente', () => {
    expect(messagesOf(without(FIELDS, 'copy'))).toEqual(['Exemplar obrigatório']);
  });
});
