/**
 * Relatorio de inventario descrito como documento A4, para leitura.
 *
 * O documento leva o cabecalho da sessao com a data e a hora locais e o
 * deslocamento do fuso, os totais, o resumo por produto, os conflitos
 * resolvidos com o valor escolhido e as variantes, os exemplares, os textos
 * rejeitados, as fotos com o estado e o motivo da falha, e as escolhas gravadas
 * que deixaram de valer. Os conflitos resolvidos, as fotos e as escolhas
 * ignoradas so aparecem quando tem linha; o resumo, os exemplares e os
 * rejeitados saem sempre, com uma frase quando vazios. A ordem e a do
 * relatorio em todas as secoes.
 *
 * Valor monetario sai em reais, escrito pelo formatador recebido
 * (`formatCentavos`), e numero nunca e cortado. Valor ausente sai como
 * travessao, e o motivo, quando o relatorio o traz, vai numa frase abaixo dos
 * totais ou do resumo. Nome, texto lido e nome de foto vem da etiqueta e do
 * aparelho: passam pela regra dos caracteres da fonte, e quantos foram
 * trocados sai numa nota no fim.
 *
 * A descricao e pura. Recebe o relatorio, o deslocamento do fuso em minutos e
 * o formatador; nao le relogio nem fuso, e a mesma entrada da a mesma
 * descricao. A data de criacao do arquivo, o titulo e o assunto saem daqui,
 * prontos para o adaptador.
 */

import { COPY_WARNING_MESSAGES } from './copyIdentity.js';
import { formatLocalTimestamp } from './exportTimestamp.js';
import { TOTAL_VALUE_ISSUES, TOTAL_VALUE_ISSUE_MESSAGES } from './inventoryReport.js';
import {
  COPY_COLUMNS,
  IGNORED_COLUMNS,
  REJECTED_COLUMNS,
  RESOLVED_COLUMNS,
  SOURCE_COLUMNS,
  SUMMARY_COLUMNS,
} from './reportColumns.js';
import { CONFLICT_STATUSES } from './reportSections.js';
import {
  CONTENT_WIDTH_MM,
  FONT_SIZES,
  MARGIN_MM,
  createLayout,
  finishLayout,
  heading,
  paragraph,
  tableSection,
  textOp,
} from './reportLayout.js';
import { textWidthMm, toFontText, wrapText } from './reportText.js';

/** Valor ausente numa celula ou nos totais. */
export const MISSING_VALUE = '—';

const DOCUMENT_TITLE = 'Relatório de inventário';

const UNNAMED_FILE = 'foto sem nome';

const FIELD_LABELS = Object.freeze({
  displayName: 'nome',
  priceInCentavos: 'preço',
  ean: 'EAN',
  ncm: 'NCM',
});

const ORIGIN_LABELS = Object.freeze({ camera: 'câmera', file: 'arquivo' });

const INTEGER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const TOTALS_ROW_MM = 4.4;
const TOTALS_VALUE_WIDTH_MM = 84;

function count(value) {
  return INTEGER.format(value);
}

function withCount(title, rows) {
  return `${title} (${count(rows.length)})`;
}

/** Contador das trocas de caractere: cada texto de fora passa por aqui uma vez. */
function createCleaner() {
  const cleaner = (value) => {
    const { text, replaced } = toFontText(value);

    cleaner.replaced += replaced;

    return text;
  };

  cleaner.replaced = 0;

  return cleaner;
}

function money(centavos, formatCentavos) {
  if (centavos === null || centavos === undefined) {
    return MISSING_VALUE;
  }

  return formatCentavos(centavos) ?? MISSING_VALUE;
}

function fieldValue(field, value, { clean, formatCentavos }) {
  if (value === null || value === undefined) {
    return MISSING_VALUE;
  }

  return field === 'priceInCentavos' ? money(value, formatCentavos) : clean(value);
}

function fileName(name, clean) {
  return name ? clean(name) : UNNAMED_FILE;
}

/**
 * `06/10/2026 às 17:03:48 (UTC-03:00)` e `D:20261006170348-03'00'` do mesmo
 * instante, no deslocamento recebido.
 */
