import { IGNORED_CHOICE_REASONS } from '../../domain/services/conflictResolution.js';

/**
 * Recorte do relatorio para o produto escolhido: os conflitos dele, na ordem
 * do relatorio (campo a campo), os exemplares e as escolhas gravadas que
 * deixaram de valer.
 *
 * A escolha de um produto que saiu da sessao (`no-product`) nunca chega aqui:
 * sem o produto nao ha Detalhe para mostra-la.
 *
 * Nada e recalculado: o relatorio ja traz tudo, e a coluna so filtra pelo
 * codigo.
 */
export function productDetailOf(report, systemCode) {
  const ofProduct = (entry) => entry.systemCode === systemCode;

  return {
    conflicts: report.conflicts.filter(ofProduct),
    copies: report.copies.filter(ofProduct),
    ignoredChoices: report.ignoredChoices.filter(
      (choice) => ofProduct(choice) && choice.reason !== IGNORED_CHOICE_REASONS.NO_PRODUCT,
    ),
  };
}

/**
 * O `cN` de cada texto LF1 dos exemplares. As variantes de um conflito trazem
 * os textos inteiros, e e por eles que a tela diz quais exemplares carregam
 * cada valor.
 */
export function copyNumberByText(copies) {
  return new Map(copies.map((copy) => [copy.text, copy.copy]));
}

/** `cN` dos textos de uma variante, na ordem dos textos; texto desconhecido fica de fora. */
export function copyNumbersOf(texts, numbers) {
  return texts.map((text) => numbers.get(text)).filter((copy) => copy !== undefined);
}
