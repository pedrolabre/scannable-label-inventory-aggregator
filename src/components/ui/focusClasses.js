import { cx } from '../../lib/cx.js';

/**
 * Realce de foco compartilhado por todos os controles.
 *
 * A regra e uma so e mora aqui: contorno de dois pixels, deslocado do proprio
 * controle, aceso apenas quando o navegador entende que o foco precisa ser
 * visto. Com o canto reto do produto, o contorno do navegador ja acompanha a
 * forma do controle; o que e nosso e a cor e a espessura.
 *
 * A cor acompanha o papel do controle: marca na acao principal, neutro nas
 * acoes de apoio, erro no que remove dados.
 */
export const FOCUS_OUTLINE = cx(
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
);

export const FOCUS_OUTLINE_COLORS = Object.freeze({
  brand: 'focus-visible:outline-marca-vermelho',
  neutral: 'focus-visible:outline-neutro-tintaFraca',
  danger: 'focus-visible:outline-marca-vermelhoTexto',
});

/**
 * Mesma regra para o controle escondido so visualmente dentro de um rotulo: o
 * realce aparece no rotulo quando o controle de dentro recebe o foco.
 */
export const INNER_FOCUS_OUTLINE = cx(
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
  'has-[:focus-visible]:outline-offset-2',
);

export const INNER_FOCUS_OUTLINE_COLORS = Object.freeze({
  brand: 'has-[:focus-visible]:outline-marca-vermelho',
  neutral: 'has-[:focus-visible]:outline-neutro-tintaFraca',
});

/**
 * Mesma regra para o controle escondido so visualmente cujo realce aparece no
 * elemento vizinho, e nao num rotulo que o envolve. E o caso da escolha unica:
 * o radio fica fora da vista, e quem se pinta e a opcao desenhada ao lado dele.
 */
export const PEER_FOCUS_OUTLINE = cx(
  'peer-focus-visible:outline peer-focus-visible:outline-2',
  'peer-focus-visible:outline-offset-2',
);

export const PEER_FOCUS_OUTLINE_COLORS = Object.freeze({
  brand: 'peer-focus-visible:outline-marca-vermelho',
  neutral: 'peer-focus-visible:outline-neutro-tintaFraca',
});
