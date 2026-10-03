import { formatCentavosAsBRL } from '../../lib/currency.js';
import { describeStorageError } from '../../storage/storageError.js';
import { RESOLUTION_ERRORS } from '../../store/resolutionChoices.js';
import { countLabel } from '../capture/captureText.js';
import { fieldList } from '../products/productDisplay.jsx';

/**
 * Textos da coluna Detalhe e do dialogo de rejeitados, num lugar so. Valor de
 * etiqueta (nome, codigos) entra como veio e sai como texto: quem desenha
 * nunca o transforma em marcacao.
 */

const PRICE_FIELD = 'priceInCentavos';

/** Rotulo do campo para comecar uma linha: `Nome`, `Preço`, `EAN`, `NCM`. */
export function fieldTitle(field) {
  const label = fieldList([field]);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Valor de uma variante como a tela mostra: preco em reais, codigo ou nome
 * como veio, e o campo ausente por escrito (`sem EAN`, `sem NCM`).
 */
export function variantValueText(field, value) {
  if (value === null) {
    return `sem ${fieldList([field])}`;
  }

  if (field === PRICE_FIELD) {
    return formatCentavosAsBRL(value) ?? String(value);
  }

  return value;
}

export function copyCountText(count) {
  return countLabel(count, 'exemplar', 'exemplares');
}

export function readingCountText(count) {
  return countLabel(count, 'leitura', 'leituras');
}

/** `2 exemplares: c1, c3`, ou so a contagem quando os textos nao foram achados. */
export function variantCopiesText(copyCount, copyNumbers) {
  const count = copyCountText(copyCount);

  return copyNumbers.length === 0 ? count : `${count}: ${copyNumbers.join(', ')}`;
}

/** Motivo do campo opcional em branco no cabecalho quando ele esta em conflito aberto. */
export function conflictReason(field) {
  return `${fieldList([field])} em conflito`;
}

/** A escolha gravada que a tela ignora, com o valor e o motivo. */
export function ignoredChoiceText(choice) {
  return `A escolha gravada (${variantValueText(choice.field, choice.value)}) foi ignorada: ${choice.message}.`;
}

const RESOLUTION_ERROR_NAMES = new Set(Object.values(RESOLUTION_ERRORS));

/**
 * Frase de uma escolha que nao gravou. A recusa do store ja traz a propria
 * frase; a falha do banco passa pela mesma descricao das outras gravacoes.
 */
export function choiceErrorText(error) {
  if (RESOLUTION_ERROR_NAMES.has(error?.name) && error.message) {
    return error.message;
  }

  return describeStorageError(error);
}

/**
 * Rotulo do gatilho do dialogo com as contagens: `Rejeitados (2) e falhas (1)`,
 * `Rejeitados (2)` ou `Fotos com falha (1)`; `null` sem nada a mostrar.
 */
export function issuesLabel(rejectedCount, failedCount) {
  if (rejectedCount > 0 && failedCount > 0) {
    return `Rejeitados (${rejectedCount}) e falhas (${failedCount})`;
  }

  if (rejectedCount > 0) {
    return `Rejeitados (${rejectedCount})`;
  }

  return failedCount > 0 ? `Fotos com falha (${failedCount})` : null;
}

/** Nome do arquivo de uma foto, ou a frase da foto sem nome. */
export function fileNameText(fileName) {
  return fileName || 'foto sem nome';
}
