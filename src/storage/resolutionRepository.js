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
 * mesmo codigo, e marca a sessao como alterada. Devolve a sessao como ficou
 * depois da gravacao, com o `updatedAt` novo, e a resolucao gravada.
 */
export async function saveResolution(db, resolution) {
  const validated = ResolutionSchema.parse(resolution);

  const session = await db.transaction('rw', db.sessions, db.resolutions, async () => {
    const touched = await touchSession(db, validated.sessionId);

    await db.resolutions.put(validated);

    return touched;
  });

  return { session, resolution: validated };
}

/**
 * Apaga a escolha do produto e marca a sessao como alterada. Devolve a sessao
 * como ficou depois da gravacao.
 */
export async function deleteResolution(db, sessionId, systemCode) {
  const session = await db.transaction('rw', db.sessions, db.resolutions, async () => {
    const touched = await touchSession(db, sessionId);

    await db.resolutions.delete([sessionId, systemCode]);

    return touched;
  });

  return { session };
}
