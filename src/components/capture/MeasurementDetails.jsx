import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { classifySourceReadings } from '../../domain/services/sourceReadings.js';
import { cx } from '../../lib/cx.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import Button from '../ui/Button.jsx';
import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';
import InlineAlert from '../ui/InlineAlert.jsx';

import { describeMeasurement, formatMeasurement } from './captureText.js';

/**
 * Medicao do lote: o tempo de cada foto e a copia em colunas para a planilha.
 *
 * Serve a quem confere a leitura num aparelho novo, e nao ao dia a dia da
 * contagem, por isso fica recolhida: o resumo nativo do `details` abre e fecha
 * pelo teclado e pelo toque, e o que esta dentro so entra na ordem de
 * tabulacao quando aberto.
 */

const COPY_MESSAGES = Object.freeze({
  copied: 'Medição copiada. Cole na planilha.',
  failed:
    'Não foi possível copiar a medição. Permita o acesso à área de transferência e tente de novo.',
});

function writeToClipboard(text) {
  return navigator.clipboard.writeText(text);
}

export default function MeasurementDetails({ items, copyText = writeToClipboard }) {
  const [copyStatus, setCopyStatus] = useState(null);
  const timed = items.filter((item) => item.measurement);

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
    <details className="group rounded border border-neutro-divisor bg-neutro-branco">
      <summary
        className={cx(
          'flex h-controle cursor-pointer list-none items-center justify-between gap-2 px-4',
          'text-rotulo font-semibold text-neutro-tintaMedia [&::-webkit-details-marker]:hidden',
          FOCUS_OUTLINE,
          FOCUS_OUTLINE_COLORS.neutral,
        )}
      >
        Medição
        <ChevronDown
          className="h-4 w-4 shrink-0 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="space-y-3 border-t border-neutro-divisor px-4 py-3">
        {timed.length > 0 ? (
          <ul aria-label="Tempo de cada foto" className="space-y-1">
            {timed.map((item) => (
              <li key={item.id} className="text-rotulo text-neutro-tintaFraca">
                <span className="break-all font-semibold text-neutro-tinta">
                  {item.fileName || 'foto sem nome'}
                </span>{' '}
                {describeMeasurement(item.measurement)}
              </li>
            ))}
          </ul>
        ) : null}

        <Button onClick={handleCopy}>Copiar medição</Button>

        {copyStatus === 'copied' ? (
          <p role="status" className="text-rotulo text-marca-verdeTexto">
            {COPY_MESSAGES.copied}
          </p>
        ) : null}
        {copyStatus === 'failed' ? <InlineAlert>{COPY_MESSAGES.failed}</InlineAlert> : null}
      </div>
    </details>
  );
}
