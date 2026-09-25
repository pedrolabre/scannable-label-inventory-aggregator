import { SourceSchema } from '../domain/schemas/sourceSchema.js';

import { createReadings } from './readingRepository.js';
import { touchSession } from './sessionRepository.js';
import { STORAGE_RULE_ERRORS, createStorageRuleError, hasErrorName } from './storageError.js';

/**
 * Unico caminho de leitura e escrita da tabela de fontes. Uma fonte e o
 * registro de uma foto processada: so metadados, nunca os bytes da imagem, e
 * toda gravacao passa pelo `SourceSchema`.
 */

/** Fontes da sessao na ordem em que foram processadas. */
export function listSourcesBySession(db, sessionId) {
  return db.sources.where('sessionId').equals(sessionId).sortBy('processedAt');
}

/**
 * Fonte da sessao com este SHA-256, ou `undefined`. Pelo indice unico
 * `[sessionId+sha256]`, e a mesma foto ja gravada nesta sessao.
 */
export function findSourceBySha256(db, sessionId, sha256) {
  return db.sources.where('[sessionId+sha256]').equals([sessionId, sha256]).first();
}

/**
 * Grava a fonte na sessao e marca a sessao como alterada, na mesma transacao.
 * Recebe os metadados da foto e o resultado do processamento; o identificador,
 * a sessao e a data do processamento sao preenchidos aqui.
 *
 * O identificador e sempre novo, entao a unica chave repetida possivel e a do
 * indice `[sessionId+sha256]`: a mesma foto ja gravada nesta sessao.
 */
export async function createSource(db, sessionId, source) {
  const processedAt = new Date().toISOString();
  const validated = SourceSchema.parse({
    ...source,
    id: crypto.randomUUID(),
    sessionId,
    processedAt,
  });

  try {
    await db.transaction('rw', db.sessions, db.sources, async () => {
      await touchSession(db, sessionId, processedAt);
      await db.sources.add(validated);
    });
  } catch (error) {
    if (hasErrorName(error, 'ConstraintError')) {
      throw createStorageRuleError(STORAGE_RULE_ERRORS.DUPLICATE_SOURCE);
    }

    throw error;
  }

  return validated;
}

/**
 * Grava a fonte de uma foto e as leituras dela numa transacao so, com as mesmas
 * regras de `createSource` e `createReadings`: ou a foto entra inteira, ou nada
 * entra. Uma aba fechada no meio nunca deixa fonte sem as leituras.
 *
 * Devolve a sessao como ficou depois da gravacao, com o `updatedAt` novo, a
 * fonte e as leituras gravadas.
 */
export function createSourceWithReadings(db, sessionId, source, readings) {
  return db.transaction('rw', db.sessions, db.sources, db.readings, async () => {
    const storedSource = await createSource(db, sessionId, source);
    const storedReadings = await createReadings(db, sessionId, storedSource.id, readings);
    const session = await db.sessions.get(sessionId);

    return { session, source: storedSource, readings: storedReadings };
  });
}

/**
 * Apaga a fonte com as leituras dela e marca a sessao como alterada, numa
 * transacao so.
 */
export function deleteSource(db, sessionId, sourceId) {
  return db.transaction('rw', db.sessions, db.sources, db.readings, async () => {
    const source = await db.sources.get(sourceId);

    if (!source || source.sessionId !== sessionId) {
      throw createStorageRuleError(STORAGE_RULE_ERRORS.MISSING_SOURCE);
    }

    await touchSession(db, sessionId);
    await db.readings.where('sourceId').equals(sourceId).delete();
    await db.sources.delete(sourceId);
  });
}
