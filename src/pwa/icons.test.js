// @vitest-environment node

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  ICON_COLORS,
  ICON_FILES,
  SVG_ICON,
  iconShapes,
  rasterizeIcon,
  renderIconFiles,
} from '../../scripts/generate-icons.mjs';
import tailwindConfig from '../../tailwind.config.js';

import { appIcons } from './manifest.js';

/**
 * Os icones de `public/icons/` sao gerados por `npm run icons`. Esta suite
 * confere que os arquivos publicados sao o desenho do script: o SVG texto a
 * texto e cada PNG pixel a pixel, lido de volta pelo proprio formato, so com
 * os trechos de cabecalho, imagem e fim, como o script escreve. Um arquivo
 * regravado por outro programa com metadados acrescentados nao passa.
 */

const { colors } = tailwindConfig.theme.extend;

function published(file) {
  return readFileSync(new URL(`../../public/icons/${file}`, import.meta.url));
}

function decodePng(bytes) {
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  let offset = 8;
  let header = null;
  const data = [];
  const chunks = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);

    chunks.push(type);

    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === 'IDAT') {
      data.push(body);
    }

    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(data));
  const rowLength = header.width * 3;
  const pixels = Buffer.alloc(rowLength * header.height);

  for (let y = 0; y < header.height; y += 1) {
    expect(raw[y * (rowLength + 1)]).toBe(0);
    raw.copy(pixels, y * rowLength, y * (rowLength + 1) + 1, (y + 1) * (rowLength + 1));
  }

  return { header, pixels, chunks };
}

describe('desenho dos ícones', () => {
  it('usa só as duas cores do tailwind.config.js', () => {
    expect(ICON_COLORS).toEqual({
      background: colors.marca.vermelho,
      drawing: colors.neutro.branco,
    });
  });

  it('cabe inteiro no círculo central no ícone recortável', () => {
    const limit = 512 * 0.4;

    for (const [x0, y0, x1, y1] of iconShapes(1)) {
      for (const [x, y] of [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ]) {
        expect(Math.hypot(x - 256, y - 256)).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('desenha o mesmo resultado a cada chamada', () => {
    expect(renderIconFiles()).toEqual(renderIconFiles());
  });
});

describe('arquivos publicados', () => {
  it.each(ICON_FILES.map((icon) => [icon.file, icon]))(
    '%s tem o tamanho, os pixels e os trechos do desenho',
    (file, { size, scale }) => {
      const { header, pixels, chunks } = decodePng(published(file));

      expect(header).toEqual({ width: size, height: size, depth: 8, colorType: 2, interlace: 0 });
      expect(pixels.equals(rasterizeIcon(size, scale))).toBe(true);
      expect(chunks).toEqual(['IHDR', 'IDAT', 'IEND']);
    },
  );

  it('icon.svg é o texto que o script escreve', () => {
    expect(published(SVG_ICON.file).toString('utf8')).toBe(
      renderIconFiles().get(SVG_ICON.file).toString('utf8'),
    );
  });

  it('cada ícone do manifesto existe com o tamanho declarado', () => {
    for (const icon of appIcons) {
      const file = icon.src.split('/').pop();
      const { header } = decodePng(published(file));

      expect(`${header.width}x${header.height}`).toBe(icon.sizes);
    }
  });
});
