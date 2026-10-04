// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  XML_DECLARATION,
  cleanXmlText,
  element,
  escapeXmlAttribute,
  escapeXmlText,
  writeXml,
} from './xmlWriter.js';

describe('xmlWriter', () => {
  it('troca por U+FFFD cada caractere que o XML 1.0 não aceita e mantém o resto', () => {
    const controls = Array.from({ length: 32 }, (_, code) => String.fromCharCode(code))
      .filter((char) => !['\t', '\n', '\r'].includes(char))
      .join('');

    expect(cleanXmlText(controls)).toBe('\uFFFD'.repeat(29));
    expect(cleanXmlText('a\uD800b\uDC00c')).toBe('a\uFFFDb\uFFFDc');
    expect(cleanXmlText('\uFFFE\uFFFF')).toBe('\uFFFD\uFFFD');
    expect(cleanXmlText('\t\n\r CAFÉ 😀 \u007F \uFFFD \uE000')).toBe(
      '\t\n\r CAFÉ 😀 \u007F \uFFFD \uE000',
    );
  });

  it('escapa os cinco caracteres e o retorno de carro no texto', () => {
    expect(escapeXmlText(`a & b < c > d " e ' f\r\ng\th`)).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &apos; f&#13;\ng\th',
    );
    expect(escapeXmlText('fim ]]> aqui')).toBe('fim ]]&gt; aqui');
  });

  it('escapa também tabulação, quebra de linha e retorno de carro no atributo', () => {
    expect(escapeXmlAttribute(`"x" & 'y'\t<z>\r\n`)).toBe(
      '&quot;x&quot; &amp; &apos;y&apos;&#9;&lt;z&gt;&#13;&#10;',
    );
    expect(escapeXmlAttribute('a\u0001b')).toBe('a\uFFFDb');
  });

  it('escreve a declaração, dois espaços por nível e LF depois de cada linha', () => {
    const xml = writeXml(
      element(
        'raiz',
        [
          ['versao', '1'],
          ['ausente', null],
          ['indefinido', undefined],
          ['zero', 0],
        ],
        [
          element('vazio'),
          null,
          element('texto', [['a', 'b']], 'x & y'),
          element('em-branco', [], ''),
          element('grupo', [], [element('item', [['n', 1]]), element('item', [['n', 2]])]),
        ],
      ),
    );

    expect(xml).toBe(
      [
        XML_DECLARATION,
        '<raiz versao="1" zero="0">',
        '  <vazio/>',
        '  <texto a="b">x &amp; y</texto>',
        '  <em-branco></em-branco>',
        '  <grupo>',
        '    <item n="1"/>',
        '    <item n="2"/>',
        '  </grupo>',
        '</raiz>',
        '',
      ].join('\n'),
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml.charCodeAt(0)).toBe(0x3c);
    expect(xml).not.toContain('\r');
  });

  it('recusa nome de elemento ou de atributo fora da regra', () => {
    expect(() => element('Raiz')).toThrow(TypeError);
    expect(() => element('a b')).toThrow(TypeError);
    expect(() => element('raiz', [['x"', '1']])).toThrow(TypeError);
  });
});
