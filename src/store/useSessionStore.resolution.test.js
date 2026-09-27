// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { qrFixtureReadings } from '../test-fixtures/readingFixtures.js';

const DB = vi.hoisted(() => ({ name: 'banco simulado' }));

const sessionRepository = vi.hoisted(() => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  listSessions: vi.fn(),
  renameSession: vi.fn(),
}));
const sourceRepository = vi.hoisted(() => ({ listSourcesBySession: vi.fn() }));
const readingRepository = vi.hoisted(() => ({ listReadingsBySession: vi.fn() }));
const resolutionRepository = vi.hoisted(() => ({
  listResolutionsBySession: vi.fn(),
  saveResolution: vi.fn(),
  deleteResolution: vi.fn(),
}));

vi.mock('../storage/indexed-db.js', () => ({ getAppDatabase: () => DB }));
vi.mock('../storage/sessionRepository.js', () => sessionRepository);
vi.mock('../storage/sourceRepository.js', () => sourceRepository);
vi.mock('../storage/readingRepository.js', () => readingRepository);
vi.mock('../storage/resolutionRepository.js', () => resolutionRepository);

const { useSessionStore } = await import('./useSessionStore.js');

const INITIAL = useSessionStore.getState();

const RECENTE = { id: 's-recente', name: 'Loja', updatedAt: '2026-09-24T12:00:00.000Z' };
const ANTIGA = { id: 's-antiga', name: 'Depósito', updatedAt: '2026-09-20T12:00:00.000Z' };

// As duas imagens de teste juntas: o 118789 diverge no codigo de barras e no NCM.
const READINGS = [
  ...qrFixtureReadings('qr-4.png', 'foto-4'),
  ...qrFixtureReadings('qr-8.png', 'foto-8'),
];

let storedResolutions;

function state() {
  return useSessionStore.getState();
}

function resolution(sessionId, systemCode, choices) {
  return { sessionId, systemCode, choices };
}

function touched(session, updatedAt = '2026-09-24T15:00:00.000Z') {
  return { ...session, updatedAt };
}

beforeEach(async () => {
  vi.clearAllMocks();
  useSessionStore.setState(INITIAL, true);
  storedResolutions = { 's-recente': [], 's-antiga': [] };

  sessionRepository.listSessions.mockResolvedValue([RECENTE, ANTIGA]);
  sourceRepository.listSourcesBySession.mockResolvedValue([]);
  readingRepository.listReadingsBySession.mockImplementation(async (db, id) =>
    id === 's-recente' ? READINGS : [],
  );
  resolutionRepository.listResolutionsBySession.mockImplementation(
    async (db, id) => storedResolutions[id],
  );
  resolutionRepository.saveResolution.mockImplementation(async (db, record) => ({
    session: touched(record.sessionId === 's-recente' ? RECENTE : ANTIGA),
    resolution: record,
  }));
  resolutionRepository.deleteResolution.mockImplementation(async (db, sessionId) => ({
    session: touched(sessionId === 's-recente' ? RECENTE : ANTIGA),
  }));
});

async function openRecent(resolutions = []) {
  storedResolutions['s-recente'] = resolutions;
  await state().hydrate();
  vi.clearAllMocks();
}

