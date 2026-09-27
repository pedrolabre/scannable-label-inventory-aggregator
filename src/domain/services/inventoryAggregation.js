/**
 * Resumo por produto, derivado dos exemplares da sessao.
 *
 * A chave do produto e o codigo do sistema. A quantidade e o numero de
 * exemplares unicos do codigo, e o total e a quantidade vezes o preco, em
 * centavos inteiros.
 *
 * Nome, preco, codigo de barras e NCM vem dos exemplares. Quando todos
 * concordam, o campo sai com o valor; quando divergem, sai `null` e entra na
 * lista `conflictingFields`, porque so o operador escolhe a variante que vale.
 * Sem preco unico nao ha total. Codigo de barras ou NCM ausente em todos os
 * exemplares sai `null`, sem divergencia.
 *
 * Nada daqui e gravado: o resumo e recalculado sempre que alguem precisa dele.
 */

import { compareSystemCodes } from './copyIdentity.js';

/** Campos do produto que vem dos exemplares, na ordem das posicoes LF1. */
export const PRODUCT_FIELDS = Object.freeze(['displayName', 'priceInCentavos', 'ean', 'ncm']);

/** `null` quando o valor esta ausente, para o codigo de barras e o NCM opcionais. */
function valueOf(fields, field) {
  return fields[field] === undefined ? null : fields[field];
}

function agreedValues(copies) {
  const values = {};
  const conflictingFields = [];

  for (const field of PRODUCT_FIELDS) {
    const distinct = new Set(copies.map((copy) => valueOf(copy.fields, field)));

    if (distinct.size === 1) {
      [values[field]] = distinct;
    } else {
      values[field] = null;
      conflictingFields.push(field);
    }
  }

  return { values, conflictingFields };
}

/**
 * Quantidade vezes preco. O produto de dois inteiros seguros e exato enquanto
 * o resultado cabe no inteiro seguro; acima disso o total fica sem valor e
 * marcado como fora do limite.
 */
export function totalOf(quantity, priceInCentavos) {
  if (priceInCentavos === null) {
    return { totalInCentavos: null, totalOutOfRange: false };
  }

  const total = quantity * priceInCentavos;

  if (!Number.isSafeInteger(total)) {
    return { totalInCentavos: null, totalOutOfRange: true };
  }

  return { totalInCentavos: total, totalOutOfRange: false };
}

function productOf(systemCode, copies) {
  const quantity = copies.length;
  const { values, conflictingFields } = agreedValues(copies);

  return {
    systemCode,
    quantity,
    ...values,
    ...totalOf(quantity, values.priceInCentavos),
    conflictingFields,
  };
}

/**
 * Resume os exemplares de `identifyCopies` por codigo do sistema. Devolve
 * `[{ systemCode, quantity, displayName, priceInCentavos, ean, ncm,
 * totalInCentavos, totalOutOfRange, conflictingFields }]`, na ordem de
 * `compareSystemCodes`.
 */
export function summarizeProducts(copies) {
  const copiesByCode = new Map();

  for (const copy of copies) {
    const { systemCode } = copy.fields;

    if (!copiesByCode.has(systemCode)) {
      copiesByCode.set(systemCode, []);
    }

    copiesByCode.get(systemCode).push(copy);
  }

  return [...copiesByCode.entries()]
    .sort(([first], [second]) => compareSystemCodes(first, second))
    .map(([systemCode, codeCopies]) => productOf(systemCode, codeCopies));
}
