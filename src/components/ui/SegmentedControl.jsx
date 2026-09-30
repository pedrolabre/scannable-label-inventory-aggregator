import { useRef } from 'react';

import { cx } from '../../lib/cx.js';

import { PEER_FOCUS_OUTLINE, PEER_FOCUS_OUTLINE_COLORS } from './focusClasses.js';

const OPTION_BASE = cx(
  'inline-flex h-controle w-full cursor-pointer items-center justify-center rounded border px-3',
  'text-rotulo transition-colors',
  PEER_FOCUS_OUTLINE,
);

const OPTION_SELECTED = cx(
  'border-marca-vermelho bg-marca-vermelho font-semibold text-neutro-branco',
  PEER_FOCUS_OUTLINE_COLORS.brand,
);

const OPTION_IDLE = cx(
  'border-neutro-bordaForte bg-neutro-branco font-medium text-neutro-tintaMedia',
  'hover:bg-neutro-superficie',
  PEER_FOCUS_OUTLINE_COLORS.neutral,
);

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Escolha unica entre poucas opcoes, todas visiveis ao mesmo tempo.
 *
 * Por baixo sao botoes de radio de verdade, escondidos so visualmente: o
 * agrupamento por `name`, o estado marcado e o anuncio em leitor de tela vem do
 * proprio navegador, e o realce de foco acompanha o radio em vez de ser
 * redesenhado a mao.
 *
 * As setas tambem sao tratadas aqui, e nao deixadas ao navegador. O radio
 * nativo ja anda com elas, mas cada navegador decide se a volta do ultimo para
 * o primeiro existe e se `Home` e `End` valem. Aqui a regra e uma so: as setas
 * andam e dao a volta, `Home` e `End` vao as pontas, e a opcao que recebe o
 * foco e a que fica marcada. O movimento nativo e cancelado para que a mesma
 * tecla nao ande duas casas.
 *
 * As opcoes quebram em linha em vez de repartir a largura em partes iguais, o
 * que serve a rotulo longo. `stretch` e a forma do rotulo curto, como a troca
 * de vista da tela estreita: ali as opcoes dividem a largura inteira.
 *
 * `hideLegend` guarda o titulo so para leitor de tela, para o grupo cujo
 * sentido ja esta dado pelo lugar onde ele fica.
 *
 * A altura acompanha a de controle da tela: 44 px onde ela pode ser tocada,
 * 32 px na tela larga.
 */
export default function SegmentedControl({
  legend,
  name,
  options,
  value,
  onChange,
  stretch = false,
  hideLegend = false,
  className,
}) {
  const groupRef = useRef(null);

  function handleKeyDown(event) {
    const currentIndex = options.findIndex((option) => option.value === value);
    const lastIndex = options.length - 1;
    let nextIndex = null;

    if (NEXT_KEYS.has(event.key)) {
      nextIndex = currentIndex >= lastIndex ? 0 : currentIndex + 1;
    } else if (PREVIOUS_KEYS.has(event.key)) {
      nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = lastIndex;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();

    const next = options[nextIndex];
    groupRef.current?.querySelectorAll('input[type="radio"]')[nextIndex]?.focus();

    if (next.value !== value) {
      onChange(next.value);
    }
  }

  return (
    <fieldset className={cx('min-w-0', className)}>
      <legend
        className={cx(
          hideLegend ? 'sr-only' : 'mb-2 text-rotulo font-semibold text-neutro-tinta lg:mb-1.5',
        )}
      >
        {legend}
      </legend>

      <div
        ref={groupRef}
        onKeyDown={handleKeyDown}
        className={stretch ? 'grid auto-cols-fr grid-flow-col gap-2' : 'flex flex-wrap gap-2'}
      >
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <label key={option.value} className="min-w-0">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span className={cx(OPTION_BASE, isSelected ? OPTION_SELECTED : OPTION_IDLE)}>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
