import { cx } from '../../lib/cx.js';

import { countLabel, formatMegapixels } from './captureText.js';

/**
 * Pecas comuns as duas linhas de foto da coluna Entrada, a do lote e a da
 * sessao: a etiqueta da situacao, as linhas de tamanho e de contagem e a lista
 * de textos lidos.
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

export const MESSAGE_TONES = Object.freeze({
  neutral: 'text-neutro-tintaFraca',
  confirm: 'text-neutro-tintaFraca',
  warning: 'text-marca-amareloTexto',
  error: 'text-marca-vermelhoTexto',
});

const EMPTY_TEXT = '(texto vazio)';

/** Situacao da foto numa etiqueta com a cor do tom. */
export function StatusTag({ tone, children }) {
  return (
    <span
      className={cx(
        'shrink-0 rounded border px-2 py-0.5 text-rotulo font-semibold',
        TONES[tone] ?? TONES.neutral,
      )}
    >
      {children}
    </span>
  );
}

/** `4032 × 3024 px (12,2 MP)`, ou `null` sem as dimensoes. */
export function describeSize(source) {
  if (!Number.isFinite(source?.width) || !Number.isFinite(source?.height)) {
    return null;
  }

  return `${source.width} × ${source.height} px (${formatMegapixels(source.width, source.height)} MP)`;
}

/** `3 símbolos: 1 válido, 2 rejeitados; 3 com posição`, ou `null` sem contagem. */
export function describeCounts(summary, positionCount) {
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

/** Textos lidos de uma foto, um por linha, com o motivo da recusa quando ha. */
export function TextList({ title, entries, withReason = false }) {
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
            {withReason ? (
              <span className="break-normal text-marca-vermelhoTexto"> — {entry.message}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
