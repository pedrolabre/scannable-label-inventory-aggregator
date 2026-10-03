import { fieldList } from '../products/productDisplay.jsx';
import Button from '../ui/Button.jsx';

import { fieldTitle, ignoredChoiceText } from './detailText.js';

/**
 * Escolha gravada que a tela ignora, com o valor e o motivo do relatorio. E
 * aviso, e por isso amarelo: a escolha continua no banco e volta a valer se as
 * leituras voltarem a divergir do mesmo jeito.
 *
 * `onDiscard` so vem quando descartar e o unico caminho para tira-la: no campo
 * que deixou de divergir nao ha variante para escolher por cima. `withTitle`
 * repete o campo quando a nota aparece fora da area do proprio conflito.
 */
export default function IgnoredChoiceNote({
  choice,
  withTitle = false,
  onDiscard,
  isBusy = false,
  isDisabled = false,
}) {
  return (
    <div
      data-escolha-ignorada={choice.reason}
      className="space-y-2 border-l-2 border-marca-amareloTexto pl-3"
    >
      <p className="break-words text-rotulo text-marca-amareloTexto">
        {withTitle ? <span className="font-semibold">{fieldTitle(choice.field)}: </span> : null}
        {ignoredChoiceText(choice)}
      </p>

      {onDiscard ? (
        <Button
          data-descartar=""
          aria-label={`Descartar escolha do ${fieldList([choice.field])}`}
          aria-disabled={isBusy || undefined}
          disabled={isDisabled}
          onClick={onDiscard}
        >
          Descartar escolha
        </Button>
      ) : null}
    </div>
  );
}
