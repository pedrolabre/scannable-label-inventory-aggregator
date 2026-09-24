import { create } from 'zustand';

import { defaultSessionName } from '../domain/schemas/sessionSchema.js';
import { getAppDatabase } from '../storage/indexed-db.js';
import { listReadingsBySession } from '../storage/readingRepository.js';
import { listResolutionsBySession } from '../storage/resolutionRepository.js';
import {
  createSession as createStoredSession,
  deleteSession as deleteStoredSession,
  listSessions,
  renameSession as renameStoredSession,
} from '../storage/sessionRepository.js';
import { listSourcesBySession } from '../storage/sourceRepository.js';
import {
  STORAGE_RULE_ERRORS,
  createStorageRuleError,
  describeStorageReadError,
} from '../storage/storageError.js';

/**
 * Sessoes gravadas no dispositivo e o conteudo da sessao aberta: fontes,
 * leituras e resolucoes, sempre lidos do banco. O relatorio e derivado desse
 * estado por quem o exibe, e nao mora aqui.
 *
 * `sessions` fica da mais recente para a mais antiga, e a sessao aberta na
 * abertura da aplicacao e a primeira da lista. Sem nenhuma sessao gravada, uma
 * nova e criada com o nome do dia.
 */

const EMPTY_CONTENT = Object.freeze({ sources: [], readings: [], resolutions: [] });

const byMostRecent = (a, b) => b.updatedAt.localeCompare(a.updatedAt);

// Hidratacao em andamento. Chamadas concorrentes reaproveitam a mesma promessa.
let pendingHydration = null;

// Cada carga de conteudo recebe um numero. So a mais recente escreve no estado:
// trocar de sessao duas vezes seguidas nunca mostra o conteudo da primeira.
let latestLoad = 0;

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

    set({ isLoading: true, loadError: null });

    try {
      const content = await readContent(db(), sessionId);

      if (load === latestLoad) {
        set({ ...extra, currentSessionId: sessionId, ...content, isLoading: false });
      }

      return content;
    } catch (error) {
      if (load === latestLoad) {
        set({ isLoading: false, loadError: describeStorageReadError(error) });
      }

      throw error;
    }
  }

  async function createAndOpen(name) {
    const stored = await createStoredSession(db(), { name });

    latestLoad += 1;
    set({
      sessions: [stored, ...get().sessions.filter((session) => session.id !== stored.id)],
      currentSessionId: stored.id,
      ...EMPTY_CONTENT,
      isLoading: false,
      loadError: null,
    });

    return stored;
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

    const current = get().currentSessionId;
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
     * Le as sessoes e abre a atual, ou a mais recente quando nenhuma esta
     * aberta. Roda na abertura da aplicacao e depois de uma escrita que falhou.
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
  };
});