describe('resolveConflict', () => {
  it('grava a escolha pelo repositório e reflete a resolução e a data da sessão', async () => {
    await openRecent();

    const stored = await state().resolveConflict('s-recente', '118789', 'ean', null);

    expect(resolutionRepository.saveResolution).toHaveBeenCalledWith(
      DB,
      resolution('s-recente', '118789', { ean: null }),
    );
    expect(stored).toEqual(resolution('s-recente', '118789', { ean: null }));
    expect(state().resolutions).toEqual([stored]);
    expect(state().sessions).toEqual([touched(RECENTE), ANTIGA]);
    expect(readingRepository.listReadingsBySession).not.toHaveBeenCalled();
  });

  it('soma o campo às escolhas já gravadas do produto', async () => {
    await openRecent([resolution('s-recente', '118789', { ean: null })]);

    await state().resolveConflict('s-recente', '118789', 'ncm', '94035000');

    expect(resolutionRepository.saveResolution).toHaveBeenCalledWith(
      DB,
      resolution('s-recente', '118789', { ean: null, ncm: '94035000' }),
    );
    expect(state().resolutions).toEqual([
      resolution('s-recente', '118789', { ean: null, ncm: '94035000' }),
    ]);
  });

  it('troca a escolha do mesmo campo e mantém a lista na ordem dos códigos', async () => {
    const other = resolution('s-recente', 'DEMO-999', { ncm: null });

    await openRecent([resolution('s-recente', '118789', { ean: null }), other]);

    await state().resolveConflict('s-recente', '118789', 'ean', '7899075420416');

    expect(state().resolutions).toEqual([
      resolution('s-recente', '118789', { ean: '7899075420416' }),
      other,
    ]);
  });

  it('reordena a lista quando a sessão aberta não era a mais recente', async () => {
    readingRepository.listReadingsBySession.mockResolvedValue(READINGS);
    await state().hydrate();
    await state().selectSession('s-antiga');

    await state().resolveConflict('s-antiga', '118789', 'ncm', null);

    expect(state().sessions).toEqual([touched(ANTIGA), RECENTE]);
    expect(state().resolutions).toEqual([resolution('s-antiga', '118789', { ncm: null })]);
  });

  it('recusa a escolha sem sessão aberta', async () => {
    await expect(state().resolveConflict('s-recente', '118789', 'ean', null)).rejects.toMatchObject(
      {
        name: 'SessionNotOpenError',
        message: 'A sessão desta escolha não está aberta. Abra a sessão e tente de novo.',
      },
    );
    expect(resolutionRepository.saveResolution).not.toHaveBeenCalled();
  });

  it('recusa a escolha para uma sessão que não é a aberta', async () => {
    await openRecent();

    await expect(state().resolveConflict('s-antiga', '118789', 'ean', null)).rejects.toMatchObject({
      name: 'SessionNotOpenError',
    });
    expect(resolutionRepository.saveResolution).not.toHaveBeenCalled();
  });

  it('recusa campo sem conflito, produto ausente e valor fora das variantes', async () => {
    await openRecent();

    for (const [systemCode, field, value] of [
      ['118789', 'displayName', 'CANTINHO CAFE RUBI'],
      ['DEMO-999', 'ean', null],
      ['118789', 'ean', '7899075420417'],
      ['118789', 'ncm', undefined],
      ['118789', 'copy', 'c1'],
    ]) {
      await expect(
        state().resolveConflict('s-recente', systemCode, field, value),
      ).rejects.toMatchObject({
        name: 'StaleConflictError',
        message:
          'Esta escolha não corresponde mais às variantes do produto. Confira o conflito e escolha de novo.',
      });
    }

    expect(resolutionRepository.saveResolution).not.toHaveBeenCalled();
    expect(state().resolutions).toEqual([]);
  });

  it('relê o banco e deixa a falha da gravação subir', async () => {
    await openRecent();
    const falha = new Error('falha');

    resolutionRepository.saveResolution.mockRejectedValue(falha);
    storedResolutions['s-recente'] = [resolution('s-recente', '118789', { ncm: null })];

    await expect(state().resolveConflict('s-recente', '118789', 'ean', null)).rejects.toBe(falha);
    expect(sessionRepository.listSessions).toHaveBeenCalledTimes(1);
    expect(state().resolutions).toEqual([resolution('s-recente', '118789', { ncm: null })]);
  });

  it('relê a sessão quando a carga dela está em andamento', async () => {
    readingRepository.listReadingsBySession.mockResolvedValue(READINGS);
    await state().hydrate();

    let release;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });

    // A carga le o banco antes da gravacao da escolha e so termina depois dela.
    resolutionRepository.listResolutionsBySession.mockImplementationOnce(async () => {
      await blocked;
      return [];
    });
    resolutionRepository.listResolutionsBySession.mockImplementationOnce(async () => [
      resolution('s-recente', '118789', { ean: null }),
    ]);

    const selecting = state().selectSession('s-recente');
    const resolving = state().resolveConflict('s-recente', '118789', 'ean', null);

    release();
    await Promise.all([selecting, resolving]);

    expect(state().resolutions).toEqual([resolution('s-recente', '118789', { ean: null })]);
  });

  it('não mexe nas resoluções quando outra sessão abriu durante a gravação', async () => {
    await openRecent();
    readingRepository.listReadingsBySession.mockResolvedValue([]);

    let release;
    resolutionRepository.saveResolution.mockImplementationOnce(
      (db, record) =>
        new Promise((resolve) => {
          release = () => resolve({ session: touched(RECENTE), resolution: record });
        }),
    );

    const resolving = state().resolveConflict('s-recente', '118789', 'ean', null);
    await state().selectSession('s-antiga');
    release();
    await resolving;

    expect(state()).toMatchObject({ currentSessionId: 's-antiga', resolutions: [] });
    expect(state().sessions).toEqual([touched(RECENTE), ANTIGA]);
  });
});

