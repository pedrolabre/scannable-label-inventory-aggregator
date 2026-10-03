import { MissingValue, ProductPrice, ProductTotal } from '../products/productDisplay.jsx';

import { conflictReason, copyCountText, variantValueText } from './detailText.js';

/**
 * Dados do produto escolhido, abaixo do nome: quantidade, preco unitario,
 * total, EAN e NCM. Os valores em reais passam pelas mesmas pecas da tabela.
 *
 * EAN e NCM `null` tem dois sentidos, e a tela diz qual: em conflito aberto o
 * travessao leva o motivo, como o preco; fora dele, o campo esta em branco em
 * todos os exemplares, ou o operador escolheu a variante sem o campo, e
 * aparece `sem EAN` ou `sem NCM`.
 */
function OptionalCode({ product, field }) {
  if (product[field] !== null) {
    return product[field];
  }

  return product.openConflictFields.includes(field) ? (
    <MissingValue reason={conflictReason(field)} />
  ) : (
    variantValueText(field, null)
  );
}

const ROWS = Object.freeze([
  ['Quantidade', (product) => copyCountText(product.quantity)],
  ['Preço', (product) => <ProductPrice product={product} />],
  ['Total', (product) => <ProductTotal product={product} />],
  ['EAN', (product) => <OptionalCode product={product} field="ean" />],
  ['NCM', (product) => <OptionalCode product={product} field="ncm" />],
]);

export default function ProductFacts({ product }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
      {ROWS.map(([label, valueOf]) => (
        <div key={label} data-dado={label} className="contents">
          <dt className="text-rotulo text-neutro-tintaFraca">{label}</dt>
          <dd className="break-all text-right tabular-nums text-neutro-tinta">
            {valueOf(product)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
