import { ReadingSchema } from '../domain/schemas/readingSchema.js';

import { touchSession } from './sessionRepository.js';
import { STORAGE_RULE_ERRORS, createStorageRuleError } from './storageError.js';

/**
 * Unico caminho de leitura e escrita da tabela de leituras. Cada leitura guarda
 * o texto bruto do simbolo e a posicao dele na foto; os campos LF1 sao
 * derivados do texto por quem le, e nunca gravados.
 */

/** Leituras da sessao na ordem em que foram gravadas. */
export function listReadingsBySession(db, sessionId) {
  return db.readings.where('sessionId').equals(sessionId).sortBy('readAt');
}

/**
 * Grava as leituras de uma foto. Recebe `[{ text, position? }]`; identificador,
 * sessao, fonte e data sao preenchidos aqui.
 *
 * Todas as leituras sao validadas antes de a transacao abrir: uma leitura fora
 * do contrato impede o conjunto inteiro. Dentro da transacao, a fonte precisa
 * existir e pertencer a sessao, e o conjunto entra de uma vez.
 */
export async function createReadings(db, sessionId, sourceId, readings) {
  const readAt = new Date().toISOString();
  const validated = readings.map((reading) =>
    ReadingSchema.parse({ ...reading, id: crypto.randomUUID(), sessionId, sourceId, readAt }),
  );

  await db.transaction('rw', db.sessions, db.sources, db.readings, async () => {
    const source = await db.sources.get(sourceId);

    if (!source || source.sessionId !== sessionId) {
      throw createStorageRuleError(STORAGE_RULE_ERRORS.MISSING_SOURCE);
    }

    await touchSession(db, sessionId, readAt);

    if (validated.length > 0) {
      await db.readings.bulkAdd(validated);
    }
  });

  return validated;
}
