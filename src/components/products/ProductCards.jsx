import { cx } from '../../lib/cx.js';
import { FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';
import { useRovingFocus } from '../ui/useRovingFocus.js';

import { ProductMarks, ProductName, ProductPrice, ProductTotal } from './productDisplay.jsx';

// O cartao encosta nas bordas da regiao que rola, e um contorno por fora seria
// cortado por ela; aqui o realce de foco e desenhado para dentro.
const INSET_FOCUS_OUTLINE = cx(
  'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2',
);

/**
 * Resumo por produto abaixo de `sm:`, onde as cinco colunas da tabela nao
 * cabem lado a lado. Cada produto vira um cartao com o nome e o total na mesma
 * linha, o codigo e a conta de quantidade vezes preco embaixo, e as etiquetas
 * por ultimo.
 *
 * O cartao inteiro e o botao que seleciona o produto, um alvo de toque largo.
 * A ordem, as faixas, a marca do selecionado e o teclado sao os mesmos da
 * tabela: uma parada de `Tab` na lista, setas entre os cartoes, `Home` e `End`
 * nas pontas, e `Enter` ou `Espaco` para selecionar.
 */
export default function ProductCards({ products, selectedCode = null, onSelect }) {
  const roving = useRovingFocus({
    count: products.length,
    activeIndex: products.findIndex((product) => product.systemCode === selectedCode),
  });

  return (
    <ul
      ref={roving.containerRef}
      aria-label="Resumo por produto"
      onKeyDown={roving.onKeyDown}
      className="divide-y divide-neutro-divisor bg-neutro-branco"
    >
      {products.map((product, index) => {
        const isSelected = product.systemCode === selectedCode;

        return (
          <li
            key={product.systemCode}
            data-produto={product.systemCode}
            className={cx(
              isSelected && 'bg-marca-vermelhoTenue',
              !isSelected && index % 2 === 1 && 'bg-neutro-faixa',
            )}
          >
            <button
              type="button"
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => onSelect(product.systemCode)}
              {...roving.itemProps(index)}
              className={cx(
                'flex min-h-controle w-full items-start gap-3 px-recuo py-3 text-left',
                INSET_FOCUS_OUTLINE,
                FOCUS_OUTLINE_COLORS.neutral,
              )}
            >
              <span className="min-w-0 flex-1 space-y-1">
                <span
                  className={cx(
                    'block truncate text-neutro-tinta',
                    isSelected ? 'font-bold' : 'font-semibold',
                  )}
                >
                  <ProductName product={product} />
                </span>
                <span className="block truncate text-xs tabular-nums text-neutro-tintaFraca">
                  {product.systemCode}
                </span>
                <span className="block text-xs tabular-nums text-neutro-tintaFraca">
                  {product.quantity} × <ProductPrice product={product} />
                </span>
                <ProductMarks product={product} className="pt-1" />
              </span>

              <span className="shrink-0 font-semibold tabular-nums text-neutro-tinta">
                <ProductTotal product={product} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
