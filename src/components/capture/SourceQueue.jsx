import { useState } from 'react';

import { classifySourceReadings } from '../../domain/services/sourceReadings.js';
import { CAPTURE_ITEM_STATUSES, formatProgress, selectProgress } from '../../store/captureItem.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

import { formatMeasurement } from './captureText.js';
import SourceRow from './SourceRow.jsx';

/**
 * Fotos do lote atual: andamento, erro atual, a nova tentativa das fotos com
 * erro, a copia da medicao e uma linha por foto. O lote vive so na memoria da
 * pagina; o que fica gravado sao as fontes e as leituras da sessao.
 */

const COPY_MESSAGES = Object.freeze({
  copied: 'Medição copiada. Cole na planilha.',
  failed:
    'Não foi possível copiar a medição. Permita o acesso à área de transferência e tente de novo.',
});

const DONE_STATUSES = new Set([
  CAPTURE_ITEM_STATUSES.READ,
  CAPTURE_ITEM_STATUSES.FAILED,
  CAPTURE_ITEM_STATUSES.DUPLICATE,
  CAPTURE_ITEM_STATUSES.ERROR,
]);

const selectProgressText = (state) => formatProgress(selectProgress(state));

function writeToClipboard(text) {
  return navigator.clipboard.writeText(text);
}

export default function SourceQueue({ copyText = writeToClipboard }) {
  const items = useCaptureStore((state) => state.items);
  const currentError = useCaptureStore((state) => state.currentError);
  const retry = useCaptureStore((state) => state.retry);
  const progress = useCaptureStore(selectProgressText);
  const [copyStatus, setCopyStatus] = useState(null);

  const hasError = items.some((item) => item.status === CAPTURE_ITEM_STATUSES.ERROR);
  const hasDone = items.some((item) => DONE_STATUSES.has(item.status));

  async function handleCopy() {
    const { sources, readings, currentSessionId } = useSessionStore.getState();
    const text = formatMeasurement({
      items,
      sources,
      positionCountOf: (item) =>
        item.sessionId === currentSessionId
          ? classifySourceReadings(readings, item.sourceId).positionCount
          : null,
      device: globalThis.navigator?.userAgent ?? '',
      copiedAt: new Date(),
    });

    try {
      await copyText(text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <section aria-labelledby="queue-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="queue-title" className="text-rotulo font-semibold text-neutro-tintaMedia">
            Fila de fotos
          </h2>
          <p aria-live="polite" className="font-display text-neutro-tinta">
            {progress || 'Nenhuma foto neste lote.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasError ? <Button onClick={() => retry()}>Tentar de novo</Button> : null}
          {hasDone ? <Button onClick={handleCopy}>Copiar medição</Button> : null}
        </div>
      </div>

      {currentError ? <InlineAlert>{currentError}</InlineAlert> : null}

      {copyStatus === 'copied' ? (
        <p role="status" className="text-rotulo text-marca-verdeTexto">
          {COPY_MESSAGES.copied}
        </p>
      ) : null}
      {copyStatus === 'failed' ? <InlineAlert>{COPY_MESSAGES.failed}</InlineAlert> : null}

      {items.length > 0 ? (
        <ul
          aria-label="Fotos do lote"
          className="divide-y divide-neutro-divisor rounded border border-neutro-divisor bg-neutro-branco"
        >
          {items.map((item) => (
            <SourceRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
