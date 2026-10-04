import { useCallback, useRef, useState } from 'react';

import { buildCopiesCsv, buildSummaryCsv } from '../../domain/services/csvExport.js';
import { buildExportFileName } from '../../domain/services/exportFileName.js';
import { localOffsetMinutes } from '../../domain/services/exportTimestamp.js';
import { describeReportDocument } from '../../domain/services/reportDocument.js';
import { buildInventoryXml } from '../../domain/services/xmlExport.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';
import { downloadBlob } from '../../lib/download.js';
import { renderReportDocument } from '../../lib/pdf.js';

/**
 * Estado da exportacao e a sequencia que a executa.
 *
 * A sequencia e curta e a mesma para todo arquivo: tomar o instante, carimbar
 * o relatorio com ele, escrever o texto, dar nome ao arquivo e disparar o
 * download. Fica fora do JSX para poder ser lida de cima a baixo, e o dialogo
 * so desenha. Cada arquivo diz so o que muda: o conteudo, a extensao, o sufixo
 * do nome e o tipo.
 *
 * O XML e o PDF levam a hora local com o deslocamento do fuso, lido aqui no
 * instante tomado: quem escreve o arquivo recebe o numero pronto e nao consulta
 * o aparelho.
 *
 * O CSV e o XML saem na hora, no mesmo gesto. O PDF demora: o motor desce na
 * primeira vez e a geracao cede a tela entre as paginas. Enquanto ele e gerado,
 * o estado fica em andamento com o arquivo, para o dialogo travar os botoes e
 * dizer o que esta acontecendo. Fechar o dialogo nesse meio nao interrompe a
 * geracao: o arquivo e baixado quando fica pronto.
 *
 * O relatorio e o da tela, o mesmo que o dialogo mostrou ao operador, com o
 * instante trocado: so o cabecalho depende dele. O mesmo instante serve ao
 * conteudo e ao nome do arquivo; duas leituras de relogio poderiam cair em
 * minutos diferentes, e o nome diria uma hora e o conteudo outra.
 *
 * Duas exportacoes ao mesmo tempo sao impedidas aqui, e nao so pelo botao
 * desligado: o estado da tela pode mudar entre o clique e o proximo desenho.
 *
 * `now`, `download` e `renderPdf` chegam por parametro, com o relogio, o
 * download do navegador e a escrita do PDF como padrao, para o teste fixar o
 * instante, interceptar o arquivo e simular a falha do motor.
 */

const FAILURE_MESSAGE = 'Não foi possível gerar o arquivo. Tente de novo.';

const CSV_TYPE = 'text/csv;charset=utf-8';
const XML_TYPE = 'application/xml;charset=utf-8';
const PDF_TYPE = 'application/pdf';

export const EXPORT_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
});

/** Arquivos da exportacao em CSV. */
export const CSV_FILES = Object.freeze({
  SUMMARY: 'resumo',
  COPIES: 'exemplares',
});

/** Arquivo da exportacao em XML. */
export const XML_FILE = 'xml';

/** Arquivo da exportacao em PDF. */
export const PDF_FILE = 'pdf';

function offsetOf(report) {
  return localOffsetMinutes(report.header.generatedAt);
}

const FILE_BUILDERS = Object.freeze({
  [CSV_FILES.SUMMARY]: {
    content: (report) => buildSummaryCsv(report, { formatCentavos: formatCentavosAsBRL }),
    extension: 'csv',
    suffix: null,
    type: CSV_TYPE,
  },
  [CSV_FILES.COPIES]: {
    content: (report) => buildCopiesCsv(report),
    extension: 'csv',
    suffix: 'exemplares',
    type: CSV_TYPE,
  },
  [XML_FILE]: {
    content: (report) => buildInventoryXml(report, { offsetMinutes: offsetOf(report) }),
    extension: 'xml',
    suffix: null,
    type: XML_TYPE,
  },
  [PDF_FILE]: {
    content: (report, { renderPdf }) =>
      renderPdf(
        describeReportDocument(report, {
          offsetMinutes: offsetOf(report),
          formatCentavos: formatCentavosAsBRL,
        }),
      ),
    extension: 'pdf',
    suffix: null,
    type: PDF_TYPE,
  },
});

function isPending(value) {
  return typeof value?.then === 'function';
}

const defaultNow = () => new Date();

export function useReportExport({
  now = defaultNow,
  download = downloadBlob,
  renderPdf = renderReportDocument,
} = {}) {
  const [state, setState] = useState({ status: EXPORT_STATUS.IDLE, file: null, fileName: null });
  const runningRef = useRef(false);

  /**
   * Gera e baixa um arquivo. Devolve uma promessa que se cumpre quando a
   * exportacao termina, com ou sem falha; o CSV e o XML ja terminaram na volta.
   */
  const exportFile = useCallback(
    (report, file) => {
      if (runningRef.current) {
        return Promise.resolve();
      }

      runningRef.current = true;
      setState({ status: EXPORT_STATUS.RUNNING, file, fileName: null });

      const builder = FILE_BUILDERS[file];
      let fileName = null;

      const finish = (content) => {
        download(new Blob([content], { type: builder.type }), fileName);
        setState({ status: EXPORT_STATUS.DONE, file, fileName });
      };
      const fail = () => {
        setState({ status: EXPORT_STATUS.FAILED, file, fileName: null });
      };
      const release = () => {
        runningRef.current = false;
      };

      try {
        const generatedAt = now().toISOString();
        const stamped = { ...report, header: { ...report.header, generatedAt } };

        fileName = buildExportFileName(generatedAt, builder.extension, builder.suffix);

        const content = builder.content(stamped, { renderPdf });

        if (isPending(content)) {
          return content.then(finish).catch(fail).finally(release);
        }

        finish(content);
      } catch {
        fail();
      }

      release();

      return Promise.resolve();
    },
    [now, download, renderPdf],
  );

  return {
    ...state,
    error: state.status === EXPORT_STATUS.FAILED ? FAILURE_MESSAGE : null,
    exportFile,
  };
}
