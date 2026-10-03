import { cx } from '../../lib/cx.js';

import ProductRow from './ProductRow.jsx';

// A faixa de colunas e a unica parte da tabela que nao rola: ela gruda no topo
// do corpo da coluna, para que quem desce duzentos produtos continue sabendo o
// que cada coluna diz. `sticky` vai na propria celula, que aceita
// posicionamento em todos os navegadores; o `thead` nao.
const HEAD_CELL_BASE = cx(
  'sticky top-0 z-10 bg-neutro-superficie px-2 py-2.5 text-left lg:py-2',
  'border-b border-neutro-borda text-[11px] font-semibold uppercase',
  'tracking-[0.07em] text-neutro-tintaFraca',
);

const NUMBER_HEAD = 'text-right';

/**
 * Tabela do resumo por produto, usada a partir de `sm:`, na ordem do
 * relatorio. A tabela fica sobre branco e as linhas pares ganham a faixa de
 * `neutro.papel`.
 *
 * A largura das colunas e fixa, menos a do produto, que fica com o que sobrar:
 * a tabela nunca passa da largura da coluna e nunca rola de lado, e o nome
 * longo e o que cede, com reticencias.
 */
export default function ProductSummaryTable({ products, selectedCode = null, onSelect }) {
  return (
    <table className="w-full table-fixed border-collapse bg-neutro-branco text-sm">
      <caption className="sr-only">Resumo por produto</caption>

      <thead>
        <tr>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[112px] lg:w-[104px]')}>
            Código
          </th>
          <th scope="col" className={HEAD_CELL_BASE}>
            Produto
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, NUMBER_HEAD, 'w-[112px] lg:w-[104px]')}>
            Preço
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, NUMBER_HEAD, 'w-[64px] lg:w-[56px]')}>
            <span aria-hidden="true">Qtd.</span>
            <span className="sr-only">Quantidade</span>
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, NUMBER_HEAD, 'w-[128px] lg:w-[112px]')}>
            Total
          </th>
        </tr>
      </thead>

      <tbody>
        {products.map((product, index) => (
          <ProductRow
            key={product.systemCode}
            product={product}
            index={index}
            isSelected={product.systemCode === selectedCode}
            onSelect={onSelect}
          />
        ))}
      </tbody>
    </table>
  );
}
