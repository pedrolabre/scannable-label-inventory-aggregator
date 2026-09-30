import { SESSION_NAME_MAX_LENGTH, SessionSchema } from '../../domain/schemas/sessionSchema.js';

/**
 * Textos do dialogo de sessoes: a data da ultima alteracao, a conferencia do
 * nome digitado e o contador de caracteres. So formatacao e conferencia; nada
 * aqui grava.
 */

const pad = (value) => String(value).padStart(2, '0');

/** Data e hora locais de um instante ISO: `02/10/2026 14:05`. */
export function formatSessionDate(isoDateTime) {
  const date = new Date(isoDateTime);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

const nameField = SessionSchema.shape.name;

/**
 * Frase da recusa do nome, a mesma regra e o mesmo texto da gravacao, ou
 * `null` quando o nome passa. O nome e aparado antes da conferencia.
 */
export function sessionNameIssue(name) {
  const result = nameField.safeParse(name);

  return result.success ? null : `${result.error.issues[0].message}.`;
}

/** Contador do nome aparado contra o limite: `12/80`. */
export function sessionNameCount(name) {
  return `${name.trim().length}/${SESSION_NAME_MAX_LENGTH}`;
}
