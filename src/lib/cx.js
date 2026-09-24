/**
 * Junta classes utilitarias descartando os valores vazios ou falsos. Permite
 * montar a lista final a partir de condicoes sem espalhar ternarios pelo JSX.
 */
export function cx(...values) {
  return values.filter(Boolean).join(' ');
}
