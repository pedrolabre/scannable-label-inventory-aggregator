import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Configuracao separada da do empacotador.
 *
 * O ambiente padrao e o de DOM porque a suite monta componentes. Os arquivos
 * que testam so funcao pura declaram `@vitest-environment node` no proprio
 * cabecalho e economizam a montagem do ambiente.
 *
 * O registro do service worker importa um modulo que so o plugin de PWA gera,
 * e o plugin nao roda aqui. O nome desse modulo aponta para um registro falso,
 * que guarda o que recebeu para a suite conferir.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test-fixtures/pwaRegister.js', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
