import { formatCentavosAsBRL } from '../../lib/currency.js';

/**
 * Faixa de leitura ao pe da tela: o tamanho da sessao aberta, em numero.
 *
 * Ela nao tem acao nenhuma, e isso e a decisao, nao um detalhe: uma faixa que
 * so informa nao vira a gaveta do botao que nao achou lugar.
 *
 * Os numeros chegam prontos do relatorio da sessao, o mesmo que a tela e as
 * exportacoes leem. Sem sessao aberta, ou enquanto ela carrega, tudo e zero. O
 * valor total fica sem numero quando o relatorio nao o fecha (preco em
 * conflito aberto ou soma acima do limite), e o motivo vai para o nome
 * acessivel e para a dica do ponteiro.
 *
 * Abaixo do ponto de corte cada item e um numero sobre o rotulo, para os cinco
 * caberem numa janela de telefone; a partir dele, rotulo e numero dividem a
 * linha. `conflitos abertos` encurta para `conflitos` na tela estreita so na
 * vista: o nome lido continua inteiro.
 */

const EMPTY_TOTALS = Object.freeze({
  copyCount: 0,
  productCount: 0,
  totalValueInCentavos: 0,
  totalValueIssue: null,
  openConflictCount: 0,
});

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

function Item({ value, label, labelSuffix, hiddenNote, title, name }) {
  return (
    <div
      data-status={name}
      title={title}
      className="flex min-w-0 flex-col items-center lg:flex-row lg:items-baseline lg:gap-1.5"
    >
      <dd className="order-1 font-display font-semibold tabular-nums text-neutro-tinta lg:order-2">
        {value}
      </dd>
      <dt className="order-2 truncate lg:order-1">
        {label}
        {labelSuffix ? <span className="max-lg:sr-only">{labelSuffix}</span> : null}
        {hiddenNote ? <span className="sr-only">{hiddenNote}</span> : null}
      </dt>
    </div>
  );
}

export default function StatusBar({ sourceCount = 0, totals = null }) {
  const current = totals ?? EMPTY_TOTALS;
  const issue = current.totalValueIssue;
  const value = issue ? '—' : formatCentavosAsBRL(current.totalValueInCentavos);

  return (
    <footer
      aria-label="Resumo da sessão"
      className="flex h-estado flex-none items-center border-t border-neutro-borda bg-neutro-branco px-recuo text-xs text-neutro-tintaFraca"
    >
      <dl className="flex w-full min-w-0 items-center justify-between gap-3 lg:justify-start lg:gap-6">
        <Item name="fotos" value={sourceCount} label={plural(sourceCount, 'foto', 'fotos')} />
        <Item
          name="exemplares"
          value={current.copyCount}
          label={plural(current.copyCount, 'exemplar', 'exemplares')}
        />
        <Item
          name="produtos"
          value={current.productCount}
          label={plural(current.productCount, 'produto', 'produtos')}
        />
        <Item
          name="valor"
          value={value}
          label="valor total"
          hiddenNote={issue ? `, indisponível: ${issue.message}` : null}
          title={issue ? `Valor total indisponível: ${issue.message}` : undefined}
        />
        <Item
          name="conflitos"
          value={current.openConflictCount}
          label={plural(current.openConflictCount, 'conflito', 'conflitos')}
          labelSuffix={plural(current.openConflictCount, ' aberto', ' abertos')}
        />
      </dl>
    </footer>
  );
}
