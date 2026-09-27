import { useMemo } from 'react';

import { classifySourceReadings } from '../../domain/services/sourceReadings.js';
import { cx } from '../../lib/cx.js';
import { CAPTURE_ITEM_STATUSES, CAPTURE_ITEM_STATUS_LABELS } from '../../store/captureItem.js';
import { useSessionStore } from '../../store/useSessionStore.js';

import { countLabel, describeMeasurement, formatMegapixels } from './captureText.js';

/**
 * Uma foto da fila: a situacao, a frase dela e, depois de lida, os textos de
 * cada simbolo separados em validos e rejeitados com o motivo da recusa.
 *
 * O texto vem de uma etiqueta fotografada e e entrada nao confiavel: aparece
 * sempre como texto, nunca como marcacao.
 */

const TONES = Object.freeze({
  neutral: 'border-neutro-borda bg-neutro-superficie text-neutro-tintaMedia',
  confirm: 'border-marca-verdeBorda bg-marca-verdeTenue text-marca-verdeTexto',
  warning: 'border-marca-amareloBorda bg-marca-amareloTenue text-marca-amareloTexto',
  error: 'border-marca-vermelhoBorda bg-marca-vermelhoTenue text-marca-vermelhoTexto',
});

const MESSAGE_TONES = Object.freeze({
  neutral: 'text-neutro-tintaFraca',
  confirm: 'text-neutro-tintaFraca',
  warning: 'text-marca-amareloTexto',
  error: 'text-marca-vermelhoTexto',
});

const OTHER_SESSION_NOTE =
  'Esta foto foi gravada em outra sessão; os textos lidos ficam naquela sessão.';

const EMPTY_TEXT = '(texto vazio)';

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

function describeSize(source) {
  if (!Number.isFinite(source?.width) || !Number.isFinite(source?.height)) {
    return null;
  }

  return `${source.width} × ${source.height} px (${formatMegapixels(source.width, source.height)} MP)`;
}

function describeCounts(summary, positionCount) {
  if (!summary) {
    return null;
  }

  const counts = [
    countLabel(summary.validCount, 'válido', 'válidos'),
    countLabel(summary.rejectedCount, 'rejeitado', 'rejeitados'),
  ].join(', ');
  const positions = positionCount === null ? '' : `; ${positionCount} com posição`;

  return `${countLabel(summary.symbolCount, 'símbolo', 'símbolos')}: ${counts}${positions}`;
}

function TextList({ title, entries, renderExtra }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-rotulo font-semibold text-neutro-tintaMedia">{title}</p>
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.id} className="break-all text-neutro-tinta">
            {entry.text === '' ? EMPTY_TEXT : entry.text}
            {renderExtra ? renderExtra(entry) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const renderRejection = (entry) => (
  <span className="break-normal text-marca-vermelhoTexto"> — {entry.message}</span>
);

export default function SourceRow({ item }) {
  const readings = useSessionStore((state) => state.readings);
  const sources = useSessionStore((state) => state.sources);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);

  const isInOpenSession = item.sessionId === currentSessionId;
  const source =
    item.sourceId && isInOpenSession
      ? sources.find((entry) => entry.id === item.sourceId)
      : undefined;
  const texts = useMemo(
    () =>
      item.sourceId && isInOpenSession ? classifySourceReadings(readings, item.sourceId) : null,
    [readings, item.sourceId, isInOpenSession],
  );

  const tone = toneOf(item);
  const details = [
    describeSize(source),
    describeCounts(item.summary, texts ? texts.positionCount : null),
    describeMeasurement(item.measurement),
  ].filter(Boolean);

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-all font-semibold text-neutro-tinta">
          {item.fileName || 'foto sem nome'}
        </p>
        <span
          className={cx(
            'shrink-0 rounded border px-2 py-0.5 text-rotulo font-semibold',
            TONES[tone],
          )}
        >
          {CAPTURE_ITEM_STATUS_LABELS[item.status]}
        </span>
      </div>

      {item.message ? <p className={MESSAGE_TONES[tone]}>{item.message}</p> : null}

      {details.map((line) => (
        <p key={line} className="text-rotulo text-neutro-tintaFraca">
          {line}
        </p>
      ))}

      {item.sourceId && !isInOpenSession ? (
        <p className="text-rotulo text-neutro-tintaFraca">{OTHER_SESSION_NOTE}</p>
      ) : null}

      {texts ? (
        <>
          <TextList title="Válidos" entries={texts.valid} />
          <TextList title="Rejeitados" entries={texts.rejected} renderExtra={renderRejection} />
        </>
      ) : null}
    </li>
  );
}
