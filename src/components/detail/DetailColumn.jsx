import { useEffect, useMemo, useRef } from 'react';

import { cx } from '../../lib/cx.js';
import ShellColumn from '../layout/ShellColumn.jsx';
import { ProductMarks, ProductName } from '../products/productDisplay.jsx';
import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';

import ConflictResolver from './ConflictResolver.jsx';
import CopyList from './CopyList.jsx';
import { copyCountText } from './detailText.js';
import { productDetailOf } from './productDetail.js';
import ProductFacts from './ProductFacts.jsx';

/**
 * Coluna Detalhe: o produto escolhido na coluna Produtos, ou a frase de que
 * nenhum esta escolhido.
 *
 * A ordem e a da tarefa: quem e o produto (nome, codigo, etiquetas e dados),
 * o que pede decisao (os conflitos) e de onde veio a contagem (os exemplares,
 * com as fotos e os avisos). As secoes ficam sempre abertas; a coluna tem uma
 * regiao que rola, e so ela.
 *
 * Na tela estreita, escolher um produto troca a vista para esta coluna, e o
 * botao que recebeu o toque sai da tela. `focusRequest` muda a cada escolha
 * desse tipo, e o foco vem para o nome do produto, que e o que o leitor de tela
 * precisa anunciar. Na tela larga o foco fica na tabela, onde o operador
 * continua escolhendo.
 */
export default function DetailColumn({ report = null, product = null, focusRequest = 0 }) {
  const titleRef = useRef(null);
  const systemCode = product?.systemCode ?? null;
  const detail = useMemo(
    () => (report && systemCode !== null ? productDetailOf(report, systemCode) : null),
    [report, systemCode],
  );

  useEffect(() => {
    if (focusRequest > 0) {
      titleRef.current?.focus();
    }
  }, [focusRequest]);

  return (
    <ShellColumn title="Detalhe" bodyClassName="space-y-5">
      {product ? (
        <>
          <div className="space-y-2">
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
            <ProductMarks product={product} />
            <ProductFacts product={product} />
          </div>

          {detail ? (
            <>
              <ConflictResolver
                key={`${report.header.sessionId}:${product.systemCode}`}
                sessionId={report.header.sessionId}
                systemCode={product.systemCode}
                conflicts={detail.conflicts}
                ignoredChoices={detail.ignoredChoices}
                copies={detail.copies}
                fallbackFocusRef={titleRef}
              />

              <section aria-labelledby="detail-copies-title" className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h4
                    id="detail-copies-title"
                    className="text-rotulo font-semibold text-neutro-tintaMedia"
                  >
                    Exemplares
                  </h4>
                  <span className="text-rotulo tabular-nums text-neutro-tintaFraca">
                    {copyCountText(detail.copies.length)}
                  </span>
                </div>
                <CopyList copies={detail.copies} />
              </section>
            </>
          ) : null}
        </>
      ) : (
        <p data-estado-detalhe="" className="text-neutro-tintaFraca">
          Nenhum produto selecionado.
        </p>
      )}
    </ShellColumn>
  );
}