export function describeGeneratedAt(generatedAt, offsetMinutes) {
  const local = formatLocalTimestamp(generatedAt, offsetMinutes);
  const [, year, month, day, time, offset] = local.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})$/,
  );
  const [offsetHours, offsetMinutesText] = offset.split(':');

  return {
    text: `${day}/${month}/${year} às ${time} (UTC${offset})`,
    creationDate: `D:${year}${month}${day}${time.replaceAll(':', '')}${offsetHours}'${offsetMinutesText}'`,
  };
}

function titleBlock(layout, sessionName, generatedText) {
  layout.ops.push(
    textOp(DOCUMENT_TITLE, MARGIN_MM, layout.yMm + 5, { fontSizePt: FONT_SIZES.title, bold: true }),
  );
  layout.yMm += 8;

  for (const line of wrapText(sessionName, CONTENT_WIDTH_MM, FONT_SIZES.subtitle, false, 2)) {
    layout.ops.push(textOp(line, MARGIN_MM, layout.yMm + 3.6, { fontSizePt: FONT_SIZES.subtitle }));
    layout.yMm += 4.8;
  }

  paragraph(layout, `Gerado em ${generatedText}`);
}

function totalsBlock(layout, report, formatCentavos) {
  const { header, totals } = report;
  const pairs = [
    ['Fotos processadas', count(header.sourceCount), 'Exemplares', count(totals.copyCount)],
    ['Fotos com falha', count(header.failedSourceCount), 'Produtos', count(totals.productCount)],
    [
      'Rejeitados',
      count(totals.rejectedCount),
      'Valor total',
      money(totals.totalValueInCentavos, formatCentavos),
    ],
    [
      'Avisos de reimpressão',
      count(totals.warningCount),
      'Conflitos resolvidos',
      count(totals.resolvedConflictCount),
    ],
  ];
  const halfMm = CONTENT_WIDTH_MM / 2;

  heading(layout, 'Totais', pairs.length * TOTALS_ROW_MM);

  for (const [leftLabel, leftValue, rightLabel, rightValue] of pairs) {
    const baseline = layout.yMm + 3;

    [
      [leftLabel, leftValue, MARGIN_MM],
      [rightLabel, rightValue, MARGIN_MM + halfMm],
    ].forEach(([label, value, xMm]) => {
      layout.ops.push(textOp(label, xMm, baseline));
      layout.ops.push(
        textOp(value, xMm + TOTALS_VALUE_WIDTH_MM - valueWidth(value), baseline, { bold: true }),
      );
    });
    layout.yMm += TOTALS_ROW_MM;
  }

  if (totals.totalValueIssue) {
    paragraph(layout, `Valor total não calculado: ${totals.totalValueIssue.message}.`);
  }
}

/** Largura do valor dos totais, escrito em negrito. */
function valueWidth(value) {
  return textWidthMm(value, FONT_SIZES.body, true);
}

function summarySection(layout, report, context) {
  const { clean, formatCentavos } = context;
  const rows = report.products.map((product) => [
    clean(product.systemCode),
    clean(product.displayName),
    money(product.priceInCentavos, formatCentavos),
    count(product.quantity),
    money(product.totalInCentavos, formatCentavos),
    product.ean === null ? MISSING_VALUE : clean(product.ean),
    product.ncm === null ? MISSING_VALUE : clean(product.ncm),
  ]);

  tableSection(layout, {
    title: withCount('Resumo por produto', rows),
    columns: SUMMARY_COLUMNS,
    rows,
    empty: 'Nenhum produto nesta sessão.',
  });

  if (report.products.some((product) => product.totalOutOfRange)) {
    paragraph(
      layout,
      `Total não calculado (${MISSING_VALUE}): ${TOTAL_VALUE_ISSUE_MESSAGES[TOTAL_VALUE_ISSUES.OUT_OF_RANGE]}.`,
    );
  }
}

function resolvedSection(layout, report, context) {
  const resolved = report.conflicts.filter(
    (conflict) => conflict.status === CONFLICT_STATUSES.RESOLVED,
  );

  if (resolved.length === 0) {
    return;
  }

  const rows = resolved.map((conflict) => [
    context.clean(conflict.systemCode),
    FIELD_LABELS[conflict.field] ?? conflict.field,
    fieldValue(conflict.field, conflict.chosenValue, context),
    conflict.variants
      .map(
        (variant) =>
          `${fieldValue(conflict.field, variant.value, context)} (${count(variant.copyCount)})`,
      )
      .join(' · '),
  ]);

  tableSection(layout, {
    title: withCount('Conflitos resolvidos', rows),
    columns: RESOLVED_COLUMNS,
    rows,
  });
}

