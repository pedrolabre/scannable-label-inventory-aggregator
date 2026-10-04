import { useCallback, useRef, useState } from 'react';

import { buildCopiesCsv, buildSummaryCsv } from '../../domain/services/csvExport.js';
import { buildExportFileName } from '../../domain/services/exportFileName.js';
import { localOffsetMinutes } from '../../domain/services/exportTimestamp.js';
import { buildInventoryXml } from '../../domain/services/xmlExport.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';
import { downloadBlob } from '../../lib/download.js';

/**
 * Estado da exportacao e a sequencia que a executa.
 *
 * A sequencia e curta e a mesma para todo arquivo: tomar o instante, carimbar
 * o relatorio com ele, escrever o texto, dar nome ao arquivo e disparar o
 * download. Fica fora do JSX para poder ser lida de cima a baixo, e o dialogo
 * so desenha. Cada arquivo diz so o que muda: o texto, a extensao, o sufixo do
 * nome e o tipo.
 *
 * O XML leva a hora local com o deslocamento do fuso, lido aqui no instante
 * tomado: o serializador recebe o numero pronto e nao consulta o aparelho.
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
const XML_TYPE = 'application/xml;charset=utf-8';

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

const FILE_BUILDERS = Object.freeze({
  [CSV_FILES.SUMMARY]: {
    text: (report) => buildSummaryCsv(report, { formatCentavos: formatCentavosAsBRL }),
    extension: 'csv',
    suffix: null,
    type: CSV_TYPE,
  },
  [CSV_FILES.COPIES]: {
    text: (report) => buildCopiesCsv(report),
    extension: 'csv',
    suffix: 'exemplares',
    type: CSV_TYPE,
  },
  [XML_FILE]: {
    text: (report) =>
      buildInventoryXml(report, {
        offsetMinutes: localOffsetMinutes(report.header.generatedAt),
      }),
    extension: 'xml',
    suffix: null,
    type: XML_TYPE,
  },
});

const defaultNow = () => new Date();

export function useReportExport({ now = defaultNow, download = downloadBlob } = {}) {
  const [state, setState] = useState({ status: EXPORT_STATUS.IDLE, file: null, fileName: null });
  const runningRef = useRef(false);

  const exportFile = useCallback(
    (report, file) => {
      if (runningRef.current) {
        return;
      }

      runningRef.current = true;
      setState({ status: EXPORT_STATUS.RUNNING, file, fileName: null });

      try {
        const builder = FILE_BUILDERS[file];
        const generatedAt = now().toISOString();
        const stamped = { ...report, header: { ...report.header, generatedAt } };
        const fileName = buildExportFileName(generatedAt, builder.extension, builder.suffix);

        download(new Blob([builder.text(stamped)], { type: builder.type }), fileName);
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
    exportFile,
  };
}
