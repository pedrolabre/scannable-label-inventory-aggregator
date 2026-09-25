// @vitest-environment node

import 'fake-indexeddb/auto';

import { readFileSync } from 'node:fs';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { processSource } from '../domain/services/sourceProcessing.js';
import { decodeImage, prepareDecoder } from '../lib/decoder.js';
import { DECODER_ERROR_CODES, DecoderError } from '../lib/decoderError.js';
import { StockVisionDatabase } from '../storage/indexed-db.js';
import { createSession } from '../storage/sessionRepository.js';
import { QR_FIXTURES } from '../test-fixtures/qrFixtures.js';
import { readFixtureBytes, readPngFixture } from '../test-fixtures/readPngFixture.js';

import { createCaptureStore, createProcessingDeps } from './useCaptureStore.js';

/**
 * Ponta a ponta fora do navegador: resumo, consulta e gravacao reais sobre
 * `fake-indexeddb` e o leitor real sobre as imagens de teste. So a abertura da
 * foto e trocada, porque o Node nao tem `createImageBitmap`: os pixels saem do
 * proprio PNG.
 */

const WASM_BINARY = new Uint8Array(
  readFileSync(new URL('../../public/zxing/zxing_reader.wasm', import.meta.url)),
);

const QR_4 = QR_FIXTURES.find((fixture) => fixture.file === 'qr-4.png');

const LAST_MODIFIED = 1_790_000_000_000;

let db;
let session;

function fixtureFile(name, fileName = name) {
  return new File([readFixtureBytes(name)], fileName, {
    type: 'image/png',
    lastModified: LAST_MODIFIED,
  });
}

/** Abre o PNG de teste pelo nome original, como o navegador abriria o arquivo. */
async function loadFixtureImage(file) {
  const fixture = QR_FIXTURES.find((item) => file.name.endsWith(item.file));

  return readPngFixture(fixture.file);
}

function deps() {
  return { ...createProcessingDeps(db), loadImage: loadFixtureImage };
}

async function counts() {
  return { sources: await db.sources.count(), readings: await db.readings.count() };
}

beforeAll(async () => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('rede bloqueada no teste')));
  await prepareDecoder({ wasmBinary: WASM_BINARY });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  db = new StockVisionDatabase(`teste-${crypto.randomUUID()}`);
  session = await createSession(db, { name: 'Loja' });
});

afterEach(async () => {
  await db.delete();
});

describe('processSource com banco e leitor reais', () => {
  it('grava 1 fonte e 4 leituras com o texto e a posição exatos', async () => {
    const expected = await decodeImage(readPngFixture('qr-4.png'));

    const outcome = await processSource(
      { file: fixtureFile('qr-4.png'), origin: 'file' },
      session.id,
      deps(),
    );

    expect(outcome).toMatchObject({
      status: 'read',
      summary: { symbolCount: 4, validCount: 4, rejectedCount: 0 },
      warnings: [],
    });

    const sources = await db.sources.toArray();
    const readings = await db.readings.where('sourceId').equals(outcome.source.id).sortBy('text');

    expect(sources).toEqual([
      {
        id: outcome.source.id,
        sessionId: session.id,
        fileName: 'qr-4.png',
        byteSize: readFixtureBytes('qr-4.png').length,
        lastModified: LAST_MODIFIED,
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        origin: 'file',
        status: 'read',
        width: 328,
        height: 328,
        processedAt: expect.any(String),
      },
    ]);
    expect(readings.map((reading) => reading.text)).toEqual([...QR_4.texts].sort());
    expect(readings.map(({ text, position }) => ({ text, position }))).toEqual(
      [...expected].sort((a, b) => (a.text < b.text ? -1 : 1)),
    );
    expect(readings.every((reading) => reading.sessionId === session.id)).toBe(true);
    expect(await db.sessions.get(session.id)).toEqual(outcome.session);
  });

  it('recusa a mesma foto com outro nome, sem leitura duplicada', async () => {
    await processSource({ file: fixtureFile('qr-4.png'), origin: 'file' }, session.id, deps());

    const outcome = await processSource(
      { file: fixtureFile('qr-4.png', 'copia-de-qr-4.png'), origin: 'camera' },
      session.id,
      deps(),
    );

    expect(outcome).toMatchObject({ status: 'duplicate' });
    expect(await counts()).toEqual({ sources: 1, readings: 4 });
  });

  it('grava a foto que não abre como falhou, sem leitura', async () => {
    const heic = new File([new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70])], 'foto.heic', {
      lastModified: LAST_MODIFIED,
    });
    const outcome = await processSource({ file: heic, origin: 'camera' }, session.id, {
      ...deps(),
      loadImage: async () => {
        throw new DecoderError(DECODER_ERROR_CODES.UNSUPPORTED_FORMAT);
      },
    });

    expect(outcome).toMatchObject({ status: 'failed', failureReason: 'unsupported-format' });
    expect((await db.sources.toArray())[0]).toMatchObject({
      status: 'failed',
      failureReason: 'unsupported-format',
      fileName: 'foto.heic',
    });
    expect(await counts()).toEqual({ sources: 1, readings: 0 });
  });
});

describe('fila com banco e leitor reais', () => {
  function queue() {
    const stored = [];
    const store = createCaptureStore({
      process: (photo, sessionId) => processSource(photo, sessionId, deps()),
      prepare: async () => {},
      currentSessionId: () => session.id,
      onStored: async (outcome) => {
        stored.push(outcome);
      },
    });

    return { store, stored };
  }

  const statuses = (store) => store.getState().items.map((item) => item.status);

  it('recusa a mesma foto enviada duas vezes na mesma fila', async () => {
    const { store, stored } = queue();

    await store
      .getState()
      .enqueue([fixtureFile('qr-4.png'), fixtureFile('qr-1.png'), fixtureFile('qr-4.png')], 'file');

    expect(statuses(store)).toEqual(['read', 'read', 'duplicate']);
    expect(stored.map((outcome) => outcome.readings.length)).toEqual([4, 1]);
    expect(await counts()).toEqual({ sources: 2, readings: 5 });
  });

  it('recusa a mesma foto enviada de novo numa fila separada', async () => {
    const { store } = queue();

    await store.getState().enqueue([fixtureFile('qr-8.png')], 'camera');
    await store.getState().enqueue([fixtureFile('qr-8.png', 'IMG_0001.png')], 'camera');

    expect(statuses(store)).toEqual(['duplicate']);
    expect(await counts()).toEqual({ sources: 1, readings: 8 });
  });

  it('aceita a mesma foto em outra sessão', async () => {
    const other = await createSession(db, { name: 'Depósito' });
    let current = session.id;
    const store = createCaptureStore({
      process: (photo, sessionId) => processSource(photo, sessionId, deps()),
      prepare: async () => {},
      currentSessionId: () => current,
      onStored: async () => {},
    });

    await store.getState().enqueue([fixtureFile('qr-1.png')], 'file');
    current = other.id;
    await store.getState().enqueue([fixtureFile('qr-1.png')], 'file');

    expect(statuses(store)).toEqual(['read']);
    expect(await counts()).toEqual({ sources: 2, readings: 2 });
  });
});
