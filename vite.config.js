import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig({
  plugins: [react()],
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
