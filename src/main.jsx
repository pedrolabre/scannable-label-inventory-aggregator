import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
