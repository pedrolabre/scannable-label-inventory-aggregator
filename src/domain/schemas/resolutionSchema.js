import { z } from 'zod';

import { uuidField } from './commonFields.js';
import { Lf1FieldsSchema } from './lf1FieldsSchema.js';

const lf1 = Lf1FieldsSchema.shape;

/**
 * Valores escolhidos pelo operador, campo a campo. So entra o campo que foi
 * resolvido; a chave ausente quer dizer que aquele campo nao teve escolha.
 * `null` em `ean` ou `ncm` e a escolha da variante sem o campo.
 *
 * Cada valor segue a mesma regra da etiqueta, porque ele sempre vem de uma
 * variante lida.
 */
const ResolutionChoicesSchema = z
  .object(
    {
      displayName: lf1.displayName.optional(),
      priceInCentavos: lf1.priceInCentavos.optional(),
      ean: lf1.ean.unwrap().nullable().optional(),
      ncm: lf1.ncm.unwrap().nullable().optional(),
    },
    {
      required_error: 'Valores escolhidos obrigatórios',
      invalid_type_error: 'Valores escolhidos devem ser um objeto',
    },
  )
  .strict('Resolução aceita só nome, preço, código de barras e NCM')
  .refine(
    (choices) => Object.values(choices).some((value) => value !== undefined),
    'Resolução precisa de pelo menos um campo escolhido',
  );

/** Escolha do operador para os dados de um produto em conflito na sessao. */
export const ResolutionSchema = z
  .object({
    sessionId: uuidField('Identificador da sessão'),
    systemCode: lf1.systemCode,
    choices: ResolutionChoicesSchema,
  })
  .strict('Resolução não aceita campo fora do registro');
