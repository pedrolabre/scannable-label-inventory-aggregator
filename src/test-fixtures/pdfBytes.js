/**
 * Leitura dos bytes de um PDF ja gerado, para os testes.
 *
 * O que o adaptador promete (paginas A4, texto com acento, data de criacao,
 * identificador e propriedades do documento) so se confere no arquivo que sai,
 * e nao na descricao que o originou. Conferir o arquivo pede descomprimir os
 * fluxos de conteudo, ler as cadeias de texto com os escapes do formato e
 * traduzir os bytes da codificacao WinAnsi de volta para texto. Isso e um
 * leitor de formato: mora aqui, ao lado das outras pecas de teste.
 *
 * Nenhum modulo da aplicacao importa este arquivo, e o empacotador nao o
 * alcanca. As funcoes sao puras e nao conhecem relatorio nem produto.
 */

import { inflateSync } from 'node:zlib';

/** Bytes 0x80 a 0x9F do WinAnsi, pelo codigo do caractere que representam. */
const WINANSI_HIGH = Object.freeze({
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
});

/** O arquivo lido como texto de um byte por caractere, sem reinterpretar nada. */
export function asLatin1(bytes) {
  return Buffer.from(bytes).toString('latin1');
}

/** Fluxos de conteudo descomprimidos, na ordem do arquivo: um por pagina. */
export function readStreams(bytes) {
  return [...asLatin1(bytes).matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) =>
    inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'),
  );
}

/** Bytes de uma cadeia literal do PDF, com os escapes desfeitos. */
function literalBytes(body) {
  return body.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, escape) => {
    const named = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };

    if (/^[0-7]+$/.test(escape)) {
      return String.fromCharCode(Number.parseInt(escape, 8));
    }

    return named[escape] ?? escape;
  });
}

function hexBytes(body) {
  const pairs = body.replace(/\s/g, '').match(/.{1,2}/g) ?? [];

  return pairs
    .map((pair) => String.fromCharCode(Number.parseInt(pair.padEnd(2, '0'), 16)))
    .join('');
}

/** Texto de bytes WinAnsi. */
export function fromWinAnsi(raw) {
  return Array.from(raw, (character) => {
    const code = character.charCodeAt(0);

    return String.fromCodePoint(WINANSI_HIGH[code] ?? code);
  }).join('');
}

/** Texto de uma cadeia de propriedade: UTF-16 com a marca no comeco, ou byte a byte. */
function fromInfoString(raw) {
  if (raw.startsWith('\u00FE\u00FF')) {
    let text = '';

    for (let index = 2; index + 1 < raw.length; index += 2) {
      text += String.fromCharCode((raw.charCodeAt(index) << 8) | raw.charCodeAt(index + 1));
    }

    return text;
  }

  return raw;
}

const STRING_OPERAND = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>/;

function stringOf(token) {
  return token.startsWith('(') ? literalBytes(token.slice(1, -1)) : hexBytes(token.slice(1, -1));
}

/**
 * Textos escritos em cada pagina, na ordem do fluxo, com o corpo e a fonte
 * em uso: `[[{ font, size, text }]]`.
 */
export function readPageTexts(bytes) {
  return readStreams(bytes).map((content) => {
    const runs = [];
    let font = null;
    let size = null;
    const pattern = new RegExp(`/(F\\d+) ([\\d.]+) Tf|(${STRING_OPERAND.source}) Tj`, 'g');

    for (const match of content.matchAll(pattern)) {
      if (match[1]) {
        font = match[1];
        size = Number(match[2]);
      } else {
        runs.push({ font, size, text: fromWinAnsi(stringOf(match[3])) });
      }
    }

    return runs;
  });
}

/**
 * Fontes do arquivo pelo nome do recurso, com o nome PostScript e a
 * codificacao: `{ F1: { baseFont: 'Helvetica', encoding: 'WinAnsiEncoding' } }`.
 * Fonte embutida teria um fluxo `FontFile`, contado a parte.
 */
export function readFonts(bytes) {
  const raw = asLatin1(bytes);
  const objects = new Map(
    [...raw.matchAll(/(\d+) 0 obj\s*<<([\s\S]*?)>>\s*endobj/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  const resources = raw.match(/\/Font <<([\s\S]*?)>>/)?.[1] ?? '';

  return Object.fromEntries(
    [...resources.matchAll(/\/(F\d+) (\d+) 0 R/g)].map(([, name, objectNumber]) => {
      const body = objects.get(objectNumber) ?? '';

      return [
        name,
        {
          baseFont: body.match(/\/BaseFont \/([\w-]+)/)?.[1] ?? null,
          encoding: body.match(/\/Encoding \/([\w-]+)/)?.[1] ?? null,
        },
      ];
    }),
  );
}

/** Quantos fluxos de fonte embutida o arquivo tem. */
export function countEmbeddedFonts(bytes) {
  return [...asLatin1(bytes).matchAll(/\/FontFile\d?/g)].length;
}

/** Propriedades do documento: titulo, assunto, criador, produtor e data de criacao. */
export function readInfo(bytes) {
  const raw = asLatin1(bytes);
  const info = {};

  for (const key of [
    'Title',
    'Subject',
    'Author',
    'Keywords',
    'Creator',
    'Producer',
    'CreationDate',
    'ModDate',
  ]) {
    const match = raw.match(new RegExp(`/${key} (${STRING_OPERAND.source})`));

    if (match) {
      info[key] = fromInfoString(stringOf(match[1]));
    }
  }

  return info;
}

/** As duas partes do identificador do arquivo, em hexadecimal. */
export function readFileId(bytes) {
  const match = asLatin1(bytes).match(/\/ID \[\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\]/);

  return match ? [match[1], match[2]] : null;
}

/** Caixa de midia de cada pagina, em ponto, na ordem em que aparecem. */
export function readMediaBoxes(bytes) {
  return [...asLatin1(bytes).matchAll(/\/MediaBox \[([^\]]*)\]/g)].map((match) =>
    match[1].trim().split(/\s+/).map(Number),
  );
}
