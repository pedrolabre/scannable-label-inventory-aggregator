/**
 * Busca no resumo por produto da sessao.
 *
 * A comparacao e outra que a do contrato e a dos conflitos, e de proposito: la
 * `CAFÉ` e `CAFE` sao valores diferentes, porque o texto da etiqueta e a
 * verdade; aqui sao o mesmo produto procurado, porque quem digita no telefone
 * nao acerta o acento nem a caixa que a etiqueta usou.
 *
 * A ordem do resultado e a da lista recebida, a do relatorio: a busca so
 * filtra, nunca reordena.
 */

const DIACRITICS = /\p{Diacritic}/gu;

/**
 * Forma comparavel de um texto: sem acentuacao, em caixa baixa e sem espacos
 * nas pontas. O que nao e texto vira texto vazio.
 */
export function normalizeSearchText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim();
}

// Onde a busca entra: o codigo do sistema, o nome impresso e o codigo de
// barras. Preco e NCM ficam de fora para que o campo continue procurando um
// produto, e nao uma faixa de valores.
const SEARCHABLE_FIELDS = Object.freeze(['systemCode', 'displayName', 'ean']);

/**
 * Valores das variantes de cada produto nos campos pesquisaveis. O campo em
 * conflito aberto sai `null` no resumo, e sem isto o produto sumiria da busca
 * pelo nome justamente quando o operador precisa encontra-lo.
 */
function variantTextsByCode(conflicts) {
  const texts = new Map();

  for (const conflict of conflicts) {
    if (!SEARCHABLE_FIELDS.includes(conflict.field)) {
      continue;
    }

    const list = texts.get(conflict.systemCode) ?? [];

    for (const variant of conflict.variants) {
      list.push(variant.value);
    }

    texts.set(conflict.systemCode, list);
  }

  return texts;
}

/**
 * Resumo pronto para a busca: os produtos na ordem recebida e, para cada um, a
 * forma comparavel dos campos pesquisaveis e das variantes deles. Montado uma
 * vez por relatorio; cada termo so filtra.
 */
export function buildProductSearchIndex(products, conflicts = []) {
  const variants = variantTextsByCode(conflicts);

  return {
    products,
    searchable: products.map((product) =>
      [
        ...SEARCHABLE_FIELDS.map((field) => product[field]),
        ...(variants.get(product.systemCode) ?? []),
      ]
        .map(normalizeSearchText)
        .filter((text) => text !== ''),
    ),
  };
}

/**
 * Produtos que contem o termo em algum texto pesquisavel, na ordem do indice.
 * Termo vazio, ou so de espacos, devolve a propria lista do indice.
 */
export function searchProductIndex(index, query) {
  const term = normalizeSearchText(query);

  if (term === '') {
    return index.products;
  }

  return index.products.filter((_, position) =>
    index.searchable[position].some((text) => text.includes(term)),
  );
}
