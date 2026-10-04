/**
 * Escrita de XML a partir de uma arvore de elementos.
 *
 * Todo texto que entra no arquivo passa por aqui, e por isso o arquivo nunca e
 * montado por concatenacao solta: cada valor vira atributo ou conteudo de um
 * elemento, e a escrita escapa os dois.
 *
 * Escape: `&`, `<`, `>`, `"` e `'` viram referencia nos dois lugares. Dentro
 * do atributo, tabulacao, quebra de linha e retorno de carro tambem, porque o
 * leitor de XML troca os tres por espaco; dentro do elemento, o retorno de
 * carro, que o leitor troca por quebra de linha. Assim o texto lido de volta e
 * o texto escrito.
 *
 * O XML 1.0 nao aceita os caracteres de controle (menos tabulacao, quebra de
 * linha e retorno de carro), metade de um par substituto sozinha, U+FFFE e
 * U+FFFF, nem como referencia. O texto da etiqueta e o nome da foto podem
 * trazer algum deles; cada um vira U+FFFD, o caractere de substituicao, que
 * marca onde ele estava sem invalidar o arquivo.
 *
 * Forma do arquivo: declaracao na primeira linha, dois espacos por nivel, fim
 * de linha LF, tambem depois da ultima, e sem marca de ordem de bytes. A mesma
 * arvore produz o mesmo texto, byte a byte.
 */

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
export const XML_INDENT = '  ';
export const XML_LINE_END = '\n';

/** Caractere de substituicao, no lugar do que o XML 1.0 nao aceita. */
export const XML_REPLACEMENT = '\uFFFD';

/** Fora dos caracteres do XML 1.0; com `u`, metade de par sozinha conta como um. */
const NOT_XML_CHAR = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

/** Nomes de elemento e de atributo deste projeto: ASCII minusculo com hifen. */
const XML_NAME = /^[a-z][a-z0-9-]*$/;

const TEXT_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
  '\r': '&#13;',
});

const ATTRIBUTE_ESCAPES = Object.freeze({
  ...TEXT_ESCAPES,
  '\t': '&#9;',
  '\n': '&#10;',
});

const TEXT_SPECIAL = /[&<>"'\r]/g;
const ATTRIBUTE_SPECIAL = /[&<>"'\t\n\r]/g;

/** Texto com cada caractere fora do XML 1.0 trocado por U+FFFD. */
export function cleanXmlText(text) {
  return text.replace(NOT_XML_CHAR, XML_REPLACEMENT);
}

export function escapeXmlText(text) {
  return cleanXmlText(text).replace(TEXT_SPECIAL, (char) => TEXT_ESCAPES[char]);
}

export function escapeXmlAttribute(text) {
  return cleanXmlText(text).replace(ATTRIBUTE_SPECIAL, (char) => ATTRIBUTE_ESCAPES[char]);
}

function checkName(name) {
  if (!XML_NAME.test(name)) {
    throw new TypeError(`Nome de XML inválido: ${name}`);
  }

  return name;
}

/**
 * Um elemento: nome, atributos como pares `[nome, valor]` na ordem em que saem
 * (valor `null` ou `undefined` deixa o atributo de fora), e o conteudo: texto,
 * lista de elementos (os `null` ficam de fora) ou nada.
 */
export function element(name, attributes = [], content = null) {
  const children = Array.isArray(content) ? content.filter(Boolean) : null;

  return {
    name: checkName(name),
    attributes: attributes
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([attribute, value]) => [checkName(attribute), String(value)]),
    text: typeof content === 'string' ? content : null,
    children: children ?? [],
  };
}

function openTag(node) {
  const attributes = node.attributes
    .map(([name, value]) => ` ${name}="${escapeXmlAttribute(value)}"`)
    .join('');

  return `<${node.name}${attributes}`;
}

function writeNode(node, depth, lines) {
  const indent = XML_INDENT.repeat(depth);

  if (node.text !== null) {
    lines.push(`${indent}${openTag(node)}>${escapeXmlText(node.text)}</${node.name}>`);
  } else if (node.children.length === 0) {
    lines.push(`${indent}${openTag(node)}/>`);
  } else {
    lines.push(`${indent}${openTag(node)}>`);
    node.children.forEach((child) => writeNode(child, depth + 1, lines));
    lines.push(`${indent}</${node.name}>`);
  }
}

/** Arquivo inteiro: a declaracao e o elemento raiz, uma linha por elemento. */
export function writeXml(root) {
  const lines = [XML_DECLARATION];

  writeNode(root, 0, lines);

  return `${lines.join(XML_LINE_END)}${XML_LINE_END}`;
}
