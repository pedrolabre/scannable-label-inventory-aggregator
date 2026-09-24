import { SessionSchema } from '../domain/schemas/sessionSchema.js';

import { STORAGE_RULE_ERRORS, createStorageRuleError } from './storageError.js';

/**
 * Unico caminho de leitura e escrita da tabela de sessoes. Toda gravacao passa
 * pelo `SessionSchema`, e o registro que chega ao banco e o resultado do parse,
 * com o nome ja aparado.
 *
 * Cada funcao recebe o banco como primeiro argumento: a aplicacao passa o banco
 * dela, e cada teste passa um banco proprio.
 */

const now = () => new Date().toISOString();

/** Sessoes da mais recente para a mais antiga, pelo `updatedAt`. */
export function listSessions(db) {
  return db.sessions.orderBy('updatedAt').reverse().toArray();
}

export async function createSession(db, { name }) {
  const timestamp = now();
  const validated = SessionSchema.parse({
    id: crypto.randomUUID(),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.sessions.add(validated);

  return validated;
}

async function requireSession(db, id) {
  const session = await db.sessions.get(id);

  if (!session) {
    throw createStorageRuleError(STORAGE_RULE_ERRORS.MISSING_SESSION);
  }

  return session;
}

/**
 * Marca a sessao como alterada agora. Roda dentro da transacao de quem grava o
 * conteudo da sessao, que precisa incluir a tabela `sessions`: se a sessao nao
 * existe mais, a gravacao inteira e desfeita.
 */
export async function touchSession(db, id, timestamp = now()) {
  const session = await requireSession(db, id);
  const validated = SessionSchema.parse({ ...session, updatedAt: timestamp });

  await db.sessions.put(validated);

  return validated;
}

export function renameSession(db, id, name) {
  return db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(db, id);
    const validated = SessionSchema.parse({ ...session, name, updatedAt: now() });

    await db.sessions.put(validated);

    return validated;
  });
}

/**
 * Apaga a sessao com as fontes, as leituras e as resolucoes dela numa
 * transacao so: ou tudo sai, ou nada sai.
 */
export function deleteSession(db, id) {
  return db.transaction('rw', [db.sessions, db.sources, db.readings, db.resolutions], async () => {
    await requireSession(db, id);
    await db.readings.where('sessionId').equals(id).delete();
    await db.sources.where('sessionId').equals(id).delete();
    await db.resolutions.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}
