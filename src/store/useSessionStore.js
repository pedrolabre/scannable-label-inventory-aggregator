import { create } from 'zustand';

import { defaultSessionName } from '../domain/schemas/sessionSchema.js';
import { getAppDatabase } from '../storage/indexed-db.js';
import { readLastSessionId, writeLastSessionId } from '../storage/lastSessionStorage.js';
import { listReadingsBySession } from '../storage/readingRepository.js';
import {
  deleteResolution,
  listResolutionsBySession,
  saveResolution,
} from '../storage/resolutionRepository.js';
import {
  createSession as createStoredSession,
  deleteSession as deleteStoredSession,
  listSessions,
  renameSession as renameStoredSession,
} from '../storage/sessionRepository.js';
import { deleteSource, listSourcesBySession } from '../storage/sourceRepository.js';
import {
  STORAGE_RULE_ERRORS,
  createStorageRuleError,
  describeStorageReadError,
} from '../storage/storageError.js';

import {
  assertChoiceAvailable,
  assertOpenSession,
  choicesWith,
  choicesWithout,
  removeResolution,
  upsertResolution,
} from './resolutionChoices.js';
import { withoutSource } from './sourceRemoval.js';

/**
 * Sessoes gravadas no dispositivo e o conteudo da sessao aberta: fontes,
 * leituras e resolucoes, sempre lidos do banco. O relatorio e derivado desse
 * estado por quem o exibe, e nao mora aqui.
 *
 * `sessions` fica da mais recente para a mais antiga. Na abertura da aplicacao
 * abre a ultima sessao aberta neste navegador, ou a primeira da lista quando
 * ela nao existe mais. Sem nenhuma sessao gravada, uma nova e criada com o
 * nome do dia.
 */

const EMPTY_CONTENT = Object.freeze({ sources: [], readings: [], resolutions: [] });

const byMostRecent = (a, b) => b.updatedAt.localeCompare(a.updatedAt);

// Hidratacao em andamento. Chamadas concorrentes reaproveitam a mesma promessa.
let pendingHydration = null;

// Cada carga de conteudo recebe um numero. So a mais recente escreve no estado:
// trocar de sessao duas vezes seguidas nunca mostra o conteudo da primeira.
let latestLoad = 0;

// Sessao da carga mais recente enquanto ela nao termina.
let loadingSessionId = null;

async function readContent(db, sessionId) {
  const [sources, readings, resolutions] = await Promise.all([
    listSourcesBySession(db, sessionId),
    listReadingsBySession(db, sessionId),
    listResolutionsBySession(db, sessionId),
  ]);

  return { sources, readings, resolutions };
}

/**
 * Quando uma escrita falha, a lista em memoria pode ter ficado velha em relacao
 * ao banco (outra aba grava no mesmo IndexedDB). O estado e relido antes de o
 * erro subir; a releitura falhando registra o proprio motivo em `loadError` e
 * nao troca o erro que o chamador precisa ver.
 */
async function writeAndReconcileOnFailure(write, reload) {
  try {
    return await write();
  } catch (error) {
    await reload().catch(() => {});

    throw error;
  }
}

