import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * A biblioteca de interface sai num arquivo proprio. Ela muda de versao muito
 * mais devagar do que o codigo da aplicacao, entao separada ela fica no cache
 * do navegador entre uma publicacao e outra.
 */
export default defineConfig({
  plugins: [react()],
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
