/**
 * Leituras e fontes sinteticas para os testes do dominio. Os textos, codigos,
 * precos e nomes de arquivo sao inventados, e cada registro tem so os campos do
 * registro gravado.
 */

import { QR_FIXTURES } from './qrFixtures.js';

const SESSION_ID = 'sessao-teste';
const READ_AT = '2026-09-29T12:00:00.000Z';

/** Texto LF1 montado pelas sete posicoes; opcional ausente fica vazio. */
export function lf1Text({ systemCode, displayName, price, ean = '', ncm = '', copy = 'c1' }) {
  return ['LF1', systemCode, displayName, String(price), ean, ncm, copy].join('|');
}

/** Caixa alinhada de `width` por `height` pixels com o canto superior esquerdo em `x`, `y`. */
export function boxAt(x, y, width, height = width) {
  return {
    topLeft: { x, y },
    topRight: { x: x + width, y },
    bottomRight: { x: x + width, y: y + height },
    bottomLeft: { x, y: y + height },
  };
}

/**
 * Uma leitura como o banco a guarda. Sem `position`, o registro sai sem o
 * campo, como quando o leitor nao entrega os cantos.
 */
export function readingOf(id, sourceId, text, position) {
  const reading = { id, sessionId: SESSION_ID, sourceId, text, readAt: READ_AT };

  return position === undefined ? reading : { ...reading, position };
}

/**
 * Uma fonte como o banco a guarda: foto lida, ou com falha quando
 * `failureReason` vem preenchido. O nome do arquivo e a data do processamento
 * podem ser trocados; o SHA-256 e ficticio.
 */
export function sourceOf(
  id,
  { fileName = `${id}.jpg`, origin = 'file', processedAt = READ_AT, failureReason } = {},
) {
  const source = {
    id,
    sessionId: SESSION_ID,
    fileName,
    byteSize: 1024,
    lastModified: 0,
    sha256: '0'.repeat(64),
    origin,
    processedAt,
  };

  return failureReason === undefined
    ? { ...source, status: 'read', width: 1200, height: 900 }
    : { ...source, status: 'failed', failureReason };
}

/** Lado de cada caixa e passo da grade das leituras das imagens de teste. */
const GRID_BOX = 120;
const GRID_STEP = 150;

/**
 * Leituras de uma das imagens de teste, na ordem da lista, com a caixa de cada
 * simbolo na celula da grade em que o script o desenha. Os cantos sao
 * sinteticos: a grade vem do numero de colunas, nao da imagem decodificada.
 */
export function qrFixtureReadings(file, sourceId) {
  const fixture = QR_FIXTURES.find((entry) => entry.file === file);

  return fixture.texts.map((text, index) => {
    const column = index % fixture.columns;
    const row = Math.floor(index / fixture.columns);
    const position = boxAt(column * GRID_STEP, row * GRID_STEP, GRID_BOX);

    return readingOf(`${sourceId}-${index + 1}`, sourceId, text, position);
  });
}
