import { useEffect, useRef } from 'react';

import { cx } from '../../lib/cx.js';
import ShellColumn from '../layout/ShellColumn.jsx';
import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';
import { ProductName } from '../products/productDisplay.jsx';

/**
 * Coluna Detalhe: o produto escolhido na coluna Produtos, pelo nome e pelo
 * codigo, ou a frase de que nenhum esta escolhido.
 *
 * Na tela estreita, escolher um produto troca a vista para esta coluna, e o
 * botao que recebeu o toque sai da tela. `focusRequest` muda a cada escolha
 * desse tipo, e o foco vem para o nome do produto, que e o que o leitor de tela
 * precisa anunciar. Na tela larga o foco fica na tabela, onde o operador
 * continua escolhendo.
 */
export default function DetailColumn({ product = null, focusRequest = 0 }) {
  const titleRef = useRef(null);

  useEffect(() => {
    if (focusRequest > 0) {
      titleRef.current?.focus();
    }
  }, [focusRequest]);

  return (
    <ShellColumn title="Detalhe" bodyClassName="space-y-2">
      {product ? (
        <>
          <p data-estado-detalhe="" className="text-rotulo text-neutro-tintaFraca">
            Produto selecionado
          </p>
          <h3
            ref={titleRef}
            tabIndex={-1}
            data-produto-selecionado={product.systemCode}
            className={cx(
              'break-words font-display text-base font-semibold text-neutro-tinta',
              FOCUS_OUTLINE,
              FOCUS_OUTLINE_COLORS.neutral,
            )}
          >
            <ProductName product={product} />
          </h3>
          <p className="break-all tabular-nums text-neutro-tintaMedia">
            <span className="text-neutro-tintaFraca">Código </span>
            {product.systemCode}
          </p>
        </>
      ) : (
        <p data-estado-detalhe="" className="text-neutro-tintaFraca">
          Nenhum produto selecionado.
        </p>
      )}
    </ShellColumn>
  );
}
