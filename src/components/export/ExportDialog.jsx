import { Download } from 'lucide-react';

import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import FileRow from './FileRow.jsx';
import {
  PDF_RUNNING_TEXT,
  blockerText,
  doneText,
  emptySessionText,
  firstOpenConflictCode,
  missingProductChoicesOf,
  missingProductText,
} from './exportText.js';
import {
  CSV_FILES,
  EXPORT_STATUS,
  PDF_FILE,
  XML_FILE,
  useReportExport,
} from './useReportExport.js';

/**
 * Exportacao do relatorio da sessao aberta, gerada no aparelho.
 *
 * Cada formato e uma secao com os proprios arquivos. O CSV tem dois: o resumo
 * por produto e os exemplares, cada um no proprio botao, porque um clique que
 * baixa dois arquivos de uma vez esbarra na permissao de downloads multiplos
 * do navegador.
 *
 * O XML e um arquivo so, com o relatorio inteiro, para outro sistema ler. O PDF
 * e o relatorio em paginas A4, para ler e arquivar.
 *
 * Com conflito aberto os arquivos ficam desligados, com a frase do bloqueio e
 * a contagem; `Revisar conflitos` leva ao primeiro produto que pede decisao
 * (`onReviewConflicts`, que fecha o dialogo). Sessao sem produto nao gera CSV,
 * que sairia so com o cabecalho, mas gera o XML e o PDF, que levam as fotos e
 * os textos rejeitados; sessao sem foto nao gera nada.
 *
 * Escolha gravada de produto que sumiu das leituras nao aparece em nenhuma
 * outra tela; aqui ela vira aviso, sem bloquear, porque nao muda o resumo nem
 * os exemplares. O XML e o PDF a levam entre as escolhas ignoradas.
 *
 * Depois do download o dialogo continua aberto, com o nome do arquivo gerado,
 * para o operador baixar o outro arquivo se quiser. O foco fica no botao
 * tocado. A falha aparece junto dos botoes.
 *
 * O PDF leva um instante para sair. Enquanto ele e gerado, os outros botoes
 * ficam desligados e o do PDF diz `Gerando PDF…`, marcado como indisponivel sem
 * ser desligado: um botao desligado perde o foco, e o foco fica onde o
 * operador tocou.
 *
 * `now`, `download` e `renderPdf` seguem para `useReportExport`; sem eles
 * valem o relogio, o download do navegador e a escrita do PDF.
 */

const BLOCKER_ID = 'export-blocker';
const EMPTY_ID = 'export-empty';

function SectionTitle({ id, title, description }) {
  return (
    <div className="space-y-1">
      <h3 id={id} className="font-display text-base font-semibold text-neutro-tinta">
        {title}
      </h3>
      <p className="text-rotulo text-neutro-tintaFraca">{description}</p>
    </div>
  );
}

