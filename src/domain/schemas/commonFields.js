import { z } from 'zod';

/**
 * Campos reutilizaveis dos schemas do dominio. Nenhum deles apara espacos ou
 * muda a caixa: o texto lido da etiqueta e validado exatamente como veio,
 * porque ele tambem e a identidade do exemplar.
 */

function textField(label) {
  return z
    .string({
      required_error: `${label} obrigatório`,
      invalid_type_error: `${label} deve ser texto`,
    })
    .min(1, `${label} obrigatório`);
}

export const patternField = (label, pattern, message) => textField(label).regex(pattern, message);

export const optionalPatternField = (label, pattern, message) =>
  patternField(label, pattern, message).optional();

export const boundedTextField = (label, maxLength, forbidden, forbiddenMessage) =>
  textField(label)
    .max(maxLength, `${label} deve ter no máximo ${maxLength} caracteres`)
    .refine((value) => !forbidden.test(value), forbiddenMessage);

/**
 * Inteiro de 0 ate o maior inteiro que o numero do JavaScript representa sem
 * perda. Acima disso, dois textos diferentes virariam o mesmo valor.
 */
export const nonNegativeSafeIntegerField = (label) =>
  z
    .number({
      required_error: `${label} obrigatório`,
      invalid_type_error: `${label} deve ser um número inteiro`,
    })
    .int(`${label} deve ser um número inteiro`)
    .min(0, `${label} não pode ser negativo`)
    .max(Number.MAX_SAFE_INTEGER, `${label} deve ser no máximo ${Number.MAX_SAFE_INTEGER}`);

/**
 * Os campos abaixo aceitam `{ feminine: true }` para concordar a mensagem de
 * ausencia com o rotulo: `Largura da imagem obrigatória`.
 */
export const FEMININE = Object.freeze({ feminine: true });

function requiredMessage(label, { feminine = false } = {}) {
  return `${label} ${feminine ? 'obrigatória' : 'obrigatório'}`;
}

function requiredText(label, options) {
  const missing = requiredMessage(label, options);

  return z
    .string({ required_error: missing, invalid_type_error: `${label} deve ser texto` })
    .min(1, missing);
}

/** Texto obrigatorio com limite de tamanho, validado como veio. */
export const limitedTextField = (label, maxLength, options) =>
  requiredText(label, options).max(
    maxLength,
    `${label} deve ter no máximo ${maxLength} caracteres`,
  );

/** Inteiro de 1 ate o maior inteiro exato, para medidas que nunca sao zero. */
export const positiveSafeIntegerField = (label, options) =>
  z
    .number({
      required_error: requiredMessage(label, options),
      invalid_type_error: `${label} deve ser um número inteiro`,
    })
    .int(`${label} deve ser um número inteiro`)
    .min(1, `${label} deve ser maior que zero`)
    .max(Number.MAX_SAFE_INTEGER, `${label} deve ser no máximo ${Number.MAX_SAFE_INTEGER}`);

/** Numero comum, recusando `NaN` e infinito. */
export const finiteNumberField = (label, options) =>
  z
    .number({
      required_error: requiredMessage(label, options),
      invalid_type_error: `${label} deve ser um número`,
    })
    .finite(`${label} deve ser um número finito`);

/** Identificador no formato UUID. */
export const uuidField = (label, options) =>
  z
    .string({
      required_error: requiredMessage(label, options),
      invalid_type_error: `${label} deve ser texto`,
    })
    .uuid(`${label} deve ser um UUID`);

/**
 * Data e hora em ISO 8601 no fuso UTC, como `Date.prototype.toISOString`
 * escreve: `2026-09-24T12:00:00.000Z`.
 */
export const isoDateTimeField = (label, options) =>
  z
    .string({
      required_error: requiredMessage(label, options),
      invalid_type_error: `${label} deve ser texto`,
    })
    .datetime({ message: `${label} deve ser data e hora em ISO 8601 (UTC)` });
