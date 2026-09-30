import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './focusClasses.js';

// O lado acompanha a altura de controle da tela: 44 px onde ela pode ser
// tocada, 32 px na tela larga, que e operada com mouse. Os dois passam do menor
// lado aceitavel para um alvo de ponteiro.
const BASE_CLASSES = cx(
  'inline-flex h-controle w-controle flex-none items-center justify-center rounded',
  'border shadow-none transition-colors',
  FOCUS_OUTLINE,
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * `plain` acompanha as acoes neutras de uma linha; `danger` marca a acao que
 * remove dados, com o vermelho so no desenho e no realce, sem preenchimento.
 */
const TONE_CLASSES = Object.freeze({
  plain: cx(
    'border-neutro-bordaForte bg-neutro-branco text-neutro-tintaMedia hover:bg-neutro-superficie',
    FOCUS_OUTLINE_COLORS.neutral,
  ),
  danger: cx(
    'border-neutro-bordaForte bg-neutro-branco text-marca-vermelhoTexto',
    'hover:border-marca-vermelhoBorda hover:bg-marca-vermelhoTenue',
    FOCUS_OUTLINE_COLORS.danger,
  ),
});

/**
 * Botao compacto sem rotulo visivel, para as acoes que se repetem a cada item
 * de uma lista e para o fechar dos dialogos. `label` e obrigatorio: e ele que
 * nomeia o botao para leitores de tela e alimenta a dica do ponteiro. O icone
 * chega como filho e fica fora da leitura.
 */
export default function IconButton({
  label,
  tone = 'plain',
  type = 'button',
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(BASE_CLASSES, TONE_CLASSES[tone] ?? TONE_CLASSES.plain, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
