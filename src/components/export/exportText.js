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
 * codigos sem repeticao, na ordem em que vieram. O CSV nao as leva; o XML as
 * lista entre as escolhas ignoradas.
 */
export function missingProductText(choices) {
  const codes = [...new Set(choices.map((choice) => choice.systemCode))].join(', ');
  const count = countLabel(choices.length, 'escolha gravada', 'escolhas gravadas');
  const single = choices.length === 1;
  const verb = single ? 'ficou' : 'ficaram';
  const listed = single ? 'O XML a lista' : 'O XML as lista';
  const returns = single ? 'Ela volta' : 'Elas voltam';

  return `${count} ${verb} de fora do CSV: ${choices[0].message} (${codes}). ${listed} entre as escolhas ignoradas. ${returns} a valer se a foto do produto for enviada de novo.`;
}

/**
 * Por que a sessao gera menos arquivos: sem foto, nenhum; com foto e sem
 * produto, so o XML, que leva as fotos e os textos rejeitados. `null` quando
 * nada falta.
 */
export function emptySessionText(report) {
  if (report.header.sourceCount === 0) {
    return 'Nenhuma foto nesta sessão.';
  }

  if (report.products.length === 0) {
    return 'Nenhum produto nesta sessão. O XML ainda leva as fotos e os textos rejeitados.';
  }

  return null;
}

export function doneText(fileName) {
  return `Arquivo gerado: ${fileName}`;
}
