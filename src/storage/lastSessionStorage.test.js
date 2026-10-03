// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { LAST_SESSION_KEY, readLastSessionId, writeLastSessionId } from './lastSessionStorage.js';

function memoryStorage() {
  const values = new Map();

  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const refusing = {
  getItem: () => {
    throw new Error('acesso negado');
  },
  setItem: () => {
    throw new Error('cota cheia');
  },
};

describe('lastSessionStorage', () => {
  it('guarda e devolve o identificador da última sessão aberta', () => {
    const storage = memoryStorage();

    expect(readLastSessionId(storage)).toBeNull();

    writeLastSessionId('sessao-b', storage);

    expect(readLastSessionId(storage)).toBe('sessao-b');
    expect(storage.getItem(LAST_SESSION_KEY)).toBe('sessao-b');
  });

  it('devolve null sem armazenamento, com valor vazio ou com a leitura recusada', () => {
    const storage = memoryStorage();

    storage.setItem(LAST_SESSION_KEY, '');

    expect(readLastSessionId(null)).toBeNull();
    expect(readLastSessionId(storage)).toBeNull();
    expect(readLastSessionId(refusing)).toBeNull();
  });

  it('ignora a escrita recusada ou sem armazenamento', () => {
    expect(() => writeLastSessionId('sessao-a', refusing)).not.toThrow();
    expect(() => writeLastSessionId('sessao-a', null)).not.toThrow();
  });
});
