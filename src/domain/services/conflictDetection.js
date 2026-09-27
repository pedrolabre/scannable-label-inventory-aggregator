/**
 * Conflitos de dados de uma sessao, derivados dos exemplares.
 *
 * Um conflito e um campo de um produto em que os exemplares do mesmo codigo
 * trazem valores diferentes: nome, preco, codigo de barras ou NCM. Cada valor
 * encontrado e uma variante, com quantos exemplares a carregam e quais sao.
 *
 * A comparacao e literal, como a do contrato: `CAFÉ` e `CAFE`, ou um espaco a
 * mais, sao variantes diferentes. Codigo de barras ou NCM ausente e a variante
 * `null`. A ordem das variantes vem so do valor; quantos exemplares carregam
 * cada uma nunca decide nada, porque so o operador escolhe a que vale.
 *
 * Nada daqui e gravado: os conflitos sao recalculados dos exemplares sempre
 * que alguem precisa deles.
 */

import { compareCopies, compareSystemCodes } from './copyIdentity.js';
import { PRODUCT_FIELDS } from './inventoryAggregation.js';

function compareText(first, second) {
  if (first === second) {
    return 0;
  }

  return first < second ? -1 : 1;
}

/** `null` quando o valor esta ausente, para o codigo de barras e o NCM opcionais. */
function valueOf(fields, field) {
  return fields[field] === undefined ? null : fields[field];
}

/**
 * Ordem das variantes de um campo: preco pelo numero, texto pela ordem dos
 * caracteres e o valor ausente por ultimo.
 */
export function compareVariantValues(field, first, second) {
  if (first === second) {
    return 0;
  }

  if (first === null) {
    return 1;
  }

  if (second === null) {
    return -1;
  }

  return field === 'priceInCentavos' ? first - second : compareText(first, second);
}

function variantsOf(field, copies) {
  const copiesByValue = new Map();

  for (const copy of copies) {
    const value = valueOf(copy.fields, field);

    if (!copiesByValue.has(value)) {
      copiesByValue.set(value, []);
    }

    copiesByValue.get(value).push(copy);
  }

  return [...copiesByValue.entries()]
    .sort(([first], [second]) => compareVariantValues(field, first, second))
    .map(([value, valueCopies]) => ({
      value,
      copyCount: valueCopies.length,
      texts: [...valueCopies].sort(compareCopies).map((copy) => copy.text),
    }));
}

/**
 * Conflitos dos exemplares de `identifyCopies`. Devolve
 * `[{ systemCode, field, variants: [{ value, copyCount, texts }] }]`, um item
 * por produto e campo com duas variantes ou mais, na ordem de
 * `compareSystemCodes` e depois na de `PRODUCT_FIELDS`. Os textos de cada
 * variante saem na ordem de `compareCopies`.
 */
export function detectConflicts(copies) {
  const copiesByCode = new Map();

  for (const copy of copies) {
    const { systemCode } = copy.fields;

    if (!copiesByCode.has(systemCode)) {
      copiesByCode.set(systemCode, []);
    }

    copiesByCode.get(systemCode).push(copy);
  }

  const conflicts = [];
  const codes = [...copiesByCode.keys()].sort(compareSystemCodes);

  for (const systemCode of codes) {
    for (const field of PRODUCT_FIELDS) {
      const variants = variantsOf(field, copiesByCode.get(systemCode));

      if (variants.length > 1) {
        conflicts.push({ systemCode, field, variants });
      }
    }
  }

  return conflicts;
}

/** O conflito do produto neste campo, ou `undefined` quando o campo nao diverge. */
export function findConflict(conflicts, systemCode, field) {
  return conflicts.find(
    (conflict) => conflict.systemCode === systemCode && conflict.field === field,
  );
}
