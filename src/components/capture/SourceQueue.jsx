import { CAPTURE_ITEM_STATUSES, formatProgress, selectProgress } from '../../store/captureItem.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

import MeasurementDetails from './MeasurementDetails.jsx';
import SourceRow from './SourceRow.jsx';

/**
 * Lote atual: andamento, erro atual, a nova tentativa das fotos com erro, uma
 * linha por foto que ainda nao esta entre as fotos da sessao aberta e, ao fim,
 * a medicao recolhida do lote inteiro.
 *
 * O lote vive so na memoria da pagina. A foto gravada na sessao aberta, lida ou
 * com falha, sai daqui e aparece em Fotos da sessao, lida do banco; aqui ficam a
 * que espera, a que esta sendo lida, a repetida, a que deu erro e a que foi
 * gravada em outra sessao.
 */

const DONE_STATUSES = new Set([
  CAPTURE_ITEM_STATUSES.READ,
  CAPTURE_ITEM_STATUSES.FAILED,
  CAPTURE_ITEM_STATUSES.DUPLICATE,
  CAPTURE_ITEM_STATUSES.ERROR,
]);

const selectProgressText = (state) => formatProgress(selectProgress(state));

const STORED_NOTE = 'As fotos lidas e as que falharam passam para Fotos da sessão, abaixo.';

export default function SourceQueue({ copyText }) {
  const items = useCaptureStore((state) => state.items);
  const currentError = useCaptureStore((state) => state.currentError);
  const retry = useCaptureStore((state) => state.retry);
  const progress = useCaptureStore(selectProgressText);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);

  const hasError = items.some((item) => item.status === CAPTURE_ITEM_STATUSES.ERROR);
  const hasDone = items.some((item) => DONE_STATUSES.has(item.status));
  const isStoredHere = (item) => Boolean(item.sourceId) && item.sessionId === currentSessionId;
  const visible = items.filter((item) => !isStoredHere(item));
  const hasStored = visible.length < items.length;

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

      {hasStored ? <p className="text-rotulo text-neutro-tintaFraca">{STORED_NOTE}</p> : null}

      {visible.length > 0 ? (
        <ul
          aria-label="Fotos do lote"
          className="divide-y divide-neutro-divisor rounded border border-neutro-divisor bg-neutro-branco"
        >
          {visible.map((item) => (
            <SourceRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}

      {hasDone ? <MeasurementDetails items={items} copyText={copyText} /> : null}
    </section>
  );
}