export default function ExportDialog({
  report,
  onClose,
  onReviewConflicts,
  now,
  download,
  renderPdf,
}) {
  const { status, file, fileName, error, exportFile } = useReportExport({
    now,
    download,
    renderPdf,
  });

  const blocker = report.exportBlockers[0] ?? null;
  const emptyText = blocker ? null : emptySessionText(report);
  const hasPhotos = report.header.sourceCount > 0;
  const hasProducts = report.products.length > 0;
  const missingChoices = missingProductChoicesOf(report);
  const reviewCode = blocker ? firstOpenConflictCode(report) : null;
  const isRunning = status === EXPORT_STATUS.RUNNING;
  const pdfRunning = isRunning && file === PDF_FILE;
  const describedBy = (enabled) => {
    if (blocker) {
      return BLOCKER_ID;
    }

    return enabled ? undefined : EMPTY_ID;
  };
  // O botao do arquivo em andamento continua focavel; os outros desligam.
  const lockOf = (key, enabled) => {
    const busy = isRunning && file === key;

    return {
      disabled: Boolean(blocker) || !enabled || (isRunning && !busy),
      'aria-disabled': busy ? 'true' : undefined,
      'aria-describedby': describedBy(enabled),
      onClick: () => exportFile(report, key),
    };
  };

  return (
    <ModalShell title="Exportar relatório" subtitle={report.header.sessionName} onClose={onClose}>
      <div className="space-y-5 text-sm">
        {blocker ? (
          <div
            data-bloqueio-exportacao={blocker.count}
            className="space-y-2 border-l-2 border-marca-amareloTexto pl-3"
          >
            <p id={BLOCKER_ID} className="font-semibold text-marca-amareloTexto">
              {blockerText(blocker)}
            </p>
            <p className="text-rotulo text-neutro-tintaMedia">
              Escolha a variante de cada campo em conflito no Detalhe do produto para liberar os
              arquivos.
            </p>
            {reviewCode !== null && onReviewConflicts ? (
              <Button data-revisar-conflitos="" onClick={() => onReviewConflicts(reviewCode)}>
                Revisar conflitos
              </Button>
            ) : null}
          </div>
        ) : null}

        {emptyText ? (
          <p
            id={EMPTY_ID}
            data-sessao-vazia={hasPhotos ? 'sem-produto' : 'sem-foto'}
            className="text-neutro-tintaFraca"
          >
            {emptyText}
          </p>
        ) : null}

        {missingChoices.length > 0 ? (
          <p
            data-escolhas-sem-produto={missingChoices.length}
            className="break-words border-l-2 border-marca-amareloTexto pl-3 text-rotulo text-marca-amareloTexto"
          >
            {missingProductText(missingChoices)}
          </p>
        ) : null}

        <section aria-labelledby="export-csv-title" data-formato="csv" className="space-y-3">
          <SectionTitle
            id="export-csv-title"
            title="CSV"
            description="Para planilha: colunas separadas por ponto e vírgula, acentos em UTF-8 e valores em centavos e em reais."
          />

          <FileRow
            title="Resumo por produto"
            description="Uma linha por produto: código, nome, preço, quantidade, total, EAN e NCM."
          >
            <Button
              data-baixar={CSV_FILES.SUMMARY}
              variant="primary"
              className="flex-none"
              {...lockOf(CSV_FILES.SUMMARY, hasProducts)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar resumo
            </Button>
          </FileRow>

          <FileRow
            title="Exemplares"
            description="Uma linha por etiqueta contada: leituras, fotos de origem, aviso e texto lido."
          >
            <Button
              data-baixar={CSV_FILES.COPIES}
              className="flex-none"
              {...lockOf(CSV_FILES.COPIES, hasProducts)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar exemplares
            </Button>
          </FileRow>
        </section>

        <section aria-labelledby="export-xml-title" data-formato="xml" className="space-y-3">
          <SectionTitle
            id="export-xml-title"
            title="XML"
            description="Para outro sistema: estrutura com versão, texto em UTF-8, valores em centavos e a hora da geração com o fuso."
          />

          <FileRow
            title="Relatório completo"
            description="Sessão, totais, produtos com os exemplares e os conflitos resolvidos, textos rejeitados inteiros, fotos e escolhas ignoradas."
          >
            <Button data-baixar={XML_FILE} className="flex-none" {...lockOf(XML_FILE, hasPhotos)}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar XML
            </Button>
          </FileRow>
        </section>

        <section aria-labelledby="export-pdf-title" data-formato="pdf" className="space-y-3">
          <SectionTitle
            id="export-pdf-title"
            title="PDF"
            description="Para ler e arquivar: páginas A4 com os valores em reais e a hora da geração com o fuso."
          />

          <FileRow
            title="Relatório para leitura"
            description="Totais, resumo por produto, conflitos resolvidos, exemplares, textos rejeitados, fotos e escolhas ignoradas."
          >
            <Button
              data-baixar={PDF_FILE}
              className="flex-none aria-disabled:cursor-wait aria-disabled:opacity-60"
              {...lockOf(PDF_FILE, hasPhotos)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {pdfRunning ? PDF_RUNNING_TEXT : 'Baixar PDF'}
            </Button>
          </FileRow>
        </section>

        <div role="status" aria-live="polite">
          {pdfRunning ? (
            <p data-gerando="" className="text-neutro-tintaMedia">
              {PDF_RUNNING_TEXT}
            </p>
          ) : null}
          {status === EXPORT_STATUS.DONE && fileName ? (
            <p
              data-arquivo-gerado=""
              className="break-all border border-marca-verdeBorda bg-marca-verdeTenue p-3 text-marca-verdeTexto"
            >
              {doneText(fileName)}
            </p>
          ) : null}
        </div>

        {error ? <InlineAlert>{error}</InlineAlert> : null}
      </div>
    </ModalShell>
  );
}
