import { useId } from 'react';

import { CONFLICT_STATUSES } from '../../domain/services/reportSections.js';
import { cx } from '../../lib/cx.js';
import { fieldList } from '../products/productDisplay.jsx';
import Button from '../ui/Button.jsx';
import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';
import InlineAlert from '../ui/InlineAlert.jsx';

import { fieldTitle, variantCopiesText, variantValueText } from './detailText.js';
import IgnoredChoiceNote from './IgnoredChoiceNote.jsx';
import { copyNumbersOf } from './productDetail.js';

/**
 * Um campo em conflito do produto escolhido: as variantes na ordem do
 * relatorio, cada uma com quantos exemplares a carregam e quais, e a escolha
 * do operador.
 *
 * Cada variante e um botao, e o escolhido fica marcado (`aria-pressed`). Um
 * grupo de opcao unica marcaria a opcao a cada seta, e cada seta gravaria uma
 * escolha no banco; com botoes, so o clique ou o `Enter` gravam. Tocar outra
 * variante num campo resolvido troca a escolha direto.
 *
 * Durante a gravacao o botao fica ocupado por `aria-disabled`, e nao por
 * `disabled`: o botao desligado perderia o foco no meio do gesto.
 */

const STATUS_TAGS = Object.freeze({
  [CONFLICT_STATUSES.OPEN]: {
    text: 'em aberto',
    tone: 'border-marca-vermelhoBorda bg-marca-vermelhoTenue text-marca-vermelhoTexto',
  },
  [CONFLICT_STATUSES.RESOLVED]: {
    text: 'resolvido',
    tone: 'border-neutro-borda bg-neutro-superficie text-neutro-tintaMedia',
  },
});

const VARIANT_BASE = cx(
  'flex min-h-controle w-full cursor-pointer flex-col items-start justify-center gap-0.5',
  'rounded border px-3 py-1.5 text-left text-sm transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-wait',
  FOCUS_OUTLINE,
);

const VARIANT_CHOSEN = cx(
  'border-marca-vermelho bg-marca-vermelhoTenue text-neutro-tinta',
  FOCUS_OUTLINE_COLORS.brand,
);

const VARIANT_IDLE = cx(
  'border-neutro-bordaForte bg-neutro-branco text-neutro-tinta hover:bg-neutro-superficie',
  FOCUS_OUTLINE_COLORS.neutral,
);

export default function ConflictField({
  conflict,
  copyNumbers,
  ignoredChoice = null,
  isBusy = false,
  isDisabled = false,
  error = null,
  onChoose,
  onUndo,
}) {
  const titleId = useId();
  const isResolved = conflict.status === CONFLICT_STATUSES.RESOLVED;
  const tag = STATUS_TAGS[conflict.status] ?? STATUS_TAGS[CONFLICT_STATUSES.OPEN];
  const chosenIndex = isResolved
    ? conflict.variants.findIndex((variant) => variant.value === conflict.chosenValue)
    : -1;

  return (
    <div data-campo={conflict.field} className="space-y-2">
      <p className="flex items-center justify-between gap-2">
        <span id={titleId} className="font-semibold text-neutro-tinta">
          {fieldTitle(conflict.field)}
        </span>
        <span
          data-situacao={conflict.status}
          className={cx('rounded border px-1.5 text-xs font-semibold leading-5', tag.tone)}
        >
          {tag.text}
        </span>
      </p>

      {ignoredChoice ? <IgnoredChoiceNote choice={ignoredChoice} /> : null}

      <div role="group" aria-labelledby={titleId} className="space-y-1.5">
        {conflict.variants.map((variant, index) => {
          const isChosen = index === chosenIndex;

          return (
            <button
              key={String(variant.value)}
              type="button"
              data-variante={index}
              aria-pressed={isChosen}
              aria-disabled={isBusy || undefined}
              disabled={isDisabled}
              className={cx(VARIANT_BASE, isChosen ? VARIANT_CHOSEN : VARIANT_IDLE)}
              onClick={() => onChoose(variant.value, index, isChosen)}
            >
              <span className="flex w-full items-baseline justify-between gap-2">
                <span
                  className={cx(
                    'min-w-0 break-words tabular-nums',
                    isChosen ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {variantValueText(conflict.field, variant.value)}
                </span>
                {isChosen ? (
                  <span aria-hidden="true" className="shrink-0 text-xs text-marca-vermelhoTexto">
                    escolhida
                  </span>
                ) : null}
              </span>
              <span className="break-words text-rotulo text-neutro-tintaFraca">
                {variantCopiesText(variant.copyCount, copyNumbersOf(variant.texts, copyNumbers))}
              </span>
            </button>
          );
        })}
      </div>

      {isResolved ? (
        <Button
          data-desfazer=""
          aria-label={`Desfazer escolha do ${fieldList([conflict.field])}`}
          aria-disabled={isBusy || undefined}
          disabled={isDisabled}
          onClick={() => onUndo(chosenIndex)}
        >
          Desfazer escolha
        </Button>
      ) : null}

      {error ? <InlineAlert>{error}</InlineAlert> : null}
    </div>
  );
}
