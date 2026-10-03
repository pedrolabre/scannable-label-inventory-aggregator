import { useId } from 'react';

import { cx } from '../../lib/cx.js';
import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';

import {
  ProductMarks,
  ProductName,
  ProductPrice,
  ProductTotal,
  productMarks,
} from './productDisplay.jsx';

const CELL_BASE = 'border-b border-neutro-divisor px-2 py-1 align-middle';

// Celula de uma linha so. A largura da coluna e fixa, entao o texto que nao
// cabe termina em reticencias em vez de alargar a tabela.
const SINGLE_LINE = 'overflow-hidden text-ellipsis whitespace-nowrap';

const NUMBER_CELL = cx(CELL_BASE, SINGLE_LINE, 'text-right tabular-nums');

/**
 * Uma linha da tabela do resumo por produto: codigo, nome com as etiquetas,
 * preco, quantidade e total.
 *
 * O nome e o botao que seleciona o produto: uma parada de `Tab` por linha, com
 * a altura de controle da tela, e as etiquetas descrevem o botao para quem usa
 * leitor de tela. O resto da linha tambem seleciona com o ponteiro, porque
 * mirar so no nome numa linha larga e pedir precisao a toa.
 *
 * As linhas pares ganham `neutro.papel`, para o olho seguir a linha de uma
 * ponta a outra. O produto selecionado troca a faixa pelo fundo de marca, o
 * nome fica em peso maior e o botao leva `aria-current`: a escolha nunca e
 * dita so pela cor.
 */
export default function ProductRow({ product, index, isSelected = false, onSelect }) {
  const marksId = useId();
  const hasMarks = productMarks(product).length > 0;

  function handleRowClick(event) {
    if (!event.target.closest('button')) {
      onSelect(product.systemCode);
    }
  }

  return (
    <tr
      data-produto={product.systemCode}
      onClick={handleRowClick}
      className={cx(
        'cursor-pointer transition-colors',
        isSelected && 'bg-marca-vermelhoTenue',
        !isSelected && index % 2 === 1 && 'bg-neutro-papel',
        !isSelected && 'hover:bg-neutro-superficie',
      )}
    >
      <td className={cx(CELL_BASE, SINGLE_LINE, 'tabular-nums text-neutro-tintaMedia')}>
        <span title={product.systemCode}>{product.systemCode}</span>
      </td>

      <td className={CELL_BASE}>
        <button
          type="button"
          aria-current={isSelected ? 'true' : undefined}
          aria-describedby={hasMarks ? marksId : undefined}
          onClick={() => onSelect(product.systemCode)}
          className={cx(
            'flex min-h-controle w-full min-w-0 items-center text-left text-neutro-tinta',
            isSelected ? 'font-bold' : 'font-semibold',
            FOCUS_OUTLINE,
            FOCUS_OUTLINE_COLORS.neutral,
          )}
        >
          <span className="truncate" title={product.displayName ?? undefined}>
            <ProductName product={product} />
          </span>
        </button>
        <ProductMarks product={product} id={marksId} className="pb-1" />
      </td>

      <td className={cx(NUMBER_CELL, 'text-neutro-tintaMedia')}>
        <ProductPrice product={product} />
      </td>

      <td className={cx(NUMBER_CELL, 'font-display text-neutro-tinta')}>{product.quantity}</td>

      <td className={cx(NUMBER_CELL, 'font-semibold text-neutro-tinta')}>
        <ProductTotal product={product} />
      </td>
    </tr>
  );
}
