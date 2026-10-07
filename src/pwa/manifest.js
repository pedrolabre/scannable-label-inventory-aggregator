import tailwindConfig from '../../tailwind.config.js';
import { APP_NAME } from '../lib/app-meta.js';

/**
 * Dados da aplicacao instalada, sem efeito nenhum.
 *
 * O empacotador escreve o `manifest.webmanifest` a partir de `appManifest` e
 * poe o vinculo no documento; nao ha copia em `public/` que possa divergir
 * desta. A descricao e a mesma do `<head>` do `index.html`, que e estatico e
 * nao importa modulo, e `documentMeta.test.js` confere que as duas continuam
 * iguais.
 *
 * As cores vem do `tailwind.config.js`, como as da tela: a barra do sistema
 * leva o vermelho de marca e a abertura do aplicativo leva o fundo claro das
 * colunas. O mesmo vermelho vai para o `theme-color` do documento, posto pelo
 * empacotador a partir de `THEME_COLOR_META`.
 *
 * Este modulo e lido pela configuracao do empacotador e pela suite; nenhum
 * arquivo da aplicacao o importa.
 */

const { colors } = tailwindConfig.theme.extend;

export const APP_DESCRIPTION =
  'Leitura de etiquetas com QR Code e relatório de inventário a partir de fotos, inteiramente no navegador.';

export const THEME_COLOR = colors.marca.vermelho;

export const BACKGROUND_COLOR = colors.neutro.papel;

export const ICON_BASE_PATH = '/icons';

export const appIcons = Object.freeze([
  Object.freeze({
    src: `${ICON_BASE_PATH}/icon-192.png`,
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any',
  }),
  Object.freeze({
    src: `${ICON_BASE_PATH}/icon-512.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any',
  }),
  Object.freeze({
    src: `${ICON_BASE_PATH}/icon-maskable-512.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  }),
]);

export const appManifest = Object.freeze({
  name: APP_NAME,
  short_name: APP_NAME,
  description: APP_DESCRIPTION,
  lang: 'pt-BR',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  theme_color: THEME_COLOR,
  background_color: BACKGROUND_COLOR,
  icons: appIcons,
});

/** Elemento `<meta name="theme-color">` no formato que o empacotador injeta no `<head>`. */
export const THEME_COLOR_META = Object.freeze({
  tag: 'meta',
  attrs: Object.freeze({ name: 'theme-color', content: THEME_COLOR }),
  injectTo: 'head',
});