describe('clearResolution', () => {
  it('retira um campo e grava o que sobrou', async () => {
    await openRecent([resolution('s-recente', '118789', { ean: null, ncm: null })]);

    const remaining = await state().clearResolution('s-recente', '118789', 'ean');

    expect(resolutionRepository.saveResolution).toHaveBeenCalledWith(
      DB,
      resolution('s-recente', '118789', { ncm: null }),
    );
    expect(remaining).toEqual(resolution('s-recente', '118789', { ncm: null }));
    expect(state().resolutions).toEqual([remaining]);
    expect(state().sessions[0]).toEqual(touched(RECENTE));
  });

  it('apaga o registro quando retira o último campo', async () => {
    const other = resolution('s-recente', 'DEMO-999', { ncm: null });

    await openRecent([resolution('s-recente', '118789', { ean: null }), other]);

    expect(await state().clearResolution('s-recente', '118789', 'ean')).toBeNull();
    expect(resolutionRepository.deleteResolution).toHaveBeenCalledWith(DB, 's-recente', '118789');
    expect(resolutionRepository.saveResolution).not.toHaveBeenCalled();
    expect(state().resolutions).toEqual([other]);
    expect(state().sessions).toEqual([touched(RECENTE), ANTIGA]);
  });

  it('retira a escolha órfã, de produto que não diverge mais', async () => {
    await openRecent([resolution('s-recente', 'DEMO-999', { priceInCentavos: 100 })]);

    await state().clearResolution('s-recente', 'DEMO-999', 'priceInCentavos');

    expect(resolutionRepository.deleteResolution).toHaveBeenCalledWith(DB, 's-recente', 'DEMO-999');
    expect(state().resolutions).toEqual([]);
  });

  it('não grava nada quando o campo não tem escolha', async () => {
    await openRecent([resolution('s-recente', '118789', { ean: null })]);

    expect(await state().clearResolution('s-recente', '118789', 'ncm')).toBeNull();
    expect(await state().clearResolution('s-recente', 'DEMO-001', 'ean')).toBeNull();
    expect(resolutionRepository.saveResolution).not.toHaveBeenCalled();
    expect(resolutionRepository.deleteResolution).not.toHaveBeenCalled();
    expect(state().sessions).toEqual([RECENTE, ANTIGA]);
  });

  it('recusa sem sessão aberta e para outra sessão', async () => {
    await expect(state().clearResolution('s-recente', '118789', 'ean')).rejects.toMatchObject({
      name: 'SessionNotOpenError',
    });

    await openRecent([resolution('s-recente', '118789', { ean: null })]);

    await expect(state().clearResolution('s-antiga', '118789', 'ean')).rejects.toMatchObject({
      name: 'SessionNotOpenError',
    });
    expect(resolutionRepository.deleteResolution).not.toHaveBeenCalled();
  });

  it('relê o banco e deixa a falha subir', async () => {
    await openRecent([resolution('s-recente', '118789', { ean: null })]);
    const falha = new Error('falha');

    resolutionRepository.deleteResolution.mockRejectedValue(falha);

    await expect(state().clearResolution('s-recente', '118789', 'ean')).rejects.toBe(falha);
    expect(sessionRepository.listSessions).toHaveBeenCalledTimes(1);
    expect(state().resolutions).toEqual([resolution('s-recente', '118789', { ean: null })]);
  });
});
