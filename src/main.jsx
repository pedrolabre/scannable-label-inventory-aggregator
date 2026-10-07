import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import { registerServiceWorker } from './pwa/registerServiceWorker.js';
import { useSessionStore } from './store/useSessionStore.js';
import './styles/global.css';

// A leitura das sessoes salvas no dispositivo comeca junto com a montagem e
// corre em paralelo: a primeira tela aparece sem esperar o IndexedDB responder.
// A falha fica registrada no store, em `loadError`, para a tela mostrar; aqui
// ela vai para o console de quem desenvolve.
useSessionStore
  .getState()
  .hydrate()
  .catch((error) => {
    console.error('Falha ao abrir as sessões salvas no dispositivo.', error);
  });

// O registro corre fora da arvore de componentes, uma vez por carga da pagina.
// Ele guarda a aplicacao para o uso sem rede e, quando ha versao nova, acende
// o aviso na tela pelo estado de atualizacao, sem recarregar nada sozinho.
registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
