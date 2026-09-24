import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Configuracao separada da do empacotador.
 *
 * O ambiente padrao e o de DOM porque a suite monta componentes. Os arquivos
 * que testam so funcao pura declaram `@vitest-environment node` no proprio
 * cabecalho e economizam a montagem do ambiente.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
