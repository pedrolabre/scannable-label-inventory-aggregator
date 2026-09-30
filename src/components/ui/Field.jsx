import { cx } from '../../lib/cx.js';

const CONTROL_CLASSES = cx(
  'h-controle w-full rounded border px-3 text-sm shadow-none outline-none transition-colors',
  'border-neutro-bordaForte bg-neutro-branco text-neutro-tinta',
  'placeholder:text-neutro-tintaFraca focus-visible:ring-2',
);

/**
 * Cor de foco do campo: neutra no dado de apoio, marca no dado principal da
 * tela. O campo recusado troca as duas pelo vermelho do erro.
 */
const FOCUS_CLASSES = Object.freeze({
  neutral: 'focus-visible:border-neutro-tintaFraca focus-visible:ring-neutro-superficie',
  brand: 'focus-visible:border-marca-vermelho focus-visible:ring-marca-vermelhoTenue',
});

const INVALID_CLASSES = cx(
  'border-marca-vermelhoTexto',
  'focus-visible:border-marca-vermelhoTexto focus-visible:ring-marca-vermelhoTenue',
);

/** Campo de texto de uma linha, com a altura de controle da tela. */
export function TextInput({ focus = 'neutral', invalid = false, className, ...rest }) {
  return (
    <input
      type="text"
      aria-invalid={invalid || undefined}
      className={cx(
        CONTROL_CLASSES,
        FOCUS_CLASSES[focus] ?? FOCUS_CLASSES.neutral,
        invalid && INVALID_CLASSES,
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Rotulo, controle e mensagens de um campo. O controle chega por funcao e
 * recebe de volta `id`, `aria-describedby` e `invalid` ja resolvidos, entao o
 * vinculo de acessibilidade fica descrito num lugar so. `hint` fica na linha do
 * rotulo, como o contador de caracteres; `error` fica abaixo do controle.
 */
export default function Field({ id, label, error, hint, children }) {
  const hintId = hint ? `${id}-dica` : null;
  const errorId = error ? `${id}-erro` : null;
  const describedBy = cx(errorId, hintId);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-rotulo font-semibold text-neutro-tinta"
      >
        <span>{label}</span>
        {hint ? (
          <span id={hintId} className="font-normal tabular-nums text-neutro-tintaFraca">
            {hint}
          </span>
        ) : null}
      </label>

      {children({
        id,
        invalid: Boolean(error),
        'aria-describedby': describedBy || undefined,
      })}

      {error ? (
        <p id={errorId} className="text-rotulo text-marca-vermelhoTexto">
          {error}
        </p>
      ) : null}
    </div>
  );
}
