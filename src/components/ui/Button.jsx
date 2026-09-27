import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './focusClasses.js';

/**
 * Forma do botao, sem o realce de foco. Tem 44 px de altura abaixo do ponto de
 * corte, alvo de toque, e 32 px a partir dele (`h-controle`, em `global.css`).
 */
const SHAPE_CLASSES = cx(
  'inline-flex items-center justify-center gap-2 rounded border px-4 text-sm lg:px-3',
  'h-controle cursor-pointer font-semibold shadow-none transition-colors',
);

const DISABLED_CLASSES = 'disabled:cursor-not-allowed disabled:opacity-60';

/**
 * `primary` carrega a cor de marca e fica reservada a acao principal de uma
 * tela. `secondary` e neutra e acompanha as acoes de apoio. `danger` marca a
 * acao que remove dados.
 *
 * As tres variantes dividem o mesmo vermelho, e o que as separa e o peso: a
 * marca preenche, o perigo usa fundo tenue com texto proprio. Nenhum texto de
 * erro cai sobre preenchimento vermelho.
 */
const VARIANT_CLASSES = Object.freeze({
  primary: cx(
    'border-marca-vermelho bg-marca-vermelho text-neutro-branco',
    'hover:border-marca-vermelhoEscuro hover:bg-marca-vermelhoEscuro',
  ),
  secondary: cx(
    'border-neutro-bordaForte bg-neutro-branco text-neutro-tinta hover:bg-neutro-superficie',
    'font-medium',
  ),
  danger: cx(
    'border-marca-vermelhoBorda bg-marca-vermelhoTenue text-marca-vermelhoTexto',
    'hover:border-marca-vermelhoTexto',
  ),
});

const FOCUS_COLOR_BY_VARIANT = Object.freeze({
  primary: FOCUS_OUTLINE_COLORS.brand,
  secondary: FOCUS_OUTLINE_COLORS.neutral,
  danger: FOCUS_OUTLINE_COLORS.danger,
});

/**
 * Classes da forma e da cor de uma variante. Serve tambem ao rotulo que tem a
 * aparencia de botao, como o que envolve o seletor de arquivos.
 */
export function buttonShapeClasses(variant = 'secondary') {
  return cx(SHAPE_CLASSES, VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.secondary);
}

export default function Button({
  type = 'button',
  variant = 'secondary',
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx(
        buttonShapeClasses(variant),
        FOCUS_OUTLINE,
        FOCUS_COLOR_BY_VARIANT[variant] ?? FOCUS_OUTLINE_COLORS.neutral,
        DISABLED_CLASSES,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
