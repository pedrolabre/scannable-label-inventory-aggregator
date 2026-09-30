/**
 * Conteudo da sessao aberta sem uma foto: a fonte sai, e as leituras dela saem
 * junto. As resolucoes ficam como estao, gravadas por produto e nao por foto:
 * a escolha cujo produto sumiu passa a aparecer entre as ignoradas no
 * relatorio, e volta a valer se a foto for enviada de novo.
 *
 * Funcao pura sobre as listas em memoria; o banco ja foi alterado por quem a
 * chama.
 */
export function withoutSource({ sources, readings }, sourceId) {
  return {
    sources: sources.filter((source) => source.id !== sourceId),
    readings: readings.filter((reading) => reading.sourceId !== sourceId),
  };
}
