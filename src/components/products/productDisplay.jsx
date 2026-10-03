import { cx } from '../../lib/cx.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

/**
 * Pecas comuns as duas formas do resumo por produto, a tabela e os cartoes: o
 * nome, os valores em reais, o valor que falta com o motivo e as etiquetas de
 * conflito e de aviso.
 *
 * Nome e codigo vem de uma etiqueta fotografada e sao entrada nao confiavel:
 * aparecem sempre como texto, nunca como marcacao.
 *
 * O campo em conflito aberto chega `null` do relatorio, porque so o operador
 * escolhe a variante que vale. Ele aparece como travessao, e o motivo vai para
 * o nome acessivel e para a dica do ponteiro, como o valor total da linha de
 * estado.
 */

export const MISSING_MARK = '—';

const FIELD_LABELS = Object.freeze({
  displayName: 'nome',
  priceInCentavos: 'preço',
  ean: 'EAN',
  ncm: 'NCM',
});

const MISSING_REASONS = Object.freeze({
  name: 'nome em conflito',
  price: 'preço em conflito',
  outOfRange: 'o valor passa do limite de cálculo',
});

/** `nome`, `nome e preço`, `nome, preço e EAN`. */
export function fieldList(fields) {
  const labels = fields.map((field) => FIELD_LABELS[field] ?? field);

  if (labels.length <= 1) {
    return labels.join('');
  }

  return `${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}`;
}

/** Travessao visivel com o motivo no nome acessivel e na dica. */
export function MissingValue({ reason }) {
  return (
    <span title={`Indisponível: ${reason}`}>
      <span aria-hidden="true">{MISSING_MARK}</span>
      <span className="sr-only">indisponível: {reason}</span>
    </span>
  );
}

/** Nome do produto, ou o travessao quando ele esta em conflito aberto. */
export function ProductName({ product }) {
  if (product.displayName === null) {
    return <MissingValue reason={MISSING_REASONS.name} />;
  }

  return product.displayName;
}

/** Preco unitario em reais, ou o travessao com o motivo. */
export function ProductPrice({ product }) {
  const text = formatCentavosAsBRL(product.priceInCentavos);

  return text ?? <MissingValue reason={MISSING_REASONS.price} />;
}

/** Total em reais, ou o travessao com o motivo: preco em conflito ou fora do limite. */
export function ProductTotal({ product }) {
  const text = formatCentavosAsBRL(product.totalInCentavos);

  if (text !== null) {
    return text;
  }

  return (
    <MissingValue
      reason={product.totalOutOfRange ? MISSING_REASONS.outOfRange : MISSING_REASONS.price}
    />
  );
}

const MARK_TONES = Object.freeze({
  conflict: 'border-marca-vermelhoBorda bg-marca-vermelhoTenue text-marca-vermelhoTexto',
  warning: 'border-marca-amareloBorda bg-marca-amareloTenue text-marca-amareloTexto',
  resolved: 'border-neutro-borda bg-neutro-superficie text-neutro-tintaMedia',
});

/**
 * Etiquetas do produto, na ordem de urgencia: conflito aberto, aviso de
 * reimpressao, conflito resolvido. Cada uma diz o que e por escrito; a cor so
 * acompanha. Vermelho no conflito aberto, que bloqueia a exportacao; amarelo
 * no aviso; o resolvido fica neutro, para a tabela nao virar semaforo.
 */
export function productMarks(product) {
  const marks = [];

  if (product.openConflictFields.length > 0) {
    marks.push({
      kind: 'conflict',
      text: `conflito em ${fieldList(product.openConflictFields)}`,
    });
  }

  if (product.warningCount > 0) {
    marks.push({
      kind: 'warning',
      text:
        product.warningCount === 1
          ? '1 aviso de reimpressão'
          : `${product.warningCount} avisos de reimpressão`,
    });
  }

  if (product.resolvedFields.length > 0) {
    marks.push({
      kind: 'resolved',
      text: `resolvido em ${fieldList(product.resolvedFields)}`,
    });
  }

  return marks;
}

export function ProductMarks({ product, id, className }) {
  const marks = productMarks(product);

  if (marks.length === 0) {
    return null;
  }

  return (
    <span id={id} className={cx('flex flex-wrap gap-1', className)}>
      {marks.map((mark) => (
        <span
          key={mark.kind}
          data-marca={mark.kind}
          className={cx(
            'rounded border px-1.5 text-xs font-semibold leading-5',
            MARK_TONES[mark.kind],
          )}
        >
          {mark.text}
        </span>
      ))}
    </span>
  );
}
