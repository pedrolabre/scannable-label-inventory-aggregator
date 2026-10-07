// @vitest-environment node

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { APP_NAME } from '../lib/app-meta.js';

import { APP_DESCRIPTION, ICON_BASE_PATH } from './manifest.js';

/**
 * O `index.html` e estatico e nao importa modulo: o titulo, a descricao, os
 * icones e o nome na tela inicial estao escritos nele. Este arquivo o le como
 * texto e confere que continuam iguais ao que a aplicacao usa, e que a cor da
 * barra do sistema nao esta escrita ali (o build a poe a partir do config).
 */

const documento = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

function unico(padrao) {
  const encontrados = [...documento.matchAll(padrao)];

  expect(encontrados).toHaveLength(1);

  return encontrados[0][1];
}

function meta(name) {
  return unico(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'g'));
}

describe('identidade no index.html', () => {
  it('usa o nome do produto no título', () => {
    expect(unico(/<title>([^<]*)<\/title>/g)).toBe(APP_NAME);
  });

  it('descreve a aplicação com a frase do manifesto', () => {
    expect(meta('description')).toBe(APP_DESCRIPTION);
  });

  it('abre em tela cheia quando adicionada à tela inicial, com o nome do produto', () => {
    expect(meta('mobile-web-app-capable')).toBe('yes');
    expect(meta('apple-mobile-web-app-capable')).toBe('yes');
    expect(meta('apple-mobile-web-app-title')).toBe(APP_NAME);
  });
});

describe('ícones no index.html', () => {
  it('usa o SVG como ícone da aba', () => {
    expect(unico(/<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="([^"]*)"/g)).toBe(
      `${ICON_BASE_PATH}/icon.svg`,
    );
  });

  it('oferece o PNG de 180 px à tela inicial do iPhone', () => {
    expect(unico(/<link\s+rel="apple-touch-icon"\s+href="([^"]*)"/g)).toBe(
      `${ICON_BASE_PATH}/apple-touch-icon-180.png`,
    );
  });
});

describe('o que o build acrescenta', () => {
  it('não escreve a cor da barra nem o vínculo do manifesto à mão', () => {
    expect(documento).not.toMatch(/theme-color/);
    expect(documento).not.toMatch(/rel="manifest"/);
  });

  it('não leva cor literal nem endereço externo', () => {
    expect(documento).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(documento).not.toMatch(/https?:/);
  });
});
