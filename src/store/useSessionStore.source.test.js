// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const DB = vi.hoisted(() => ({ name: 'banco simulado' }));

const sessionRepository = vi.hoisted(() => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  listSessions: vi.fn(),
  renameSession: vi.fn(),
}));
const sourceRepository = vi.hoisted(() => ({
  listSourcesBySession: vi.fn(),
  deleteSource: vi.fn(),
}));
const readingRepository = vi.hoisted(() => ({ listReadingsBySession: vi.fn() }));
const resolutionRepository = vi.hoisted(() => ({ listResolutionsBySession: vi.fn() }));

vi.mock('../storage/indexed-db.js', () => ({ getAppDatabase: () => DB }));
vi.mock('../storage/sessionRepository.js', () => sessionRepository);
vi.mock('../storage/sourceRepository.js', () => sourceRepository);
vi.mock('../storage/readingRepository.js', () => readingRepository);
vi.mock('../storage/resolutionRepository.js', () => resolutionRepository);

const { useSessionStore } = await import('./useSessionStore.js');

const INITIAL = useSessionStore.getState();

const RECENTE = { id: 's-recente', name: 'Loja', updatedAt: '2026-09-24T12:00:00.000Z' };
const ANTIGA = { id: 's-antiga', name: 'Depósito', updatedAt: '2026-09-20T12:00:00.000Z' };

const SOURCES = [
  { id: 'f1', sessionId: 's-recente' },
  { id: 'f2', sessionId: 's-recente' },
];
const READINGS = [
  { id: 'l1', sourceId: 'f1' },
  { id: 'l2', sourceId: 'f2' },
  { id: 'l3', sourceId: 'f1' },
];
const RESOLUTIONS = [{ sessionId: 's-recente', systemCode: 'A', choices: { ean: null } }];

function state() {
  return useSessionStore.getState();
}

function touched(session, updatedAt = '2026-09-24T15:00:00.000Z') {
  return { ...session, updatedAt };
}

beforeEach(async () => {
  vi.clearAllMocks();
  useSessionStore.setState(INITIAL, true);

  sessionRepository.listSessions.mockResolvedValue([RECENTE, ANTIGA]);
  sourceRepository.listSourcesBySession.mockImplementation(async (db, id) =>
    id === 's-recente' ? SOURCES : [],
  );
  readingRepository.listReadingsBySession.mockImplementation(async (db, id) =>
    id === 's-recente' ? READINGS : [],
  );
  resolutionRepository.listResolutionsBySession.mockImplementation(async (db, id) =>
    id === 's-recente' ? RESOLUTIONS : [],
  );
  sourceRepository.deleteSource.mockImplementation(async (db, sessionId) => ({
    session: touched(sessionId === 's-recente' ? RECENTE : ANTIGA),
  }));

  await state().hydrate();
  vi.clearAllMocks();
});

describe('removeSource', () => {
  it('apaga pelo repositório e tira a foto e as leituras dela do conteúdo, sem reler o banco', async () => {
    await state().removeSource('s-recente', 'f1');

    expect(sourceRepository.deleteSource).toHaveBeenCalledWith(DB, 's-recente', 'f1');
    expect(state()).toMatchObject({
      currentSessionId: 's-recente',
      sources: [SOURCES[1]],
      readings: [READINGS[1]],
      resolutions: RESOLUTIONS,
      sessions: [touched(RECENTE), ANTIGA],
    });
    expect(sourceRepository.listSourcesBySession).not.toHaveBeenCalled();
    expect(readingRepository.listReadingsBySession).not.toHaveBeenCalled();
  });

  it('reordena a lista pela data nova quando a foto é de outra sessão', async () => {
    await state().removeSource('s-antiga', 'f9');

    expect(state().sessions).toEqual([touched(ANTIGA), RECENTE]);
    expect(state()).toMatchObject({ sources: SOURCES, readings: READINGS });
  });

  it('relê a sessão quando a carga dela está em andamento', async () => {
    let finishLoad;

    sourceRepository.listSourcesBySession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLoad = () => resolve(SOURCES);
        }),
    );

    const loading = state().selectSession('s-recente');

    await state().removeSource('s-recente', 'f1');
    finishLoad();
    await loading;

    expect(sourceRepository.listSourcesBySession).toHaveBeenCalledTimes(2);
    expect(state().isLoading).toBe(false);
  });

  it('relê o banco e deixa a falha subir sem mexer no conteúdo', async () => {
    const falha = Object.assign(new Error('A foto não existe mais nesta sessão.'), {
      name: 'MissingSourceError',
    });

    sourceRepository.deleteSource.mockRejectedValue(falha);

    await expect(state().removeSource('s-recente', 'f1')).rejects.toBe(falha);
    expect(sessionRepository.listSessions).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ sources: SOURCES, readings: READINGS });
  });
});
