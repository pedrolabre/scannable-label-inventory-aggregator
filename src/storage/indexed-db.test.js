// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DATABASE_NAME, StockVisionDatabase, getAppDatabase } from './indexed-db.js';

let db;

beforeEach(async () => {
  db = new StockVisionDatabase(`teste-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

function indexesOf(storeName) {
  const store = db.backendDB().transaction(storeName).objectStore(storeName);

  return Object.fromEntries(
    [...store.indexNames].map((name) => [name, { unique: store.index(name).unique }]),
  );
}

describe('StockVisionDatabase', () => {
  it('usa o nome recebido e, sem nome, o nome da aplicação', () => {
    expect(db.name).toMatch(/^teste-/);
    expect(DATABASE_NAME).toBe('StockVisionDB');
    expect(new StockVisionDatabase().name).toBe('StockVisionDB');
  });

  it('abre na versão 1 com as quatro tabelas', () => {
    expect(db.verno).toBe(1);
    expect([...db.backendDB().objectStoreNames].sort()).toEqual([
      'readings',
      'resolutions',
      'sessions',
      'sources',
    ]);
  });

  it('cria a chave primária e os índices de cada tabela', () => {
    const keyPaths = Object.fromEntries(
      db.tables.map((table) => [table.name, table.schema.primKey.keyPath]),
    );

    expect(keyPaths).toEqual({
      sessions: 'id',
      sources: 'id',
      readings: 'id',
      resolutions: ['sessionId', 'systemCode'],
    });
    expect(indexesOf('sessions')).toEqual({ updatedAt: { unique: false } });
    expect(indexesOf('sources')).toEqual({
      sessionId: { unique: false },
      '[sessionId+sha256]': { unique: true },
    });
    expect(indexesOf('readings')).toEqual({
      sessionId: { unique: false },
      sourceId: { unique: false },
      text: { unique: false },
    });
    expect(indexesOf('resolutions')).toEqual({ sessionId: { unique: false } });
  });

  it('mantém cada banco isolado pelo nome', async () => {
    const outro = new StockVisionDatabase(`teste-${crypto.randomUUID()}`);

    await db.sessions.add({ id: 'a' });

    expect(await outro.sessions.count()).toBe(0);
    await outro.delete();
  });
});

describe('getAppDatabase', () => {
  it('devolve sempre a mesma instância, com o nome da aplicação', () => {
    const primeira = getAppDatabase();

    expect(primeira).toBeInstanceOf(StockVisionDatabase);
    expect(primeira.name).toBe('StockVisionDB');
    expect(getAppDatabase()).toBe(primeira);
    expect(primeira.isOpen()).toBe(false);
  });
});
