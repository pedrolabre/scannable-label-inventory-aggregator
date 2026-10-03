/**
 * Identificador da ultima sessao aberta neste navegador, para a abertura da
 * aplicacao voltar a ela, e nao a alterada por ultimo.
 *
 * Fica no `localStorage`, e nao no IndexedDB: e uma preferencia do aparelho,
 * nao conteudo de sessao, e nao muda o esquema do banco. O armazenamento pode
 * nao existir ou recusar a leitura e a escrita (janela privada, cota, dados do
 * site apagados); nesse caso a leitura devolve `null` e a escrita nao faz
 * nada, e a abertura cai na sessao alterada por ultimo.
 */

export const LAST_SESSION_KEY = 'stockvision:ultima-sessao';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readLastSessionId(storage = defaultStorage()) {
  try {
    const value = storage?.getItem(LAST_SESSION_KEY) ?? null;

    return value === '' ? null : value;
  } catch {
    return null;
  }
}

export function writeLastSessionId(sessionId, storage = defaultStorage()) {
  try {
    storage?.setItem(LAST_SESSION_KEY, sessionId);
  } catch {
    // Sem onde guardar, a proxima abertura usa a sessao alterada por ultimo.
  }
}