function copiesSection(layout, report, { clean }) {
  const rows = report.copies.map((copy) => [
    clean(copy.systemCode),
    clean(copy.copy),
    count(copy.readingCount),
    copy.sources.map((source) => fileName(source.fileName, clean)).join(', '),
    copy.warnings
      .map(
        (warning) =>
          `${COPY_WARNING_MESSAGES[warning.code] ?? warning.message} (${fileName(warning.fileName, clean)})`,
      )
      .join(' / '),
    clean(copy.text),
  ]);

  tableSection(layout, {
    title: withCount('Exemplares', rows),
    columns: COPY_COLUMNS,
    rows,
    empty: 'Nenhum exemplar nesta sessão.',
  });
}

function rejectedSection(layout, report, { clean }) {
  const rows = report.rejected.map((entry) => [
    fileName(entry.fileName, clean),
    entry.message,
    clean(entry.displayText),
  ]);

  tableSection(layout, {
    title: withCount('Textos rejeitados', rows),
    columns: REJECTED_COLUMNS,
    rows,
    empty: 'Nenhum texto rejeitado.',
  });
}

function sourcesSection(layout, report, { clean }) {
  if (report.sources.length === 0) {
    return;
  }

  const rows = report.sources.map((source) => [
    fileName(source.fileName, clean),
    ORIGIN_LABELS[source.origin] ?? clean(source.origin),
    source.statusMessage,
    count(source.symbolCount),
    count(source.validCount),
    count(source.rejectedCount),
    source.failureMessage ?? source.warnings.map((warning) => warning.message).join(' / '),
  ]);

  tableSection(layout, { title: withCount('Fotos', rows), columns: SOURCE_COLUMNS, rows });
}

function ignoredSection(layout, report, context) {
  if (report.ignoredChoices.length === 0) {
    return;
  }

  const rows = report.ignoredChoices.map((choice) => [
    context.clean(choice.systemCode),
    FIELD_LABELS[choice.field] ?? choice.field,
    fieldValue(choice.field, choice.value, context),
    choice.message,
  ]);

  tableSection(layout, {
    title: withCount('Escolhas ignoradas', rows),
    columns: IGNORED_COLUMNS,
    rows,
  });
}

function replacementNote(layout, replaced) {
  if (replaced === 0) {
    return;
  }

  const subject =
    replaced === 1
      ? '1 caractere fora da fonte do PDF saiu'
      : `${count(replaced)} caracteres fora da fonte do PDF saíram`;

  heading(layout, 'Observação');
  paragraph(layout, `${subject} como ?. O CSV e o XML levam o texto original.`);
}

/**
 * Descricao do documento: `{ title, subject, creationDate, replacedCount,
 * pages }`, com as paginas em milimetro e as operacoes `text` e `line`.
 * `offsetMinutes` e o deslocamento do fuso no instante da geracao, em minutos
 * a leste de UTC; `formatCentavos` escreve um inteiro de centavos em reais.
 */
export function describeReportDocument(report, { offsetMinutes, formatCentavos }) {
  if (!report.exportable) {
    throw new TypeError('Relatório com conflito aberto não é exportado');
  }

  const clean = createCleaner();
  const context = { clean, formatCentavos };
  const generated = describeGeneratedAt(report.header.generatedAt, offsetMinutes);
  const sessionName = clean(report.header.sessionName);
  const layout = createLayout();

  titleBlock(layout, sessionName, generated.text);
  totalsBlock(layout, report, formatCentavos);
  summarySection(layout, report, context);
  resolvedSection(layout, report, context);
  copiesSection(layout, report, context);
  rejectedSection(layout, report, context);
  sourcesSection(layout, report, context);
  ignoredSection(layout, report, context);
  replacementNote(layout, clean.replaced);

  return Object.freeze({
    title: `${DOCUMENT_TITLE} - ${sessionName}`,
    subject: `Inventário gerado em ${generated.text}`,
    creationDate: generated.creationDate,
    replacedCount: clean.replaced,
    pages: Object.freeze(finishLayout(layout, sessionName)),
  });
}
