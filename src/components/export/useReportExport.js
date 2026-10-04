import { useCallback, useRef, useState } from 'react';

import { buildCopiesCsv, buildSummaryCsv } from '../../domain/services/csvExport.js';
import { buildExportFileName } from '../../domain/services/exportFileName.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';
import { downloadBlob } from '../../lib/download.js';

/**
 * Estado da exportacao e a sequencia que a executa.
 *
 * A sequencia e curta e sempre a mesma: tomar o instante, carimbar o relatorio
 * com ele, escrever o texto, dar nome ao arquivo e disparar o download. Fica
 * fora do JSX para poder ser lida de cima a baixo, e o dialogo so desenha.
 *
 * O relatorio e o da tela, o mesmo que o dialogo mostrou ao operador, com o
 * instante trocado: so o cabecalho depende dele. O mesmo instante serve ao
 * conteudo e ao nome do arquivo; duas leituras de relogio poderiam cair em
 * minutos diferentes, e o nome diria uma hora e o conteudo outra.
 *
 * Duas exportacoes ao mesmo tempo sao impedidas aqui, e nao so pelo botao
 * desligado: o estado da tela pode mudar entre o clique e o proximo desenho.
 *
 * `now` e `download` chegam por parametro, com o relogio e o download do
 * navegador como padrao, para o teste fixar o instante e interceptar o arquivo.
 */

const FAILURE_MESSAGE = 'Não foi possível gerar o arquivo. Tente de novo.';

const CSV_TYPE = 'text/csv;charset=utf-8';

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

const CSV_BUILDERS = Object.freeze({
  [CSV_FILES.SUMMARY]: {
    text: (report) => buildSummaryCsv(report, { formatCentavos: formatCentavosAsBRL }),
    suffix: null,
  },
  [CSV_FILES.COPIES]: {
    text: (report) => buildCopiesCsv(report),
    suffix: 'exemplares',
  },
});

const defaultNow = () => new Date();

export function useReportExport({ now = defaultNow, download = downloadBlob } = {}) {
  const [state, setState] = useState({ status: EXPORT_STATUS.IDLE, file: null, fileName: null });
  const runningRef = useRef(false);

  const exportCsv = useCallback(
    (report, file) => {
      if (runningRef.current) {
        return;
      }

      runningRef.current = true;
      setState({ status: EXPORT_STATUS.RUNNING, file, fileName: null });

      try {
        const builder = CSV_BUILDERS[file];
        const generatedAt = now().toISOString();
        const stamped = { ...report, header: { ...report.header, generatedAt } };
        const fileName = buildExportFileName(generatedAt, 'csv', builder.suffix);

        download(new Blob([builder.text(stamped)], { type: CSV_TYPE }), fileName);
        setState({ status: EXPORT_STATUS.DONE, file, fileName });
      } catch {
        setState({ status: EXPORT_STATUS.FAILED, file, fileName: null });
      } finally {
        runningRef.current = false;
      }
    },
    [now, download],
  );

  return {
    ...state,
    error: state.status === EXPORT_STATUS.FAILED ? FAILURE_MESSAGE : null,
    exportCsv,
  };
}
