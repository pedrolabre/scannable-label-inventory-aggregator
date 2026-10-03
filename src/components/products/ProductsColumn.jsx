import { useMemo, useState } from 'react';

import {
  buildProductSearchIndex,
  normalizeSearchText,
  searchProductIndex,
} from '../../domain/services/productSearch.js';
import ShellColumn, { ShellColumnTitle } from '../layout/ShellColumn.jsx';
import Button from '../ui/Button.jsx';

import ProductCards from './ProductCards.jsx';
import ProductSearchField, { SEARCH_FIELD_ID } from './ProductSearchField.jsx';
import ProductSummaryTable from './ProductSummaryTable.jsx';

const NO_PRODUCTS = Object.freeze([]);

function countHint(visible, total) {
  if (visible === total) {
    return total === 1 ? '1 produto' : `${total} produtos`;
  }

  return `${visible} de ${total} ${total === 1 ? 'produto' : 'produtos'}`;
}

/**
 * Coluna Produtos: o resumo por produto da sessao aberta, com a busca e a
 * contagem numa faixa fixa e a lista de ponta a ponta no corpo que rola. Com
 * duzentos produtos, um campo que subisse junto com a rolagem obrigaria a
 * voltar ao topo para trocar o termo.
 *
 * Os produtos chegam do relatorio, na ordem dele. O indice da busca e montado
 * uma vez por relatorio, e cada termo so filtra: digitar nao refaz o relatorio
 * nem o indice. O filtro e guardado pela forma comparavel do termo, e a lista
 * pelo resultado e pela selecao: a tecla que nao muda o termo comparavel (um
 * espaco no fim, outra caixa) redesenha so a faixa da busca.
 *
 * O termo vive aqui, porque so esta coluna o consome, e morre no
 * recarregamento. Quem monta a coluna troca a chave dela quando a sessao muda,
 * e o termo comeca vazio na sessao nova.
 *
 * A contagem do resultado fica ao lado do rotulo do campo e, com um termo
 * digitado, tambem numa regiao de estado, lida sem tirar o foco do campo.
 *
 * A tabela aparece a partir de `sm:`; abaixo disso, os cartoes. A selecao sobe
 * para quem montou a tela, que decide o que o Detalhe mostra.
 */
export default function ProductsColumn({
  products = NO_PRODUCTS,
  conflicts = NO_PRODUCTS,
  selectedCode = null,
  onSelect,
}) {
  const [query, setQuery] = useState('');

  const index = useMemo(() => buildProductSearchIndex(products, conflicts), [products, conflicts]);
  const term = normalizeSearchText(query);
  const visible = useMemo(() => searchProductIndex(index, term), [index, term]);

  const lists = useMemo(
    () => (
      <>
        <div className="hidden sm:block">
          <ProductSummaryTable products={visible} selectedCode={selectedCode} onSelect={onSelect} />
        </div>
        <div className="sm:hidden">
          <ProductCards products={visible} selectedCode={selectedCode} onSelect={onSelect} />
        </div>
      </>
    ),
    [visible, selectedCode, onSelect],
  );

  const hasProducts = products.length > 0;
  const hint = countHint(visible.length, products.length);

  // O botao do aviso sem resultado sai da tela junto com o aviso; o foco volta
  // ao campo, onde o operador digita o proximo termo.
  function clearFromNoMatch() {
    setQuery('');
    document.getElementById(SEARCH_FIELD_ID)?.focus();
  }

  const header = (
    <>
      <div className="flex items-center gap-3 px-recuo pb-1 pt-4 lg:pt-3">
        <ShellColumnTitle>Produtos</ShellColumnTitle>
      </div>

      {hasProducts ? (
        <div className="border-b border-neutro-borda px-recuo pb-3 pt-1 lg:pb-2.5">
          <ProductSearchField value={query} onChange={setQuery} hint={hint} />
          <p role="status" className="sr-only">
            {term === '' ? '' : hint}
          </p>
        </div>
      ) : null}
    </>
  );

  function renderBody() {
    if (!hasProducts) {
      return (
        <p data-estado-produtos="" className="p-recuo text-neutro-tintaFraca">
          Nenhum produto lido nesta sessão. Envie fotos das etiquetas em Entrada.
        </p>
      );
    }

    if (visible.length === 0) {
      return (
        <div data-sem-resultado="" className="space-y-3 p-recuo">
          <p className="text-neutro-tintaFraca">
            Nenhum produto com{' '}
            <span className="font-semibold text-neutro-tinta">{query.trim()}</span> no código, no
            nome ou no código de barras.
          </p>
          <Button onClick={clearFromNoMatch}>Limpar busca</Button>
        </div>
      );
    }

    return lists;
  }

  return (
    <ShellColumn label="Produtos" header={header} flush>
      {renderBody()}
    </ShellColumn>
  );
}
