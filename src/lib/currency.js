/**
 * Valor em centavos inteiros escrito como moeda brasileira (`R$ 1.234,56`),
 * para a tela e para as exportacoes lidas por pessoas. Os calculos continuam em
 * centavos inteiros; esta e so a forma de mostrar.
 *
 * Os reais e os centavos saem dos digitos do proprio inteiro, sem dividir por
 * cem: a divisao em ponto flutuante perde centavos nos valores muito grandes.
 * O agrupamento dos milhares vem do `Intl` em pt-BR, e o espaco depois de `R$`
 * e o espaco comum, que qualquer planilha e leitor de texto tratam igual.
 */

const CURRENCY_SYMBOL = 'R$';
const DECIMAL_SEPARATOR = ',';
const CENTAVO_DIGITS = 2;

const GROUPED_INTEGER = new Intl.NumberFormat('pt-BR', {
  useGrouping: true,
  maximumFractionDigits: 0,
});

/**
 * Formata um inteiro em centavos (`123456` vira `R$ 1.234,56`, `-100` vira
 * `-R$ 1,00`). Devolve `null` quando o valor nao e um inteiro.
 */
export function formatCentavosAsBRL(centavos) {
  if (!Number.isInteger(centavos)) {
    return null;
  }

  const sign = centavos < 0 ? '-' : '';
  const digits = BigInt(Math.abs(centavos))
    .toString()
    .padStart(CENTAVO_DIGITS + 1, '0');
  const reais = BigInt(digits.slice(0, -CENTAVO_DIGITS));
  const cents = digits.slice(-CENTAVO_DIGITS);

  return `${sign}${CURRENCY_SYMBOL} ${GROUPED_INTEGER.format(reais)}${DECIMAL_SEPARATOR}${cents}`;
}
