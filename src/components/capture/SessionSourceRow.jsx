import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';

import { SOURCE_FAILURE_MESSAGES, SOURCE_STATUSES } from '../../domain/schemas/sourceSchema.js';
import {
  PROCESSING_WARNINGS,
  PROCESSING_WARNING_MESSAGES,
} from '../../domain/services/sourceProcessing.js';
import { classifySourceReadings } from '../../domain/services/sourceReadings.js';
import { CAPTURE_ITEM_STATUSES, CAPTURE_ITEM_STATUS_LABELS } from '../../store/captureItem.js';
import IconButton from '../ui/IconButton.jsx';

import {
  MESSAGE_TONES,
  StatusTag,
  TextList,
  describeCounts,
  describeSize,
} from './sourceDisplay.jsx';

/**
 * Uma foto gravada na sessao aberta, lida do banco e nao do lote: continua na
 * lista depois de recarregar a pagina. A situacao, o tamanho, a contagem e os
 * textos de cada simbolo vem da fonte e das leituras gravadas, e o botao de
 * remover abre a confirmacao.
 */

export default function SessionSourceRow({ source, readings, canRemove, onRemove }) {
  const texts = useMemo(() => classifySourceReadings(readings, source.id), [readings, source.id]);

  const isRead = source.status === SOURCE_STATUSES.READ;
  const symbolCount = texts.valid.length + texts.rejected.length;
  const tone = isRead ? (symbolCount === 0 ? 'warning' : 'confirm') : 'error';
  const fileName = source.fileName || 'foto sem nome';

  let message = null;

  if (!isRead) {
    message = SOURCE_FAILURE_MESSAGES[source.failureReason] ?? null;
  } else if (symbolCount === 0) {
    message = PROCESSING_WARNING_MESSAGES[PROCESSING_WARNINGS.NO_SYMBOLS];
  }

  const details = isRead
    ? [
        describeSize(source),
        describeCounts(
          { symbolCount, validCount: texts.valid.length, rejectedCount: texts.rejected.length },
          texts.positionCount,
        ),
      ].filter(Boolean)
    : [];

  return (
    <li data-fonte={source.id} className="space-y-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="min-w-24 flex-1 break-all font-semibold text-neutro-tinta">{fileName}</p>
          <StatusTag tone={tone}>
            {
              CAPTURE_ITEM_STATUS_LABELS[
                isRead ? CAPTURE_ITEM_STATUSES.READ : CAPTURE_ITEM_STATUSES.FAILED
              ]
            }
          </StatusTag>
        </div>

        <IconButton
          label={`Remover ${fileName}`}
          tone="danger"
          data-remover=""
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>

      {message ? <p className={MESSAGE_TONES[tone]}>{message}</p> : null}

      {details.map((line) => (
        <p key={line} className="text-rotulo text-neutro-tintaFraca">
          {line}
        </p>
      ))}

      <TextList title="Válidos" entries={texts.valid} />
      <TextList title="Rejeitados" entries={texts.rejected} withReason />
    </li>
  );
}
