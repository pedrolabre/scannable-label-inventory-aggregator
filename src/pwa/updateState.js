/**
 * Versao nova da aplicacao instalada, guardada fora do React.
 *
 * Quem descobre a versao nova e o registro do service worker, que roda no ponto
 * de entrada, antes de qualquer componente. Este modulo liga os dois lados:
 * guarda se ha versao esperando e a acao que a aplica, e avisa quem assinou.
 * Nao conhece React nem o DOM, e o aviso na tela le daqui com
 * `useSyncExternalStore`.
 *
 * Nada aqui recarrega a pagina. A troca so acontece quando a tela chama
 * `applyPendingUpdate`, e a tela so chama quando o operador pede.
 */

let pendingApply = null;

const listeners = new Set();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Assina as mudancas. Devolve a funcao que cancela a assinatura. */
export function subscribeToUpdate(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** `true` enquanto ha versao nova esperando o operador. */
export function getUpdateSnapshot() {
  return pendingApply !== null;
}

/**
 * Registra a versao nova e a acao que a aplica. Um anuncio seguinte troca a
 * acao guardada: vale sempre a descoberta mais recente.
 */
export function announceUpdate(apply) {
  if (typeof apply !== 'function') {
    throw new TypeError('A versão nova precisa da ação que a aplica.');
  }

  pendingApply = apply;
  notify();
}

/**
 * Aplica a versao esperando, uma vez. Devolve `false` quando nao ha nenhuma,
 * para a tela nao prometer uma troca que nao vai acontecer.
 */
export function applyPendingUpdate() {
  if (pendingApply === null) {
    return false;
  }

  const apply = pendingApply;

  pendingApply = null;
  notify();
  apply();

  return true;
}

/** Volta ao estado inicial, sem versao esperando. Usado pela suite. */
export function resetUpdateState() {
  pendingApply = null;
  notify();
}
