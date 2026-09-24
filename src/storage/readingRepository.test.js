// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StockVisionDatabase } from './indexed-db.js';
import { createReadings, listReadingsBySession } from './readingRepository.js';
import { createSession } from './sessionRepository.js';
import { createSource } from './sourceRepository.js';

let db;
let session;
let source;

const POSITION = {
  topLeft: { x: 10, y: 10 },
  topRight: { x: 110, y: 12 },
  bottomRight: { x: 108, y: 112 },
  bottomLeft: { x: 8, y: 110 },
};

const OFFICIAL = 'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1';

function sourceWith(sha256Char) {
  return {
    fileName: 'prateleira.jpg',
    byteSize: 1000,
    lastModified: 1_790_000_000_000,
    sha256: sha256Char.repeat(64),
    origin: 'file',
    status: 'read',
    width: 800,
    height: 600,
  };
}

beforeEach(async () => {
  db = new StockVisionDatabase(`teste-${crypto.randomUUID()}`);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
  session = await createSession(db, { name: 'Loja' });
  source = await createSource(db, session.id, sourceWith('a'));
  vi.setSystemTime(new Date('2026-09-24T12:01:00.000Z'));
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

describe('createReadings', () => {
  it('grava o texto bruto e a posição, com identificador, sessão, fonte e data', async () => {
    const [stored] = await createReadings(db, session.id, source.id, [
      { text: OFFICIAL, position: POSITION },
    ]);

    expect(stored).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      sessionId: session.id,
      sourceId: source.id,
      text: OFFICIAL,
      position: POSITION,
      readAt: '2026-09-24T12:01:00.000Z',
    });
    expect(await db.readings.get(stored.id)).toEqual(stored);
  });

  it('guarda nenhum campo derivado do texto', async () => {
    const [stored] = await createReadings(db, session.id, source.id, [{ text: OFFICIAL }]);

    expect(Object.keys(await db.readings.get(stored.id)).sort()).toEqual([
      'id',
      'readAt',
      'sessionId',
      'sourceId',
      'text',
    ]);
  });

  it('guarda o texto recusado pelo formato como veio', async () => {
    const texts = ['', 'lf1|118789|x|1|||c1', 'LF2|A|B|1|||c1'];
    const stored = await createReadings(
      db,
      session.id,
      source.id,
      texts.map((text) => ({ text })),
    );

    expect(stored.map((reading) => reading.text)).toEqual(texts);
    expect(await db.readings.count()).toBe(3);
  });

  it('atualiza a data da sessão na mesma gravação', async () => {
    await createReadings(db, session.id, source.id, [{ text: OFFICIAL }]);

    expect((await db.sessions.get(session.id)).updatedAt).toBe('2026-09-24T12:01:00.000Z');
  });

  it('recusa o conjunto inteiro quando uma leitura não passa no schema', async () => {
    const valida = { text: OFFICIAL };
    const invalidas = [
      { text: OFFICIAL, fields: { systemCode: '118789' } },
      { text: OFFICIAL, position: { topLeft: { x: 1, y: 1 } } },
    ];

    for (const invalida of invalidas) {
      await expect(
        createReadings(db, session.id, source.id, [valida, invalida]),
      ).rejects.toMatchObject({ name: 'ZodError' });
    }

    expect(await db.readings.count()).toBe(0);
    expect((await db.sessions.get(session.id)).updatedAt).toBe(session.updatedAt);
  });

  it('recusa fonte inexistente ou de outra sessão', async () => {
    const outra = await createSession(db, { name: 'Depósito' });
    const reading = [{ text: OFFICIAL }];

    await expect(createReadings(db, outra.id, source.id, reading)).rejects.toMatchObject({
      name: 'MissingSourceError',
    });
    await expect(
      createReadings(db, session.id, crypto.randomUUID(), reading),
    ).rejects.toMatchObject({ name: 'MissingSourceError' });
    expect(await db.readings.count()).toBe(0);
  });

  it('aceita a foto sem nenhum símbolo', async () => {
    await expect(createReadings(db, session.id, source.id, [])).resolves.toEqual([]);
  });
});

describe('listReadingsBySession', () => {
  it('lista só as leituras da sessão, na ordem da gravação', async () => {
    const outra = await createSession(db, { name: 'Depósito' });
    const outraFonte = await createSource(db, outra.id, sourceWith('a'));
    const [primeira] = await createReadings(db, session.id, source.id, [{ text: 'primeira' }]);

    vi.setSystemTime(new Date('2026-09-24T12:02:00.000Z'));
    const [segunda] = await createReadings(db, session.id, source.id, [{ text: 'segunda' }]);
    await createReadings(db, outra.id, outraFonte.id, [{ text: 'de outra sessão' }]);

    expect(await listReadingsBySession(db, session.id)).toEqual([primeira, segunda]);
  });
});
