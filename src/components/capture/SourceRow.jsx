import { CAPTURE_ITEM_STATUSES, CAPTURE_ITEM_STATUS_LABELS } from '../../store/captureItem.js';
import { useSessionStore } from '../../store/useSessionStore.js';

import { MESSAGE_TONES, StatusTag, describeCounts } from './sourceDisplay.jsx';

/**
 * Uma foto do lote que ainda nao esta entre as fotos da sessao aberta: a que
 * espera, a que esta sendo lida, a repetida, a que deu erro e a que foi gravada
 * em outra sessao. A situacao, a frase dela e, quando ha, a contagem do que foi
 * lido. O tempo da foto fica na medicao do lote, recolhida ao fim da fila.
 *
 * Na coluna estreita a situacao desce para baixo do nome quando os dois nao
 * cabem lado a lado, em vez de espremer o nome letra por letra.
 */

const OTHER_SESSION_NOTE =
  'Esta foto foi gravada em outra sessão; os textos lidos ficam naquela sessão.';

function toneOf(item) {
  switch (item.status) {
    case CAPTURE_ITEM_STATUSES.READ:
      return item.warnings.length > 0 ? 'warning' : 'confirm';
    case CAPTURE_ITEM_STATUSES.DUPLICATE:
      return 'warning';
    case CAPTURE_ITEM_STATUSES.FAILED:
    case CAPTURE_ITEM_STATUSES.ERROR:
      return 'error';
    default:
      return 'neutral';
  }
}

export default function SourceRow({ item }) {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);

  const tone = toneOf(item);
  const counts = describeCounts(item.summary, null);
  const isInOtherSession = Boolean(item.sourceId) && item.sessionId !== currentSessionId;

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="min-w-24 flex-1 break-all font-semibold text-neutro-tinta">
          {item.fileName || 'foto sem nome'}
        </p>
        <StatusTag tone={tone}>{CAPTURE_ITEM_STATUS_LABELS[item.status]}</StatusTag>
      </div>

      {item.message ? <p className={MESSAGE_TONES[tone]}>{item.message}</p> : null}

      {counts ? <p className="text-rotulo text-neutro-tintaFraca">{counts}</p> : null}

      {isInOtherSession ? (
        <p className="text-rotulo text-neutro-tintaFraca">{OTHER_SESSION_NOTE}</p>
      ) : null}
    </li>
  );
}
