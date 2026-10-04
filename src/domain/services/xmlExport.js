/**
 * Relatorio de inventario escrito como XML, para outro sistema ler.
 *
 * O arquivo leva tudo o que o relatorio tem, com a estrutura numerada em
 * `versao`: a sessao, os totais, os produtos com os exemplares aninhados e os
 * conflitos resolvidos com as variantes, os textos rejeitados inteiros, as
 * fotos com o estado e o motivo da falha, e as escolhas gravadas que deixaram
 * de valer. Qualquer mudanca de estrutura sobe a versao.
 *
 * Numero, codigo, identificador e frase curta saem em atributo; o texto que
 * vem da etiqueta (nome e texto lido) sai em elemento. Cada motivo leva o
 * codigo estavel, para filtrar, ao lado da frase em portugues. Valor ausente
 * (EAN, NCM, a variante sem o campo, total sem valor) deixa o atributo ou o
 * elemento de fora; quando o relatorio diz por que, o motivo entra no lugar.
 * As secoes saem sempre, mesmo vazias, para quem le distinguir "nenhum
 * rejeitado" de "arquivo cortado". A ordem e a do relatorio em todas elas.
 *
 * Fotos tiradas pela camera costumam ter o mesmo nome; por isso cada foto sai
 * com o identificador ao lado do nome, tambem no exemplar e no rejeitado.
 *
 * Valor monetario sai so em centavos inteiros. A hora da geracao sai local, com
 * o deslocamento do fuso que chega por parametro: nada aqui le o relogio nem o
 * fuso, e o mesmo relatorio com o mesmo deslocamento produz o mesmo texto.
 *
 * Relatorio com conflito aberto nao e exportado: o arquivo descreveria um
 * produto sem os dados que o operador ainda vai escolher.
 */

import { CONFLICT_STATUSES } from './reportSections.js';
import { formatLocalTimestamp } from './exportTimestamp.js';
import { TOTAL_VALUE_ISSUES, TOTAL_VALUE_ISSUE_MESSAGES } from './inventoryReport.js';
import { element, writeXml } from './xmlWriter.js';

export const XML_FORMAT_VERSION = '1';

/** Nome de cada campo LF1 no arquivo. */
export const XML_FIELD_NAMES = Object.freeze({
  version: 'versao',
  systemCode: 'codigo',
  displayName: 'nome',
  priceInCentavos: 'preco-centavos',
  ean: 'ean',
  ncm: 'ncm',
  copy: 'copia',
});

function fieldName(field) {
  return XML_FIELD_NAMES[field] ?? field;
}

function photoAttributes(sourceId, fileName, idName = 'foto-id', nameName = 'foto') {
  return [
    [idName, sourceId],
    [nameName, fileName],
  ];
}

function issueAttributes(prefix, code, message) {
  return [
    [`${prefix}-codigo`, code],
    [prefix, message],
  ];
}

function totalsElement(report) {
  const { header, totals } = report;
  const issue = totals.totalValueIssue;

  return element('totais', [
    ['fotos', header.sourceCount],
    ['fotos-com-falha', header.failedSourceCount],
    ['exemplares', totals.copyCount],
    ['produtos', totals.productCount],
    ['valor-total-centavos', totals.totalValueInCentavos],
    ...issueAttributes('valor-total-motivo', issue?.code, issue?.message),
    ['rejeitados', totals.rejectedCount],
    ['avisos', totals.warningCount],
    ['conflitos-resolvidos', totals.resolvedConflictCount],
    ['conflitos-abertos', totals.openConflictCount],
  ]);
}

/**
 * Por que o produto saiu sem total. Sem conflito aberto, o unico caso e o
 * total que passa do inteiro seguro.
 */
function productTotalIssue(product) {
  return product.totalOutOfRange ? TOTAL_VALUE_ISSUES.OUT_OF_RANGE : null;
}

function resolvedElement(conflict) {
  return element(
    'resolvido',
    [
      ['campo', fieldName(conflict.field)],
      ['valor', conflict.chosenValue],
    ],
    conflict.variants.map((variant) =>
      element('variante', [
        ['valor', variant.value],
        ['exemplares', variant.copyCount],
      ]),
    ),
  );
}

