/**
 * Registro do service worker, o unico arquivo do codigo-fonte que nomeia o
 * modulo gerado pelo empacotador.
 *
 * No build, o registro guarda a aplicacao inteira para o uso sem rede e, a
 * cada abertura, o navegador confere se ha `sw.js` novo no proprio endereco.
 * No servidor de desenvolvimento o modulo gerado nao registra nada, e na suite
 * ele e trocado por um registro falso (`src/test-fixtures/pwaRegister.js`).
 *
 * A versao nova nao assume sozinha: ela acende o aviso pelo `updateState.js`,
 * e so o toque do operador em `Atualizar` a ativa e recarrega a pagina. A fila
 * de fotos vive so na memoria da pagina, e uma troca automatica a apagaria.
 * Ficar pronto para o uso sem rede nao gera aviso.
 */

import { registerSW } from 'virtual:pwa-register';

import { announceUpdate } from './updateState.js';

export function registerServiceWorker() {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      announceUpdate(() => updateServiceWorker(true));
    },
  });

  return updateServiceWorker;
}
