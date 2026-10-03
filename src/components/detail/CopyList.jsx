import { readingCountText } from './detailText.js';
import SourceRefs from './SourceRefs.jsx';
import WarningList from './WarningList.jsx';

/**
 * Exemplares do produto escolhido, na ordem do relatorio: o `cN`, quantas
 * vezes foi lido, as fotos de origem, o aviso de reimpressao e o texto LF1
 * inteiro.
 *
 * O texto fica a vista, menor, porque e ele que distingue dois exemplares com
 * o mesmo `cN` e dados diferentes, como a etiqueta reimpressa depois de uma
 * mudanca de preco. Ele vem da etiqueta fotografada e aparece como texto.
 */
export default function CopyList({ copies }) {
  return (
    <ul
      aria-label="Exemplares do produto"
      className="divide-y divide-neutro-divisor border-y border-neutro-divisor"
    >
      {copies.map((copy) => (
        <li key={copy.text} data-exemplar={copy.copy} className="space-y-1 py-2">
          <p className="flex items-baseline justify-between gap-3">
            <span className="font-display font-semibold text-neutro-tinta">{copy.copy}</span>
            <span className="text-rotulo tabular-nums text-neutro-tintaFraca">
              {readingCountText(copy.readingCount)}
            </span>
          </p>
          <SourceRefs sources={copy.sources} />
          <WarningList warnings={copy.warnings} />
          <p data-texto-exemplar="" className="break-all text-xs text-neutro-tintaFraca">
            {copy.text}
          </p>
        </li>
      ))}
    </ul>
  );
}
