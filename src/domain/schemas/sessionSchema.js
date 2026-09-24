import { z } from 'zod';

import { FEMININE, isoDateTimeField, uuidField } from './commonFields.js';

export const SESSION_NAME_MAX_LENGTH = 80;

/**
 * O nome da sessao e digitado por quem faz o inventario, entao os espacos das
 * pontas saem antes da conferencia do tamanho. Nome so de espacos fica vazio e
 * e recusado.
 */
const sessionNameField = z
  .string({
    required_error: 'Nome da sessão obrigatório',
    invalid_type_error: 'Nome da sessão deve ser texto',
  })
  .trim()
  .min(1, 'Nome da sessão obrigatório')
  .max(
    SESSION_NAME_MAX_LENGTH,
    `Nome da sessão deve ter no máximo ${SESSION_NAME_MAX_LENGTH} caracteres`,
  );

/**
 * Uma sessao de inventario. `updatedAt` muda a cada gravacao que altera a
 * sessao ou o que pertence a ela, e e por ele que a sessao mais recente e
 * escolhida na abertura da aplicacao.
 */
export const SessionSchema = z
  .object({
    id: uuidField('Identificador da sessão'),
    name: sessionNameField,
    createdAt: isoDateTimeField('Data de criação da sessão', FEMININE),
    updatedAt: isoDateTimeField('Data de atualização da sessão', FEMININE),
  })
  .strict('Sessão não aceita campo fora do registro');

const pad = (value) => String(value).padStart(2, '0');

/** Nome da sessao criada sem nome: `Inventário 24/09/2026`, na data local. */
export function defaultSessionName(date) {
  return `Inventário ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
