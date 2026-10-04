import { IGNORED_CHOICE_REASONS } from '../../domain/services/conflictResolution.js';
import { countLabel } from '../capture/captureText.js';

/**
 * Textos e recortes do relatorio para o dialogo de exportacao. Codigo de
 * produto entra como veio e sai como texto.
 */

/** Frase do bloqueio como abre uma linha: `Exportação bloqueada: 2 conflitos abertos.` */
export function blockerText(blocker) {
  return `${blocker.message.charAt(0).toUpperCase()}${blocker.message.slice(1)}.`;
}

/** Codigo do primeiro produto, na ordem do relatorio, com algum conflito aberto. */
export function firstOpenConflictCode(report) {
  return (
    report.products.find((product) => product.openConflictFields.length > 0)?.systemCode ?? null
  );
}

/** Escolhas gravadas de produto que nao aparece mais nas leituras da sessao. */
export function missingProductChoicesOf(report) {
  return report.ignoredChoices.filter(
    (choice) => choice.reason === IGNORED_CHOICE_REASONS.NO_PRODUCT,
  );
}

/**
 * Aviso das escolhas sem produto, com a contagem, o motivo do relatorio e os
 * codigos sem repeticao, na ordem em que vieram.
 */
export function missingProductText(choices) {
  const codes = [...new Set(choices.map((choice) => choice.systemCode))].join(', ');
  const count = countLabel(choices.length, 'escolha gravada', 'escolhas gravadas');
  const verb = choices.length === 1 ? 'ficou' : 'ficaram';
  const returns = choices.length === 1 ? 'Ela volta' : 'Elas voltam';

  return `${count} ${verb} de fora dos arquivos: ${choices[0].message} (${codes}). ${returns} a valer se a foto do produto for enviada de novo.`;
}

export function doneText(fileName) {
  return `Arquivo gerado: ${fileName}`;
}