export const useSessionStore = create((set, get) => {
  const db = () => getAppDatabase();

  async function openSession(sessionId, extra = {}) {
    latestLoad += 1;
    const load = latestLoad;

    loadingSessionId = sessionId;
    set({ isLoading: true, loadError: null });

    try {
      const content = await readContent(db(), sessionId);

      if (load === latestLoad) {
        set({ ...extra, currentSessionId: sessionId, ...content, isLoading: false });
        writeLastSessionId(sessionId);
      }

      return content;
    } catch (error) {
      if (load === latestLoad) {
        set({ isLoading: false, loadError: describeStorageReadError(error) });
      }

      throw error;
    } finally {
      if (load === latestLoad) {
        loadingSessionId = null;
      }
    }
  }

  async function createAndOpen(name) {
    const stored = await createStoredSession(db(), { name });

    writeLastSessionId(stored.id);

    latestLoad += 1;
    loadingSessionId = null;
    set({
      sessions: [stored, ...get().sessions.filter((session) => session.id !== stored.id)],
      currentSessionId: stored.id,
      ...EMPTY_CONTENT,
      isLoading: false,
      loadError: null,
    });

    return stored;
  }

  /**
   * Reflete uma gravacao no conteudo de uma sessao, com a sessao como ficou
   * depois dela: a data nova reordena a lista, e o conteudo da sessao aberta
   * muda sem reler o banco (`updateContent` recebe o estado e devolve o que
   * troca). Se a mesma sessao esta sendo carregada, ela e relida, como na foto
   * recem-gravada.
   */
  function reflectSessionWrite(session, updateContent) {
    set({
      sessions: get()
        .sessions.map((item) => (item.id === session.id ? session : item))
        .sort(byMostRecent),
    });

    if (session.id === loadingSessionId) {
      return openSession(session.id).then(
        () => {},
        () => {},
      );
    }

    if (session.id === get().currentSessionId) {
      set(updateContent(get()));
    }

    return Promise.resolve();
  }

  /** Grava as escolhas do produto, ou apaga o registro quando nao sobra nenhuma. */
  async function storeChoices(sessionId, systemCode, choices) {
    if (Object.keys(choices).length === 0) {
      const { session } = await writeAndReconcileOnFailure(
        () => deleteResolution(db(), sessionId, systemCode),
        get().hydrate,
      );

      await reflectSessionWrite(session, (state) => ({
        resolutions: removeResolution(state.resolutions, systemCode),
      }));

      return null;
    }

    const stored = await writeAndReconcileOnFailure(
      () => saveResolution(db(), { sessionId, systemCode, choices }),
      get().hydrate,
    );

    await reflectSessionWrite(stored.session, (state) => ({
      resolutions: upsertResolution(state.resolutions, stored.resolution),
    }));

    return stored.resolution;
  }

  async function loadSessions() {
    set({ isLoading: true, loadError: null });

    let sessions;

    try {
      sessions = await listSessions(db());
    } catch (error) {
      set({ isLoading: false, loadError: describeStorageReadError(error) });
      throw error;
    }

    if (sessions.length === 0) {
      set({ sessions: [] });
      await createAndOpen(defaultSessionName(new Date()));
      return;
    }

    const current = get().currentSessionId ?? readLastSessionId();
    const target = sessions.some((session) => session.id === current) ? current : sessions[0].id;

    await openSession(target, { sessions });
  }

  return {
    sessions: [],
    currentSessionId: null,
    ...EMPTY_CONTENT,
    isLoading: false,
    loadError: null,

    /**
     * Le as sessoes e abre a atual; sem sessao aberta, a ultima aberta neste
     * navegador, ou a mais recente. Roda na abertura da aplicacao e depois de
     * uma escrita que falhou.
     */
    hydrate: () => {
      if (pendingHydration) {
        return pendingHydration;
      }

      pendingHydration = loadSessions()
        .catch((error) => {
          if (!get().loadError) {
            set({ isLoading: false, loadError: describeStorageReadError(error) });
          }

          throw error;
        })
        .finally(() => {
          pendingHydration = null;
        });

      return pendingHydration;
    },

    selectSession: async (sessionId) => {
      if (!get().sessions.some((session) => session.id === sessionId)) {
        throw createStorageRuleError(STORAGE_RULE_ERRORS.MISSING_SESSION);
      }

      await openSession(sessionId);
    },

    /** Cria a sessao, com o nome do dia quando nenhum nome vem, e a abre. */
    createSession: (name = defaultSessionName(new Date())) => createAndOpen(name),

    renameSession: async (sessionId, name) => {
      const stored = await writeAndReconcileOnFailure(
        () => renameStoredSession(db(), sessionId, name),
        get().hydrate,
      );

      set({
        sessions: get()
          .sessions.map((session) => (session.id === stored.id ? stored : session))
          .sort(byMostRecent),
      });

      return stored;
    },

    /**
     * Apaga a sessao e tudo o que pertence a ela. Quando ela era a aberta, abre
     * a mais recente das que sobraram, ou cria uma nova se nao sobrou nenhuma.
     */
    deleteSession: async (sessionId) => {
      await writeAndReconcileOnFailure(() => deleteStoredSession(db(), sessionId), get().hydrate);

      const sessions = get().sessions.filter((session) => session.id !== sessionId);

      if (get().currentSessionId !== sessionId) {
        set({ sessions });
        return;
      }

      set({ sessions, currentSessionId: null, ...EMPTY_CONTENT });

      if (sessions.length === 0) {
        await createAndOpen(defaultSessionName(new Date()));
        return;
      }

      await openSession(sessions[0].id);
    },

    /**
     * Reflete a foto que acabou de ser gravada, com a sessao como ficou depois
     * da gravacao: a data nova reordena a lista, e a fonte e as leituras entram
     * no fim do conteudo quando a sessao e a aberta, sem reler o banco.
     *
     * Se a mesma sessao esta sendo carregada, a carga pode ter lido o banco
     * antes da gravacao; entao a sessao e relida, e a carga mais recente vence.
     */
    addProcessedSource: ({ session, source, readings = [] }) => {
      if (session && get().sessions.some((item) => item.id === session.id)) {
        set({
          sessions: get()
            .sessions.map((item) => (item.id === session.id ? session : item))
            .sort(byMostRecent),
        });
      }

      if (source.sessionId === loadingSessionId) {
        return openSession(source.sessionId).then(
          () => {},
          () => {},
        );
      }

      if (source.sessionId !== get().currentSessionId) {
        return Promise.resolve();
      }

      const known = new Set(get().readings.map((reading) => reading.id));

      set({
        sources: [...get().sources.filter((item) => item.id !== source.id), source],
        readings: [...get().readings, ...readings.filter((reading) => !known.has(reading.id))],
      });

      return Promise.resolve();
    },

    /**
     * Apaga uma foto da sessao com as leituras dela. A data nova da sessao
     * reordena a lista, e a foto e as leituras saem do conteudo da sessao
     * aberta sem reler o banco; o relatorio, derivado dele, se refaz na hora.
     */
    removeSource: async (sessionId, sourceId) => {
      const { session } = await writeAndReconcileOnFailure(
        () => deleteSource(db(), sessionId, sourceId),
        get().hydrate,
      );

      await reflectSessionWrite(session, (state) => withoutSource(state, sourceId));
    },

    /**
     * Grava a escolha do operador para um campo de um produto da sessao aberta,
     * somada as escolhas ja gravadas do mesmo produto. O campo precisa divergir
     * nas leituras da sessao, e o valor precisa ser uma das variantes; `null`
     * em `ean` ou `ncm` escolhe a variante sem o campo. Devolve a resolucao
     * gravada.
     */
    resolveConflict: async (sessionId, systemCode, field, value) => {
      assertOpenSession(get().currentSessionId, sessionId);
      assertChoiceAvailable(get().readings, systemCode, field, value);

      return storeChoices(
        sessionId,
        systemCode,
        choicesWith(get().resolutions, systemCode, field, value),
      );
    },

    /**
     * Retira a escolha de um campo do produto na sessao aberta, mesmo quando o
     * conflito nao existe mais. Devolve a resolucao que sobrou, ou `null`; campo
     * sem escolha gravada nao grava nada.
     */
    clearResolution: async (sessionId, systemCode, field) => {
      assertOpenSession(get().currentSessionId, sessionId);

      const remaining = choicesWithout(get().resolutions, systemCode, field);

      return remaining === undefined ? null : storeChoices(sessionId, systemCode, remaining);
    },
  };
});
