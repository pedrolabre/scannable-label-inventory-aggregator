// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  LF1_FIELDS,
  LF1_POSITION_COUNT,
  LF1_REJECTION_REASONS,
  LF1_SEPARATOR,
  LF1_VERSION,
  isLf1Candidate,
  parseLf1,
} from './lf1Contract.js';

const COMPLETE = 'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1';
const WITHOUT_OPTIONALS = 'LF1|118789|CANTINHO CAFE RUBI|85990|||c1';

const { NOT_LF1, UNSUPPORTED_VERSION, INVALID_POSITIONS, INVALID_FIELD } = LF1_REJECTION_REASONS;

function bytesOf(text) {
  return [...new TextEncoder().encode(text)];
}

/** Volta a montar o texto a partir dos campos lidos, na ordem das posicoes. */
function textOf(fields) {
  return LF1_FIELDS.map((field) => (field in fields ? String(fields[field]) : '')).join(
    LF1_SEPARATOR,
  );
}

/** Troca uma posicao do exemplo completo. */
function withPosition(position, value) {
  const parts = COMPLETE.split(LF1_SEPARATOR);
  parts[position] = value;

  return parts.join(LF1_SEPARATOR);
}

function fieldRejection(position, value) {
  return parseLf1(withPosition(position, value));
}

describe('constantes do formato', () => {
  it('fixa a versão, o separador e as sete posições na ordem', () => {
    expect(LF1_VERSION).toBe('LF1');
    expect(LF1_SEPARATOR).toBe('|');
    expect(LF1_POSITION_COUNT).toBe(7);
    expect(LF1_FIELDS).toEqual([
      'version',
      'systemCode',
      'displayName',
      'priceInCentavos',
      'ean',
      'ncm',
      'copy',
    ]);
  });
});

describe('exemplos oficiais', () => {
  it('lê o exemplo completo com todos os campos', () => {
    expect(parseLf1(COMPLETE)).toEqual({
      ok: true,
      fields: {
        version: 'LF1',
        systemCode: '118789',
        displayName: 'CANTINHO CAFE RUBI',
        priceInCentavos: 85990,
        ean: '7899075420416',
        ncm: '94035000',
        copy: 'c1',
      },
    });
  });

  it('lê o exemplo sem opcionais com ean e ncm ausentes', () => {
    const result = parseLf1(WITHOUT_OPTIONALS);

    expect(result).toEqual({
      ok: true,
      fields: {
        version: 'LF1',
        systemCode: '118789',
        displayName: 'CANTINHO CAFE RUBI',
        priceInCentavos: 85990,
        copy: 'c1',
      },
    });
    expect(result.fields).not.toHaveProperty('ean');
    expect(result.fields).not.toHaveProperty('ncm');
  });

  it('devolve campos que remontam os dois textos byte a byte', () => {
    for (const text of [COMPLETE, WITHOUT_OPTIONALS]) {
      const { fields } = parseLf1(text);

      expect(bytesOf(textOf(fields))).toEqual(bytesOf(text));
    }
  });

  it('entrega o preço como número inteiro de centavos', () => {
    expect(Number.isInteger(parseLf1(COMPLETE).fields.priceInCentavos)).toBe(true);
  });
});

