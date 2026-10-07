/**
 * Registro falso no lugar do modulo que o empacotador gera para o service
 * worker. O `vitest.config.js` aponta o nome do modulo para este arquivo, e a
 * suite le aqui o que o registro recebeu e quantas vezes a troca foi pedida.
 */

export const registrations = [];

export const updateRequests = [];

export function registerSW(options = {}) {
  registrations.push(options);

  return (reloadPage) => {
    updateRequests.push(reloadPage);

    return Promise.resolve();
  };
}

/** Esquece os registros anteriores. */
export function resetPwaRegister() {
  registrations.length = 0;
  updateRequests.length = 0;
}
