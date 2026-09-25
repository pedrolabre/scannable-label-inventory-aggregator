// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DB = vi.hoisted(() => ({ name: 'banco simulado' }));

const sessionRepository = vi.hoisted(() => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  listSessions: vi.fn(),
  renameSession: vi.fn(),
}));
const sourceRepository = vi.hoisted(() => ({ listSourcesBySession: vi.fn() }));
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

/** Conteudo distinto por sessao, para conferir qual foi carregado. */
function contentOf(sessionId) {
  return {
    sources: [{ id: `fonte-${sessionId}` }],
    readings: [{ id: `leitura-${sessionId}` }],
    resolutions: [{ systemCode: `produto-${sessionId}` }],
  };
}

function state() {
  return useSessionStore.getState();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 24, 10, 0));
  useSessionStore.setState(INITIAL, true);

  sessionRepository.listSessions.mockResolvedValue([RECENTE, ANTIGA]);
  sourceRepository.listSourcesBySession.mockImplementation(async (db, id) => contentOf(id).sources);
  readingRepository.listReadingsBySession.mockImplementation(
    async (db, id) => contentOf(id).readings,
  );
  resolutionRepository.listResolutionsBySession.mockImplementation(
    async (db, id) => contentOf(id).resolutions,
  );
  sessionRepository.createSession.mockImplementation(async (db, { name }) => ({
    id: 's-nova',
    name,
    updatedAt: '2026-09-24T13:00:00.000Z',
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hydrate', () => {
  it('começa vazio, sem sessão aberta', () => {
    expect(INITIAL).toMatchObject({
      sessions: [],
      currentSessionId: null,
      sources: [],
      readings: [],
      resolutions: [],
      isLoading: false,
      loadError: null,
    });
  });

  it('abre a sessão mais recente com o conteúdo dela, lido do banco', async () => {
    await state().hydrate();

    expect(sessionRepository.listSessions).toHaveBeenCalledWith(DB);
    expect(sourceRepository.listSourcesBySession).toHaveBeenCalledWith(DB, 's-recente');
    expect(state()).toMatchObject({
      sessions: [RECENTE, ANTIGA],
      currentSessionId: 's-recente',
      ...contentOf('s-recente'),
      isLoading: false,
      loadError: null,
    });
  });

  it('cria a sessão do dia quando nenhuma está gravada', async () => {
    sessionRepository.listSessions.mockResolvedValue([]);

    await state().hydrate();

    expect(sessionRepository.createSession).toHaveBeenCalledWith(DB, {
      name: 'Inventário 24/09/2026',
    });
    expect(state()).toMatchObject({
      sessions: [{ id: 's-nova', name: 'Inventário 24/09/2026' }],
      currentSessionId: 's-nova',
      sources: [],
      readings: [],
      resolutions: [],
      isLoading: false,
    });
  });

  it('mantém a sessão aberta quando ela continua gravada', async () => {
    useSessionStore.setState({ currentSessionId: 's-antiga' });

    await state().hydrate();

    expect(state()).toMatchObject({ currentSessionId: 's-antiga', ...contentOf('s-antiga') });
  });

  it('reaproveita a leitura em andamento', async () => {
    await Promise.all([state().hydrate(), state().hydrate()]);

    expect(sessionRepository.listSessions).toHaveBeenCalledTimes(1);
  });

  it('registra a falha da lista de sessões em português', async () => {
    const falha = Object.assign(new Error('blocked'), { name: 'InvalidStateError' });

    sessionRepository.listSessions.mockRejectedValue(falha);

    await expect(state().hydrate()).rejects.toBe(falha);
    expect(state()).toMatchObject({
      isLoading: false,
      loadError:
        'Este navegador está bloqueando o armazenamento local. Verifique as permissões do site e tente de novo.',
    });
  });

  it('registra a falha do conteúdo da sessão', async () => {
    readingRepository.listReadingsBySession.mockRejectedValue(new Error('falha'));

    await expect(state().hydrate()).rejects.toThrow('falha');
    expect(state()).toMatchObject({
      isLoading: false,
      loadError:
        'O armazenamento deste dispositivo não respondeu à leitura. Recarregue a página e tente de novo.',
    });
  });
});

describe('selectSession', () => {
  beforeEach(async () => {
    await state().hydrate();
    vi.clearAllMocks();
  });

  it('troca a sessão aberta e carrega o conteúdo dela', async () => {
    await state().selectSession('s-antiga');

    expect(state()).toMatchObject({ currentSessionId: 's-antiga', ...contentOf('s-antiga') });
  });

  it('recusa sessão fora da lista', async () => {
    await expect(state().selectSession('s-inexistente')).rejects.toMatchObject({
      name: 'MissingSessionError',
    });
    expect(state().currentSessionId).toBe('s-recente');
  });

  it('fica com a última sessão escolhida quando duas cargas se cruzam', async () => {
    let releaseFirst;
    const blocked = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    sourceRepository.listSourcesBySession.mockImplementationOnce(async () => {
      await blocked;
      return contentOf('s-antiga').sources;
    });

    const first = state().selectSession('s-antiga');
    await state().selectSession('s-recente');
    releaseFirst();
    await first;

    expect(state()).toMatchObject({ currentSessionId: 's-recente', ...contentOf('s-recente') });
  });
});

describe('createSession', () => {
  beforeEach(async () => {
    await state().hydrate();
  });

  it('cria a sessão com o nome dado e a abre vazia', async () => {
    const stored = await state().createSession('Balanço de fim de ano');

    expect(stored.name).toBe('Balanço de fim de ano');
    expect(state()).toMatchObject({
      sessions: [stored, RECENTE, ANTIGA],
      currentSessionId: 's-nova',
      sources: [],
      readings: [],
      resolutions: [],
    });
  });

  it('usa o nome do dia quando nenhum nome vem', async () => {
    await state().createSession();

    expect(sessionRepository.createSession).toHaveBeenLastCalledWith(DB, {
      name: 'Inventário 24/09/2026',
    });
  });

  it('deixa a falha subir sem mexer no estado', async () => {
    sessionRepository.createSession.mockRejectedValue(new Error('falha'));

    await expect(state().createSession('Loja')).rejects.toThrow('falha');
    expect(state()).toMatchObject({ sessions: [RECENTE, ANTIGA], currentSessionId: 's-recente' });
  });
});

describe('renameSession', () => {
  beforeEach(async () => {
    await state().hydrate();
    vi.clearAllMocks();
  });

  it('troca o nome e reordena pela data de atualização', async () => {
    const renomeada = { ...ANTIGA, name: 'Depósito norte', updatedAt: '2026-09-24T14:00:00.000Z' };

    sessionRepository.renameSession.mockResolvedValue(renomeada);

    await state().renameSession('s-antiga', 'Depósito norte');

    expect(sessionRepository.renameSession).toHaveBeenCalledWith(DB, 's-antiga', 'Depósito norte');
    expect(state().sessions).toEqual([renomeada, RECENTE]);
    expect(state().currentSessionId).toBe('s-recente');
  });

  it('relê o banco e deixa a falha subir', async () => {
    const falha = new Error('falha');

    sessionRepository.renameSession.mockRejectedValue(falha);

    await expect(state().renameSession('s-antiga', 'Outro')).rejects.toBe(falha);
    expect(sessionRepository.listSessions).toHaveBeenCalledTimes(1);
    expect(state().sessions).toEqual([RECENTE, ANTIGA]);
  });
});

describe('deleteSession', () => {
  beforeEach(async () => {
    await state().hydrate();
    vi.clearAllMocks();
    sessionRepository.deleteSession.mockResolvedValue(undefined);
  });

  it('apaga outra sessão sem trocar a aberta', async () => {
    await state().deleteSession('s-antiga');

    expect(sessionRepository.deleteSession).toHaveBeenCalledWith(DB, 's-antiga');
    expect(state()).toMatchObject({
      sessions: [RECENTE],
      currentSessionId: 's-recente',
      ...contentOf('s-recente'),
    });
    expect(sourceRepository.listSourcesBySession).not.toHaveBeenCalled();
  });

  it('apaga a sessão aberta e abre a mais recente das que sobraram', async () => {
    await state().deleteSession('s-recente');

    expect(state()).toMatchObject({
      sessions: [ANTIGA],
      currentSessionId: 's-antiga',
      ...contentOf('s-antiga'),
    });
  });

  it('cria a sessão do dia quando apaga a última', async () => {
    useSessionStore.setState({ sessions: [RECENTE] });

    await state().deleteSession('s-recente');

    expect(state()).toMatchObject({
      sessions: [{ id: 's-nova', name: 'Inventário 24/09/2026' }],
      currentSessionId: 's-nova',
      sources: [],
    });
  });

  it('relê o banco e deixa a falha subir', async () => {
    const falha = new Error('falha');

    sessionRepository.deleteSession.mockRejectedValue(falha);

    await expect(state().deleteSession('s-recente')).rejects.toBe(falha);
    expect(sessionRepository.listSessions).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({
      sessions: [RECENTE, ANTIGA],
      currentSessionId: 's-recente',
      ...contentOf('s-recente'),
    });
  });
});

describe('addProcessedSource', () => {
  beforeEach(async () => {
    await state().hydrate();
    vi.clearAllMocks();
  });

  function processed(sessionId, updatedAt = '2026-09-24T15:00:00.000Z') {
    const base = sessionId === 's-recente' ? RECENTE : ANTIGA;

    return {
      session: { ...base, updatedAt },
      source: { id: `fonte-nova-${sessionId}`, sessionId },
      readings: [
        { id: `leitura-a-${sessionId}`, sourceId: `fonte-nova-${sessionId}` },
        { id: `leitura-b-${sessionId}`, sourceId: `fonte-nova-${sessionId}` },
      ],
    };
  }

  it('acrescenta a fonte e as leituras à sessão aberta, sem reler o banco', async () => {
    const result = processed('s-recente');

    await state().addProcessedSource(result);

    expect(state().sources).toEqual([...contentOf('s-recente').sources, result.source]);
    expect(state().readings).toEqual([...contentOf('s-recente').readings, ...result.readings]);
    expect(sourceRepository.listSourcesBySession).not.toHaveBeenCalled();
  });

  it('não repete a mesma foto recebida duas vezes', async () => {
    const result = processed('s-recente');

    await state().addProcessedSource(result);
    await state().addProcessedSource(result);

    expect(state().sources).toHaveLength(2);
    expect(state().readings).toHaveLength(3);
  });

  it('reordena a lista pela data nova da sessão gravada', async () => {
    const result = processed('s-antiga');

    await state().addProcessedSource(result);

    expect(state().sessions).toEqual([result.session, RECENTE]);
  });

  it('só atualiza a lista quando a foto é de outra sessão', async () => {
    await state().addProcessedSource(processed('s-antiga'));

    expect(state()).toMatchObject({ currentSessionId: 's-recente', ...contentOf('s-recente') });
  });

  it('relê a sessão quando a carga dela está em andamento', async () => {
    let release;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const result = processed('s-antiga');

    // A carga le o banco antes da gravacao da foto e so termina depois dela.
    sourceRepository.listSourcesBySession.mockImplementationOnce(async () => {
      await blocked;
      return contentOf('s-antiga').sources;
    });
    sourceRepository.listSourcesBySession.mockImplementationOnce(async () => [
      ...contentOf('s-antiga').sources,
      result.source,
    ]);

    const selecting = state().selectSession('s-antiga');
    const adding = state().addProcessedSource(result);

    release();
    await Promise.all([selecting, adding]);

    expect(state().currentSessionId).toBe('s-antiga');
    expect(state().sources).toEqual([...contentOf('s-antiga').sources, result.source]);
  });
});
