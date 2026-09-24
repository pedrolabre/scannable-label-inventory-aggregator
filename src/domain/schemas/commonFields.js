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
