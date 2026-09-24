// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { SessionSchema } from '../domain/schemas/sessionSchema.js';

import {
  STORAGE_RULE_ERRORS,
  createStorageRuleError,
  describeStorageError,
  describeStorageReadError,
  hasErrorName,
} from './storageError.js';

function named(name, inner) {
  const error = new Error('mensagem do navegador em inglês');

  error.name = name;

  if (inner) {
    error.inner = inner;
  }

  return error;
}

describe('createStorageRuleError', () => {
  it('cria o erro de cada regra com o nome e a mensagem em português', () => {
    expect(STORAGE_RULE_ERRORS).toEqual({
      DUPLICATE_SOURCE: 'DuplicateSourceError',
      MISSING_SESSION: 'MissingSessionError',
      MISSING_SOURCE: 'MissingSourceError',
    });

    const duplicate = createStorageRuleError(STORAGE_RULE_ERRORS.DUPLICATE_SOURCE);

    expect(duplicate).toBeInstanceOf(Error);
    expect(duplicate.name).toBe('DuplicateSourceError');
    expect(duplicate.message).toBe(
      'Esta foto já foi lida nesta sessão. Escolha outra foto ou abra outra sessão.',
    );
    expect(describeStorageError(duplicate)).toBe(duplicate.message);
  });
});

describe('describeStorageError', () => {
  it('traduz cada falha conhecida para o que fazer', () => {
    expect(
      Object.fromEntries(
        [
          'MissingSessionError',
          'MissingSourceError',
          'QuotaExceededError',
          'DatabaseClosedError',
          'VersionError',
          'InvalidStateError',
          'MissingAPIError',
          'ConstraintError',
          'AbortError',
        ].map((name) => [name, describeStorageError(named(name))]),
      ),
    ).toEqual({
      MissingSessionError:
        'A sessão não existe mais neste dispositivo. Escolha outra sessão e tente de novo.',
      MissingSourceError: 'A foto não existe mais nesta sessão. Envie a foto de novo.',
      QuotaExceededError:
        'O armazenamento deste dispositivo está cheio. Libere espaço no navegador e tente de novo.',
      DatabaseClosedError:
        'A conexão com o armazenamento deste dispositivo foi interrompida. Recarregue a página e tente de novo.',
      VersionError:
        'O armazenamento deste dispositivo foi aberto por outra versão da aplicação. Feche as outras abas do StockVision e recarregue a página.',
      InvalidStateError:
        'Este navegador está bloqueando o armazenamento local. Verifique as permissões do site e tente de novo.',
      MissingAPIError:
        'Este navegador não oferece armazenamento local. Abra o StockVision fora da janela anônima ou em outro navegador.',
      ConstraintError: 'Este registro já está gravado neste dispositivo.',
      AbortError: 'A gravação foi interrompida antes de terminar. Tente de novo.',
    });
  });

  it('procura o erro do navegador dentro do erro do Dexie', () => {
    const wrapped = named('OpenFailedError', named('QuotaExceededError'));

    expect(describeStorageError(wrapped)).toBe(describeStorageError(named('QuotaExceededError')));
    expect(hasErrorName(wrapped, 'QuotaExceededError')).toBe(true);
    expect(hasErrorName(wrapped, 'ConstraintError')).toBe(false);
    expect(hasErrorName(undefined, 'ConstraintError')).toBe(false);
  });

  it('mostra o primeiro problema da validação do schema', () => {
    const result = SessionSchema.safeParse({
      id: crypto.randomUUID(),
      name: ' ',
      createdAt: '2026-09-24T12:00:00.000Z',
      updatedAt: '2026-09-24T12:00:00.000Z',
    });

    expect(describeStorageError(result.error)).toBe(
      'O registro não foi gravado: Nome da sessão obrigatório. Corrija e tente de novo.',
    );
    expect(describeStorageError({ name: 'ZodError', issues: [] })).toBe(
      'O registro não passou na validação e não foi gravado. Corrija e tente de novo.',
    );
  });

  it('cai no texto geral para falha desconhecida ou ausente', () => {
    const geral = 'Não foi possível gravar no armazenamento deste dispositivo. Tente de novo.';

    expect(describeStorageError(new TypeError('x'))).toBe(geral);
    expect(describeStorageError(undefined)).toBe(geral);
  });
});

describe('describeStorageReadError', () => {
  it('usa a mesma tradução e o texto geral de leitura', () => {
    expect(describeStorageReadError(named('InvalidStateError'))).toBe(
      describeStorageError(named('InvalidStateError')),
    );
    expect(describeStorageReadError(new Error('x'))).toBe(
      'O armazenamento deste dispositivo não respondeu à leitura. Recarregue a página e tente de novo.',
    );
  });
});
