// @vitest-environment node

import { describe, expect, it } from 'vitest';

import tailwindConfig from '../../tailwind.config.js';
import { APP_NAME } from '../lib/app-meta.js';

import {
  APP_DESCRIPTION,
  BACKGROUND_COLOR,
  ICON_BASE_PATH,
  THEME_COLOR,
  THEME_COLOR_META,
  appIcons,
  appManifest,
} from './manifest.js';

/**
 * O arquivo publicado sai deste objeto no build, entao o que se confere aqui e
 * a fonte: os campos que a instalacao le, as cores e os icones. Que o
 * navegador aceita o arquivo gerado e conferido no Chromium, fora da suite.
 */

const { colors } = tailwindConfig.theme.extend;

describe('identidade da aplicação instalada', () => {
  it('usa o nome do produto no nome longo e no curto', () => {
    expect(appManifest.name).toBe(APP_NAME);
    expect(appManifest.short_name).toBe(APP_NAME);
  });

  it('mantém o nome curto dentro dos 12 caracteres das telas de instalação', () => {
    expect(appManifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('descreve a aplicação com a mesma frase do documento, em português com acento', () => {
    expect(appManifest.description).toBe(APP_DESCRIPTION);
    expect(APP_DESCRIPTION).toContain('relatório de inventário');
  });

  it('declara o idioma da interface', () => {
    expect(appManifest.lang).toBe('pt-BR');
  });
});

describe('janela da aplicação', () => {
  it('abre na raiz e limita o alcance a ela', () => {
    expect(appManifest.start_url).toBe('/');
    expect(appManifest.scope).toBe('/');
  });

  it('abre em janela própria, em qualquer orientação', () => {
    expect(appManifest.display).toBe('standalone');
    expect(appManifest.orientation).toBe('any');
  });

  it('leva as cores lidas do tailwind.config.js: vermelho de marca e fundo claro', () => {
    expect(THEME_COLOR).toBe(colors.marca.vermelho);
    expect(BACKGROUND_COLOR).toBe(colors.neutro.papel);
    expect(appManifest.theme_color).toBe(THEME_COLOR);
    expect(appManifest.background_color).toBe(BACKGROUND_COLOR);
  });

  it('entrega ao build a meta theme-color com a mesma cor', () => {
    expect(THEME_COLOR_META).toEqual({
      tag: 'meta',
      attrs: { name: 'theme-color', content: THEME_COLOR },
      injectTo: 'head',
    });
  });
});

describe('ícones oferecidos à instalação', () => {
  it('oferece 192 e 512 para uso comum e um 512 recortável', () => {
    expect(appIcons.map((icon) => [icon.sizes, icon.purpose])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
  });

  it('aponta todos os ícones para PNG da própria aplicação', () => {
    for (const icon of appIcons) {
      expect(icon.type).toBe('image/png');
      expect(icon.src.startsWith(`${ICON_BASE_PATH}/`)).toBe(true);
      expect(icon.src.endsWith('.png')).toBe(true);
    }
  });

  it('leva a mesma lista para o arquivo publicado, sem endereço externo', () => {
    expect(appManifest.icons).toBe(appIcons);
    expect(JSON.stringify(appManifest)).not.toMatch(/https?:/);
  });
});
