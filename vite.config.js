import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import { THEME_COLOR_META, appManifest } from './src/pwa/manifest.js';

/**
 * A biblioteca de interface sai num arquivo proprio. Ela muda de versao muito
 * mais devagar do que o codigo da aplicacao, entao separada ela fica no cache
 * do navegador entre uma publicacao e outra.
 *
 * Tres modulos que a biblioteca de PDF so carrega para capturar a tela e para
 * converter SVG ficam fora do build: a aplicacao escreve o PDF a partir de
 * texto e tracos, nunca pede esses caminhos, e sem a exclusao o empacotador
 * geraria tres arquivos que nunca seriam baixados.
 *
 * No servidor de desenvolvimento, o leitor de QR Code e preparado junto com as
 * outras dependencias: descoberto so na primeira foto, ele recarregaria a
 * pagina e apagaria a fila em andamento. O build nao muda.
 */
const UNUSED_PDF_MODULES = ['html2canvas', 'dompurify', 'canvg'];

/**
 * A aplicacao instalada guarda na primeira visita tudo o que o build produz, e
 * nao so a primeira tela: o leitor de QR Code com o binario `.wasm`, o motor de
 * PDF, as quatro faces de texto e os icones. Sem rede, uma foto nova e lida e
 * o PDF sai do mesmo jeito. Nenhum endereco externo entra na lista, porque a
 * aplicacao nao usa nenhum depois de carregada. O maior arquivo, o `.wasm`,
 * fica abaixo do limite padrao de 2 MiB por arquivo.
 *
 * O manifesto e escrito a partir de `src/pwa/manifest.js` e entra na lista
 * pelo proprio plugin; os icones entram pelo varredor de arquivos, entao a
 * inscricao automatica deles fica desligada para nao aparecerem duas vezes.
 *
 * A versao nova nunca assume sozinha: `src/pwa/registerServiceWorker.js` faz
 * o registro e acende o aviso, e a troca espera o toque do operador. No
 * servidor de desenvolvimento nao ha service worker.
 */
const PWA_OPTIONS = {
  registerType: 'prompt',
  injectRegister: null,
  manifest: appManifest,
  manifestFilename: 'manifest.webmanifest',
  includeManifestIcons: false,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
  },
  devOptions: {
    enabled: false,
  },
};

/**
 * A cor da barra do sistema sai da mesma fonte das cores da tela, e por isso
 * nao esta escrita no `index.html`: o build a poe no `<head>`.
 */
const themeColorMeta = {
  name: 'stockvision-theme-color',
  transformIndexHtml: () => [THEME_COLOR_META],
};

export default defineConfig({
  plugins: [react(), VitePWA(PWA_OPTIONS), themeColorMeta],
  optimizeDeps: {
    include: ['zxing-wasm/reader'],
  },
  build: {
    rollupOptions: {
      external: UNUSED_PDF_MODULES,
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
        },
      },
    },
  },
});
