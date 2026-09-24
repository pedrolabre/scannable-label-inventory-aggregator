import { ResolutionSchema } from '../domain/schemas/resolutionSchema.js';

import { touchSession } from './sessionRepository.js';

/**
 * Unico caminho de leitura e escrita da tabela de resolucoes. Cada sessao tem
 * no maximo uma resolucao por `systemCode`, e toda gravacao passa pelo
 * `ResolutionSchema`.
 */

export function listResolutionsBySession(db, sessionId) {
  return db.resolutions.where('sessionId').equals(sessionId).sortBy('systemCode');
}

/**
 * Grava a escolha do operador para um produto, substituindo a anterior do
 * mesmo codigo, e marca a sessao como alterada.
 */
export async function saveResolution(db, resolution) {
  const validated = ResolutionSchema.parse(resolution);

  await db.transaction('rw', db.sessions, db.resolutions, async () => {
    await touchSession(db, validated.sessionId);
    await db.resolutions.put(validated);
  });

  return validated;
}

export function deleteResolution(db, sessionId, systemCode) {
  return db.transaction('rw', db.sessions, db.resolutions, async () => {
    await touchSession(db, sessionId);
    await db.resolutions.delete([sessionId, systemCode]);
  });
}
