import { detectConflicts, findConflict } from '../domain/services/conflictDetection.js';
import { identifyCopies } from '../domain/services/copyIdentity.js';

/**
 * Regras das escolhas do operador antes de chegarem ao banco: a escolha so
 * vale para a sessao aberta e para um conflito que existe nas leituras dela,
 * com um valor que e uma das variantes. Cada escolha e somada as ja gravadas
 * do mesmo produto, campo a campo, e retirar o ultimo campo apaga o registro.
 *
 * As recusas levam um nome estavel e a frase em portugues em `message`, para
 * a tela mostrar como veio.
 */

export const RESOLUTION_ERRORS = Object.freeze({
  SESSION_NOT_OPEN: 'SessionNotOpenError',
  STALE_CONFLICT: 'StaleConflictError',
});

const RESOLUTION_ERROR_MESSAGES = new Map([
  [
    RESOLUTION_ERRORS.SESSION_NOT_OPEN,
    'A sessão desta escolha não está aberta. Abra a sessão e tente de novo.',
  ],
  [
    RESOLUTION_ERRORS.STALE_CONFLICT,
    'Esta escolha não corresponde mais às variantes do produto. Confira o conflito e escolha de novo.',
  ],
]);

export function createResolutionError(name) {
  const error = new Error(RESOLUTION_ERROR_MESSAGES.get(name));

  error.name = name;

  return error;
}

/** Recusa a acao sem sessao aberta ou para uma sessao que nao e a aberta. */
export function assertOpenSession(currentSessionId, sessionId) {
  if (currentSessionId === null || currentSessionId !== sessionId) {
    throw createResolutionError(RESOLUTION_ERRORS.SESSION_NOT_OPEN);
  }
}

/**
 * Recusa a escolha quando o campo do produto nao diverge nas leituras da
 * sessao ou quando o valor nao e uma das variantes encontradas.
 */
export function assertChoiceAvailable(readings, systemCode, field, value) {
  const conflicts = detectConflicts(identifyCopies(readings).copies);
  const conflict = findConflict(conflicts, systemCode, field);

  if (!conflict || !conflict.variants.some((variant) => variant.value === value)) {
    throw createResolutionError(RESOLUTION_ERRORS.STALE_CONFLICT);
  }
}

const findResolution = (resolutions, systemCode) =>
  resolutions.find((resolution) => resolution.systemCode === systemCode);

/** As escolhas do produto com este campo escolhido, somado aos ja escolhidos. */
export function choicesWith(resolutions, systemCode, field, value) {
  return { ...findResolution(resolutions, systemCode)?.choices, [field]: value };
}

/**
 * As escolhas do produto sem este campo, possivelmente nenhuma. `undefined`
 * quando o campo nao tem escolha gravada, e nao ha nada a retirar.
 */
export function choicesWithout(resolutions, systemCode, field) {
  const current = findResolution(resolutions, systemCode);

  if (!current || current.choices[field] === undefined) {
    return undefined;
  }

  const remaining = { ...current.choices };

  delete remaining[field];

  return remaining;
}

const byCode = (first, second) => {
  if (first.systemCode === second.systemCode) {
    return 0;
  }

  return first.systemCode < second.systemCode ? -1 : 1;
};

/** A lista com a resolucao do produto trocada ou acrescentada, na ordem do banco. */
export function upsertResolution(resolutions, resolution) {
  return [
    ...resolutions.filter((item) => item.systemCode !== resolution.systemCode),
    resolution,
  ].sort(byCode);
}

export function removeResolution(resolutions, systemCode) {
  return resolutions.filter((item) => item.systemCode !== systemCode);
}