describe('texto como veio', () => {
  it('aceita nome com acento sem alterar nenhum byte', () => {
    const text = 'LF1|A-17|Sofá retrátil 3 lugares, 2,10 m|129900|||c2';
    const { fields } = parseLf1(text);

    expect(fields.displayName).toBe('Sofá retrátil 3 lugares, 2,10 m');
    expect(bytesOf(textOf(fields))).toEqual(bytesOf(text));
  });

  it('mantém a forma Unicode recebida, sem normalizar', () => {
    const decomposed = 'Sofá';
    const { fields } = parseLf1(`LF1|A-17|${decomposed}|129900|||c1`);

    expect(fields.displayName).toBe(decomposed);
    expect(fields.displayName).not.toBe(decomposed.normalize('NFC'));
  });

  it('mantém os espaços do nome', () => {
    expect(parseLf1('LF1|A-17|  MESA  |100|||c1').fields.displayName).toBe('  MESA  ');
  });

  it('aceita nome com 60 caracteres', () => {
    expect(parseLf1(withPosition(2, 'N'.repeat(60))).ok).toBe(true);
  });

  it('aceita preço zero, preço com zero à esquerda e o maior inteiro exato', () => {
    expect(parseLf1(withPosition(3, '0')).fields.priceInCentavos).toBe(0);
    expect(parseLf1(withPosition(3, '085990')).fields.priceInCentavos).toBe(85990);
    expect(parseLf1(withPosition(3, '9007199254740991')).fields.priceInCentavos).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('aceita os quatro tamanhos de código de barras e exemplares de vários dígitos', () => {
    for (const ean of ['12345670', '123456789012', '1234567890128', '12345678901231']) {
      expect(parseLf1(withPosition(4, ean)).fields.ean).toBe(ean);
    }

    for (const copy of ['c2', 'c10', 'c5000']) {
      expect(parseLf1(withPosition(6, copy)).fields.copy).toBe(copy);
    }
  });
});

describe('recusa: não é LF1', () => {
  it('recusa texto de outro formato, minúsculas e espaço antes do prefixo', () => {
    const texts = [
      'WIFI:T:WPA;S:Loja Exemplo;P:senha-inventada;;',
      '7899075420416',
      'lf1|118789|CANTINHO CAFE RUBI|85990|||c1',
      ' LF1|118789|CANTINHO CAFE RUBI|85990|||c1',
      'LF|118789|CANTINHO CAFE RUBI|85990|||c1',
      'LFX|118789|CANTINHO CAFE RUBI|85990|||c1',
      '|LF1|118789',
    ];

    for (const text of texts) {
      expect(parseLf1(text)).toEqual({ ok: false, reason: NOT_LF1, message: 'não é LF1' });
    }
  });

  it('recusa texto vazio e entrada que não é texto, sem lançar', () => {
    for (const input of ['', null, undefined, 0, 85990, true, {}, [], ['LF1']]) {
      expect(() => parseLf1(input)).not.toThrow();
      expect(parseLf1(input)).toEqual({ ok: false, reason: NOT_LF1, message: 'não é LF1' });
    }
  });

  it('recusa a chamada sem argumento', () => {
    expect(parseLf1()).toEqual({ ok: false, reason: NOT_LF1, message: 'não é LF1' });
  });
});

describe('recusa: versão não suportada', () => {
  it('recusa LF seguido de dígito que não é LF1', () => {
    for (const version of ['LF2', 'LF0', 'LF10', 'LF1X', 'LF1.1']) {
      expect(parseLf1(withPosition(0, version))).toEqual({
        ok: false,
        reason: UNSUPPORTED_VERSION,
        message: 'versão não suportada',
      });
    }
  });

  it('recusa outra versão mesmo sem barra', () => {
    expect(parseLf1('LF2').reason).toBe(UNSUPPORTED_VERSION);
  });
});

describe('recusa: posições inválidas', () => {
  it('recusa 6 e 8 posições', () => {
    const six = 'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|c1';
    const eight = `${COMPLETE}|extra`;

    expect(six.split('|')).toHaveLength(6);
    expect(eight.split('|')).toHaveLength(8);

    for (const text of [six, eight]) {
      expect(parseLf1(text)).toEqual({
        ok: false,
        reason: INVALID_POSITIONS,
        message: 'posições inválidas',
      });
    }
  });

  it('recusa LF1 sem barra, barra sobrando no fim e posição a menos', () => {
    for (const text of ['LF1', 'LF1|', `${COMPLETE}|`, 'LF1|118789|CANTINHO CAFE RUBI|85990||c1']) {
      expect(parseLf1(text).reason).toBe(INVALID_POSITIONS);
    }
  });
});

describe('recusa: campo inválido', () => {
  const cases = [
    ['código do sistema vazio', 1, '', 'systemCode', 'código do sistema'],
    ['código do sistema com espaço', 1, 'AB 12', 'systemCode', 'código do sistema'],
    ['código do sistema com sublinhado', 1, '118_789', 'systemCode', 'código do sistema'],
    ['código do sistema com acento', 1, 'AÇO-1', 'systemCode', 'código do sistema'],
    ['nome vazio', 2, '', 'displayName', 'nome'],
    ['nome com 61 caracteres', 2, 'N'.repeat(61), 'displayName', 'nome'],
    ['nome com tabulação', 2, 'MESA\tCADEIRA', 'displayName', 'nome'],
    ['nome com quebra de linha', 2, 'MESA\nCADEIRA', 'displayName', 'nome'],
    ['nome com caractere nulo', 2, 'MESA\u0000', 'displayName', 'nome'],
    ['nome com DEL', 2, 'MESA\u007F', 'displayName', 'nome'],
    ['preço vazio', 3, '', 'priceInCentavos', 'preço em centavos'],
    ['preço negativo', 3, '-1', 'priceInCentavos', 'preço em centavos'],
    ['preço com casas decimais', 3, '859.90', 'priceInCentavos', 'preço em centavos'],
    ['preço com vírgula', 3, '859,90', 'priceInCentavos', 'preço em centavos'],
    ['preço em notação científica', 3, '1e3', 'priceInCentavos', 'preço em centavos'],
    ['preço com espaço', 3, ' 85990', 'priceInCentavos', 'preço em centavos'],
    [
      'preço acima do maior inteiro exato',
      3,
      '9007199254740992',
      'priceInCentavos',
      'preço em centavos',
    ],
    ['EAN com 9 dígitos', 4, '123456789', 'ean', 'código de barras'],
    ['EAN com 15 dígitos', 4, '123456789012345', 'ean', 'código de barras'],
    ['EAN com letra', 4, '789907542041A', 'ean', 'código de barras'],
    ['NCM com 7 dígitos', 5, '9403500', 'ncm', 'NCM'],
    ['NCM com ponto', 5, '9403.50.00', 'ncm', 'NCM'],
    ['exemplar c0', 6, 'c0', 'copy', 'exemplar'],
    ['exemplar com zero à esquerda', 6, 'c01', 'copy', 'exemplar'],
    ['exemplar em maiúscula', 6, 'C1', 'copy', 'exemplar'],
    ['exemplar sem número', 6, 'c', 'copy', 'exemplar'],
    ['exemplar vazio', 6, '', 'copy', 'exemplar'],
    ['exemplar com quebra de linha no fim', 6, 'c1\n', 'copy', 'exemplar'],
  ];

  it.each(cases)('recusa %s', (_name, position, value, field, label) => {
    expect(fieldRejection(position, value)).toEqual({
      ok: false,
      reason: INVALID_FIELD,
      message: `campo inválido: ${label}`,
      field,
    });
  });

  it('aponta o primeiro campo inválido na ordem das posições', () => {
    const text = 'LF1|118789|CANTINHO CAFE RUBI|-1|123|9403500|c0';

    expect(parseLf1(text).field).toBe('priceInCentavos');
  });
});

describe('isLf1Candidate', () => {
  it('aceita texto da versão LF1, mesmo com posições ou campos fora da regra', () => {
    for (const text of [COMPLETE, WITHOUT_OPTIONALS, 'LF1', 'LF1|', withPosition(6, 'c0')]) {
      expect(isLf1Candidate(text)).toBe(true);
    }
  });

  it('recusa o que a leitura recusa como não LF1 ou versão não suportada', () => {
    const texts = ['', 'lf1|a', ' LF1|a', 'LF2|a', 'LF10', '7899075420416', null, undefined, 1];

    for (const text of texts) {
      expect(isLf1Candidate(text)).toBe(false);
      expect([NOT_LF1, UNSUPPORTED_VERSION]).toContain(parseLf1(text).reason);
    }
  });
});
