import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * A biblioteca de interface sai num arquivo proprio. Ela muda de versao muito
 * mais devagar do que o codigo da aplicacao, entao separada ela fica no cache
 * do navegador entre uma publicacao e outra.
 *
 * No servidor de desenvolvimento, o leitor de QR Code e preparado junto com as
 * outras dependencias: descoberto so na primeira foto, ele recarregaria a
 * pagina e apagaria a fila em andamento. O build nao muda.
 */
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['zxing-wasm/reader'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
        },
      },
    },
  },
});