function copyElement(copy) {
  return element(
    'exemplar',
    [
      ['copia', copy.copy],
      ['leituras', copy.readingCount],
    ],
    [
      element('texto', [], copy.text),
      ...copy.sources.map((source) =>
        element('foto', photoAttributes(source.sourceId, source.fileName, 'id', 'nome')),
      ),
      ...copy.warnings.map((warning) =>
        element(
          'aviso',
          [
            ['tipo', warning.code],
            ...photoAttributes(warning.sourceId, warning.fileName),
            ['posicoes', warning.positionCount],
          ],
          warning.message,
        ),
      ),
    ],
  );
}

function productElement(product, copies, resolved) {
  const totalIssue = productTotalIssue(product);

  return element(
    'produto',
    [
      ['codigo', product.systemCode],
      ['quantidade', product.quantity],
      ['preco-centavos', product.priceInCentavos],
      ['total-centavos', product.totalInCentavos],
      ...issueAttributes('total-motivo', totalIssue, TOTAL_VALUE_ISSUE_MESSAGES[totalIssue]),
    ],
    [
      element('nome', [], product.displayName),
      product.ean === null ? null : element('ean', [], product.ean),
      product.ncm === null ? null : element('ncm', [], product.ncm),
      resolved.length === 0 ? null : element('resolvidos', [], resolved.map(resolvedElement)),
      element('exemplares', [], copies.map(copyElement)),
    ],
  );
}

function groupByCode(entries) {
  const groups = new Map();

  for (const entry of entries) {
    if (!groups.has(entry.systemCode)) {
      groups.set(entry.systemCode, []);
    }

    groups.get(entry.systemCode).push(entry);
  }

  return groups;
}

function productsElement(report) {
  const copiesByCode = groupByCode(report.copies);
  const resolvedByCode = groupByCode(
    report.conflicts.filter((conflict) => conflict.status === CONFLICT_STATUSES.RESOLVED),
  );

  return element(
    'produtos',
    [],
    report.products.map((product) =>
      productElement(
        product,
        copiesByCode.get(product.systemCode) ?? [],
        resolvedByCode.get(product.systemCode) ?? [],
      ),
    ),
  );
}

function rejectedElement(entry) {
  return element(
    'rejeitado',
    [
      ...photoAttributes(entry.sourceId, entry.fileName),
      ...issueAttributes('motivo', entry.reason, entry.message),
      ['campo', entry.field === null ? null : fieldName(entry.field)],
    ],
    [element('texto', [], entry.text)],
  );
}

function sourceElement(source) {
  return element(
    'foto',
    [
      ['id', source.sourceId],
      ['nome', source.fileName],
      ['origem', source.origin],
      ...issueAttributes('estado', source.status, source.statusMessage),
      ...issueAttributes('falha', source.failureReason, source.failureMessage),
      ['simbolos', source.symbolCount],
      ['validos', source.validCount],
      ['rejeitados', source.rejectedCount],
    ],
    source.warnings.map((warning) => element('aviso', [['tipo', warning.code]], warning.message)),
  );
}

function ignoredChoiceElement(choice) {
  return element('escolha', [
    ['codigo', choice.systemCode],
    ['campo', fieldName(choice.field)],
    ['valor', choice.value],
    ...issueAttributes('motivo', choice.reason, choice.message),
  ]);
}

/**
 * XML do relatorio. `offsetMinutes` e o deslocamento do fuso do aparelho no
 * instante da geracao, em minutos a leste de UTC (`-180` para `-03:00`).
 */
export function buildInventoryXml(report, { offsetMinutes }) {
  if (!report.exportable) {
    throw new TypeError('Relatório com conflito aberto não é exportado');
  }

  const { header } = report;

  return writeXml(
    element(
      'inventario',
      [
        ['versao', XML_FORMAT_VERSION],
        ['gerado-em', formatLocalTimestamp(header.generatedAt, offsetMinutes)],
      ],
      [
        element('sessao', [
          ['id', header.sessionId],
          ['nome', header.sessionName],
        ]),
        totalsElement(report),
        productsElement(report),
        element('rejeitados', [], report.rejected.map(rejectedElement)),
        element('fotos', [], report.sources.map(sourceElement)),
        element('escolhas-ignoradas', [], report.ignoredChoices.map(ignoredChoiceElement)),
      ],
    ),
  );
}
