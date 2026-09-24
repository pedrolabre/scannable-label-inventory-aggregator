import Dexie from 'dexie';

export const DATABASE_NAME = 'StockVisionDB';

/**
 * Banco local da aplicacao. A primeira chave de cada tabela e a chave primaria;
 * as demais sao indices secundarios.
 *
 * - `sessions`: `updatedAt` ordena as sessoes da mais recente para a mais
 *   antiga.
 * - `sources`: `sessionId` lista as fotos de uma sessao, e o indice unico
 *   `[sessionId+sha256]` impede a mesma foto duas vezes na mesma sessao. Em
 *   sessoes diferentes a mesma foto e aceita.
 * - `readings`: `sessionId` e `sourceId` listam e apagam as leituras de uma
 *   sessao ou de uma foto; `text` agrupa as leituras do mesmo exemplar.
 * - `resolutions`: a chave `[sessionId+systemCode]` guarda uma escolha por
 *   produto em cada sessao.
 *
 * O nome entra por parametro para que cada teste abra um banco isolado.
 */
export class StockVisionDatabase extends Dexie {
  constructor(name = DATABASE_NAME) {
    super(name);

    this.version(1).stores({
      sessions: 'id, updatedAt',
      sources: 'id, sessionId, &[sessionId+sha256]',
      readings: 'id, sessionId, sourceId, text',
      resolutions: '[sessionId+systemCode], sessionId',
    });
  }
}

let appDatabase = null;

/**
 * Banco usado pela aplicacao, criado na primeira chamada. O Dexie so abre a
 * conexao na primeira leitura ou escrita, entao criar a instancia nao toca o
 * IndexedDB.
 */
export function getAppDatabase() {
  if (appDatabase === null) {
    appDatabase = new StockVisionDatabase();
  }

  return appDatabase;
}
