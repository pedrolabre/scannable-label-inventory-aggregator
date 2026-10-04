import { Download } from 'lucide-react';

import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import {
  blockerText,
  doneText,
  firstOpenConflictCode,
  missingProductChoicesOf,
  missingProductText,
} from './exportText.js';
import { CSV_FILES, EXPORT_STATUS, useReportExport } from './useReportExport.js';

/**
 * Exportacao do relatorio da sessao aberta, gerada no aparelho.
 *
 * Cada formato e uma secao com os proprios arquivos. O CSV tem dois: o resumo
 * por produto e os exemplares, cada um no proprio botao, porque um clique que
 * baixa dois arquivos de uma vez esbarra na permissao de downloads multiplos
 * do navegador.
 *
 * Com conflito aberto os arquivos ficam desligados, com a frase do bloqueio e
 * a contagem; `Revisar conflitos` leva ao primeiro produto que pede decisao
 * (`onReviewConflicts`, que fecha o dialogo). Sessao sem produto tambem nao
 * gera arquivo: ele sairia so com o cabecalho.
 *
 * Escolha gravada de produto que sumiu das leituras nao aparece em nenhuma
 * outra tela; aqui ela vira aviso, sem bloquear, porque nao muda nada do que
 * sai no arquivo.
 *
 * Depois do download o dialogo continua aberto, com o nome do arquivo gerado,
 * para o operador baixar o outro arquivo se quiser. O foco fica no botao
 * tocado. A falha aparece junto dos botoes.
 *
 * `now` e `download` seguem para `useReportExport`; sem eles valem o relogio e
 * o download do navegador.
 */

const BLOCKER_ID = 'export-blocker';
const EMPTY_ID = 'export-empty';

function FileRow({ title, description, children }) {
  return (
    <div className="flex flex-col gap-2 border-t border-neutro-divisor pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-neutro-tinta">{title}</p>
        <p className="text-rotulo text-neutro-tintaFraca">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function ExportDialog({ report, onClose, onReviewConflicts, now, download }) {
  const { status, fileName, error, exportCsv } = useReportExport({ now, download });

  const blocker = report.exportBlockers[0] ?? null;
  const isEmpty = !blocker && report.products.length === 0;
  const missingChoices = missingProductChoicesOf(report);
  const reviewCode = blocker ? firstOpenConflictCode(report) : null;
  const isDisabled = Boolean(blocker) || isEmpty || status === EXPORT_STATUS.RUNNING;
  const describedBy = blocker ? BLOCKER_ID : isEmpty ? EMPTY_ID : undefined;

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

        {isEmpty ? (
          <p id={EMPTY_ID} data-sessao-vazia="" className="text-neutro-tintaFraca">
            Nenhum produto nesta sessão.
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
          <div className="space-y-1">
            <h3
              id="export-csv-title"
              className="font-display text-base font-semibold text-neutro-tinta"
            >
              CSV
            </h3>
            <p className="text-rotulo text-neutro-tintaFraca">
              Para planilha: colunas separadas por ponto e vírgula, acentos em UTF-8 e valores em
              centavos e em reais.
            </p>
          </div>

          <FileRow
            title="Resumo por produto"
            description="Uma linha por produto: código, nome, preço, quantidade, total, EAN e NCM."
          >
            <Button
              data-baixar={CSV_FILES.SUMMARY}
              variant="primary"
              className="flex-none"
              disabled={isDisabled}
              aria-describedby={describedBy}
              onClick={() => exportCsv(report, CSV_FILES.SUMMARY)}
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
              disabled={isDisabled}
              aria-describedby={describedBy}
              onClick={() => exportCsv(report, CSV_FILES.COPIES)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar exemplares
            </Button>
          </FileRow>
        </section>

        <div role="status" aria-live="polite">
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
