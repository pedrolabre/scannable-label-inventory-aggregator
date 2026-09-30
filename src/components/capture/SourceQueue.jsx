import { CAPTURE_ITEM_STATUSES, formatProgress, selectProgress } from '../../store/captureItem.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

import MeasurementDetails from './MeasurementDetails.jsx';
import SourceRow from './SourceRow.jsx';

/**
 * Fotos do lote atual: andamento, erro atual, a nova tentativa das fotos com
 * erro, uma linha por foto e, ao fim, a medicao recolhida. O lote vive so na
 * memoria da pagina; o que fica gravado sao as fontes e as leituras da sessao.
 */

const DONE_STATUSES = new Set([
  CAPTURE_ITEM_STATUSES.READ,
  CAPTURE_ITEM_STATUSES.FAILED,
  CAPTURE_ITEM_STATUSES.DUPLICATE,
  CAPTURE_ITEM_STATUSES.ERROR,
]);

const selectProgressText = (state) => formatProgress(selectProgress(state));

export default function SourceQueue({ copyText }) {
  const items = useCaptureStore((state) => state.items);
  const currentError = useCaptureStore((state) => state.currentError);
  const retry = useCaptureStore((state) => state.retry);
  const progress = useCaptureStore(selectProgressText);

  const hasError = items.some((item) => item.status === CAPTURE_ITEM_STATUSES.ERROR);
  const hasDone = items.some((item) => DONE_STATUSES.has(item.status));

  return (
    <section aria-labelledby="queue-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="queue-title" className="text-rotulo font-semibold text-neutro-tintaMedia">
            Fila de fotos
          </h3>
          <p aria-live="polite" className="font-display text-neutro-tinta">
            {progress || 'Nenhuma foto neste lote.'}
          </p>
        </div>

        {hasError ? <Button onClick={() => retry()}>Tentar de novo</Button> : null}
      </div>

      {currentError ? <InlineAlert>{currentError}</InlineAlert> : null}

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

      {hasDone ? <MeasurementDetails items={items} copyText={copyText} /> : null}
    </section>
  );
}
