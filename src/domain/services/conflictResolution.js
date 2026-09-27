/**
 * Escolhas do operador aplicadas sobre o resumo por produto.
 *
 * Cada escolha vale para um campo de um produto e so e aplicada enquanto faz
 * sentido: o campo ainda diverge entre os exemplares e o valor escolhido ainda
 * e uma das variantes. Quando uma foto sai da sessao, o conflito pode sumir ou
 * a variante escolhida pode deixar de existir; a escolha fica gravada, mas e
 * ignorada e listada com o motivo, para quem exibe avisar o operador.
 *
 * A quantidade nunca muda: todos os exemplares do codigo contam, e a escolha
 * define so os dados que valem para o produto. O total e recalculado com o
 * preco escolhido.
 *
 * Nada daqui e gravado: so a escolha do operador fica no banco.
 */

import { compareSystemCodes } from './copyIdentity.js';
import { PRODUCT_FIELDS, totalOf } from './inventoryAggregation.js';

export const IGNORED_CHOICE_REASONS = Object.freeze({
  NO_PRODUCT: 'no-product',
  NO_CONFLICT: 'no-conflict',
  NOT_A_VARIANT: 'not-a-variant',
});

export const IGNORED_CHOICE_MESSAGES = Object.freeze({
  [IGNORED_CHOICE_REASONS.NO_PRODUCT]: 'o produto não aparece mais nas leituras da sessão',
  [IGNORED_CHOICE_REASONS.NO_CONFLICT]: 'os exemplares não divergem mais neste campo',
  [IGNORED_CHOICE_REASONS.NOT_A_VARIANT]: 'o valor escolhido não está mais entre as variantes',
});

const conflictKey = (systemCode, field) => `${systemCode}|${field}`;

function ignoredChoice(systemCode, field, value, reason) {
  return { systemCode, field, value, reason, message: IGNORED_CHOICE_MESSAGES[reason] };
}

/** Campos escolhidos, na ordem de `PRODUCT_FIELDS`. Chave ausente e campo sem escolha. */
function chosenFields(choices) {
  return PRODUCT_FIELDS.filter((field) => choices[field] !== undefined);
}

function resolvedProductOf(product, choices, conflictsByKey, ignoredChoices) {
  const values = {};
  const resolvedFields = [];

  for (const field of chosenFields(choices)) {
    const value = choices[field];
    const conflict = conflictsByKey.get(conflictKey(product.systemCode, field));

    if (!product.conflictingFields.includes(field) || conflict === undefined) {
      ignoredChoices.push(
        ignoredChoice(product.systemCode, field, value, IGNORED_CHOICE_REASONS.NO_CONFLICT),
      );
    } else if (!conflict.variants.some((variant) => variant.value === value)) {
      ignoredChoices.push(
        ignoredChoice(product.systemCode, field, value, IGNORED_CHOICE_REASONS.NOT_A_VARIANT),
      );
    } else {
      values[field] = value;
      resolvedFields.push(field);
    }
  }

  const resolved = { ...product, ...values };

  return {
    ...resolved,
    ...totalOf(resolved.quantity, resolved.priceInCentavos),
    conflictingFields: product.conflictingFields,
    resolvedFields,
    openConflictFields: product.conflictingFields.filter(
      (field) => !resolvedFields.includes(field),
    ),
  };
}

/**
 * Aplica as resolucoes gravadas da sessao ao resumo de `summarizeProducts`,
 * com os conflitos de `detectConflicts` dos mesmos exemplares. Devolve:
 *
 * - `products`: os produtos na mesma ordem, com o campo resolvido preenchido,
 *   o total recalculado, `conflictingFields` com todo campo divergente,
 *   `resolvedFields` e `openConflictFields`, na ordem de `PRODUCT_FIELDS`;
 * - `ignoredChoices`: `[{ systemCode, field, value, reason, message }]`, as
 *   escolhas gravadas que nao se aplicam mais, na ordem de
 *   `compareSystemCodes` e depois na de `PRODUCT_FIELDS`.
 */
export function applyResolutions(products, conflicts, resolutions) {
  const conflictsByKey = new Map(
    conflicts.map((conflict) => [conflictKey(conflict.systemCode, conflict.field), conflict]),
  );
  const choicesByCode = new Map(
    resolutions.map((resolution) => [resolution.systemCode, resolution.choices]),
  );
  const productCodes = new Set(products.map((product) => product.systemCode));
  const ignoredChoices = [];

  const resolvedProducts = products.map((product) =>
    resolvedProductOf(
      product,
      choicesByCode.get(product.systemCode) ?? {},
      conflictsByKey,
      ignoredChoices,
    ),
  );

  for (const [systemCode, choices] of choicesByCode) {
    if (!productCodes.has(systemCode)) {
      for (const field of chosenFields(choices)) {
        ignoredChoices.push(
          ignoredChoice(systemCode, field, choices[field], IGNORED_CHOICE_REASONS.NO_PRODUCT),
        );
      }
    }
  }

  ignoredChoices.sort(
    (first, second) =>
      compareSystemCodes(first.systemCode, second.systemCode) ||
      PRODUCT_FIELDS.indexOf(first.field) - PRODUCT_FIELDS.indexOf(second.field),
  );

  return { products: resolvedProducts, ignoredChoices };
}

/**
 * Conflitos abertos e resolvidos dos produtos de `applyResolutions`, contados
 * por produto e campo: um produto com nome e preco divergentes tem dois.
 */
export function countConflicts(products) {
  let open = 0;
  let resolved = 0;

  for (const product of products) {
    open += product.openConflictFields.length;
    resolved += product.resolvedFields.length;
  }

  return { open, resolved };
}
