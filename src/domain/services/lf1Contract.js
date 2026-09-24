/**
 * Leitura do texto LF1 gravado no QR Code da etiqueta.
 *
 * O texto e posicional, com barra vertical entre os campos, e a ordem nunca
 * muda:
 *
 *   [0] versao, exatamente `LF1`
 *   [1] codigo do sistema
 *   [2] nome
 *   [3] preco em centavos, inteiro
 *   [4] codigo de barras, opcional
 *   [5] NCM, opcional
 *   [6] exemplar: `c1`, `c2`, ...
 *
 *   LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1
 *   LF1|118789|CANTINHO CAFE RUBI|85990|||c1
 *
 * Campo opcional ausente mantem a posicao, vazio. Nao ha escape: barra vertical
 * e quebra de linha nunca aparecem dentro de um campo.
 *
 * A leitura e estrita. Exige exatamente sete posicoes, compara o texto como
 * veio (sem aparar espacos, sem mudar a caixa, sem normalizar Unicode) e nunca
 * lanca: qualquer entrada devolve os campos ou o motivo da recusa. O motivo tem
 * um codigo estavel, para gravar e filtrar, e a frase em portugues, para
 * mostrar.
 */

import { Lf1FieldsSchema } from '../schemas/lf1FieldsSchema.js';

export const LF1_VERSION = 'LF1';
export const LF1_SEPARATOR = '|';

export const LF1_FIELDS = Object.freeze([
  'version',
  'systemCode',
  'displayName',
  'priceInCentavos',
  'ean',
  'ncm',
  'copy',
]);

export const LF1_POSITION_COUNT = LF1_FIELDS.length;

const OPTIONAL_FIELDS = new Set(['ean', 'ncm']);

export const LF1_REJECTION_REASONS = Object.freeze({
  NOT_LF1: 'not-lf1',
  UNSUPPORTED_VERSION: 'unsupported-version',
  INVALID_POSITIONS: 'invalid-positions',
  INVALID_FIELD: 'invalid-field',
});

export const LF1_REJECTION_MESSAGES = Object.freeze({
  [LF1_REJECTION_REASONS.NOT_LF1]: 'não é LF1',
  [LF1_REJECTION_REASONS.UNSUPPORTED_VERSION]: 'versão não suportada',
  [LF1_REJECTION_REASONS.INVALID_POSITIONS]: 'posições inválidas',
  [LF1_REJECTION_REASONS.INVALID_FIELD]: 'campo inválido',
});

export const LF1_FIELD_LABELS = Object.freeze({
  version: 'versão',
  systemCode: 'código do sistema',
  displayName: 'nome',
  priceInCentavos: 'preço em centavos',
  ean: 'código de barras',
  ncm: 'NCM',
  copy: 'exemplar',
});

/** `LF` seguido de digito: da mesma familia de formatos, outra versao. */
const OTHER_VERSION = /^LF\d/;

const PRICE_DIGITS = /^\d+$/;

/** Trecho antes da primeira barra, ou o texto inteiro quando nao ha barra. */
function versionOf(text) {
  const end = text.indexOf(LF1_SEPARATOR);

  return end === -1 ? text : text.slice(0, end);
}

/** Motivo da recusa pelo prefixo, ou `null` quando a versao e `LF1`. */
function prefixRejection(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return LF1_REJECTION_REASONS.NOT_LF1;
  }

  const version = versionOf(text);

  if (version === LF1_VERSION) {
    return null;
  }

  return OTHER_VERSION.test(version)
    ? LF1_REJECTION_REASONS.UNSUPPORTED_VERSION
    : LF1_REJECTION_REASONS.NOT_LF1;
}

function reject(reason, field) {
  const message = LF1_REJECTION_MESSAGES[reason];

  if (field === undefined) {
    return { ok: false, reason, message };
  }

  return { ok: false, reason, message: `${message}: ${LF1_FIELD_LABELS[field]}`, field };
}

/**
 * So texto de digitos vira numero. Qualquer outro texto segue como texto e o
 * schema o recusa como preco invalido.
 */
function priceFrom(text) {
  return PRICE_DIGITS.test(text) ? Number(text) : text;
}

function candidateFrom(parts) {
  const candidate = {};

  LF1_FIELDS.forEach((field, index) => {
    const value = parts[index];

    if (value === '' && OPTIONAL_FIELDS.has(field)) {
      return;
    }

    candidate[field] = field === 'priceInCentavos' ? priceFrom(value) : value;
  });

  return candidate;
}

/** Primeiro campo recusado na ordem das posicoes. */
function firstInvalidField(issues) {
  const positions = issues
    .map((issue) => LF1_FIELDS.indexOf(issue.path[0]))
    .filter((position) => position !== -1);

  return LF1_FIELDS[Math.min(...positions)];
}

/**
 * `true` quando o texto e da versao `LF1`: a leitura so pode recusa-lo pelo
 * numero de posicoes ou por um campo fora da regra.
 */
export function isLf1Candidate(text) {
  return prefixRejection(text) === null;
}

/**
 * Le o texto de um simbolo. Devolve `{ ok: true, fields }` ou
 * `{ ok: false, reason, message, field? }`, com `field` presente so na recusa
 * de campo.
 */
export function parseLf1(text) {
  const prefixReason = prefixRejection(text);

  if (prefixReason !== null) {
    return reject(prefixReason);
  }

  const parts = text.split(LF1_SEPARATOR);

  if (parts.length !== LF1_POSITION_COUNT) {
    return reject(LF1_REJECTION_REASONS.INVALID_POSITIONS);
  }

  const result = Lf1FieldsSchema.safeParse(candidateFrom(parts));

  if (!result.success) {
    return reject(LF1_REJECTION_REASONS.INVALID_FIELD, firstInvalidField(result.error.issues));
  }

  return { ok: true, fields: result.data };
}
