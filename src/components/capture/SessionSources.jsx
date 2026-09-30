import { useEffect, useRef, useState } from 'react';

import { describeStorageError } from '../../storage/storageError.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import ConfirmModal from '../ui/ConfirmModal.jsx';

import { countLabel } from './captureText.js';
import SessionSourceRow from './SessionSourceRow.jsx';

/**
 * Fotos gravadas na sessao aberta, lidas do banco: a lista continua igual
 * depois de recarregar a pagina, ao contrario do lote, que vive so na memoria.
 *
 * Remover uma foto pergunta antes e tira a foto e os textos lidos nela numa
 * transacao so; o relatorio, derivado da sessao, se refaz na hora. Com fotos na
 * fila, ou com a sessao carregando, a remocao fica desligada.
 *
 * O botao que abriu a pergunta sai da tela junto com a foto, entao o foco vai
 * para o remover da foto vizinha, ou para o titulo da lista quando ela esvazia.
 */
export default function SessionSources() {
  const sources = useSessionStore((state) => state.sources);
  const readings = useSessionStore((state) => state.readings);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const isLoading = useSessionStore((state) => state.isLoading);
  const removeSource = useSessionStore((state) => state.removeSource);
  const isRunning = useCaptureStore((state) => state.isRunning);

  const [pending, setPending] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const sectionRef = useRef(null);
  const titleRef = useRef(null);

  const canRemove = !isRunning && !isLoading && currentSessionId !== null;

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    const neighbor = focusTarget.id
      ? sectionRef.current?.querySelector(
          `[data-fonte="${CSS.escape(focusTarget.id)}"] [data-remover]`,
        )
      : null;

    (neighbor && !neighbor.disabled ? neighbor : titleRef.current)?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  function closeQuestion() {
    setPending(null);
    setError(null);
  }

  async function confirmRemoval() {
    const index = sources.findIndex((source) => source.id === pending.id);
    const neighbor = sources[index + 1] ?? sources[index - 1] ?? null;

    setIsRemoving(true);
    setError(null);

    try {
      await removeSource(pending.sessionId, pending.id);
      setPending(null);
      setFocusTarget({ id: neighbor?.id ?? null });
    } catch (failure) {
      setError(describeStorageError(failure));
    } finally {
      setIsRemoving(false);
    }
  }

  const pendingTexts = pending
    ? readings.filter((reading) => reading.sourceId === pending.id).length
    : 0;

  return (
    <section ref={sectionRef} aria-labelledby="session-sources-title" className="space-y-3">
      <div>
        <h3
          ref={titleRef}
          id="session-sources-title"
          tabIndex={-1}
          className="text-rotulo font-semibold text-neutro-tintaMedia outline-none"
        >
          Fotos da sessão
        </h3>
        <p className="font-display text-neutro-tinta">
          {sources.length === 0
            ? 'Nenhuma foto gravada nesta sessão.'
            : `${countLabel(sources.length, 'foto gravada', 'fotos gravadas')} nesta sessão.`}
        </p>
      </div>

      {isRunning && sources.length > 0 ? (
        <p className="text-rotulo text-neutro-tintaFraca">
          Remover foto fica desligado até a fila terminar.
        </p>
      ) : null}

      {sources.length > 0 ? (
        <ul
          aria-label="Fotos gravadas na sessão"
          className="divide-y divide-neutro-divisor rounded border border-neutro-divisor bg-neutro-branco"
        >
          {sources.map((source) => (
            <SessionSourceRow
              key={source.id}
              source={source}
              readings={readings}
              canRemove={canRemove}
              onRemove={() => setPending(source)}
            />
          ))}
        </ul>
      ) : null}

      {pending ? (
        <ConfirmModal
          title="Remover foto"
          subtitle={pending.fileName || 'foto sem nome'}
          confirmLabel="Remover foto"
          isConfirming={isRemoving}
          error={error}
          onConfirm={confirmRemoval}
          onCancel={closeQuestion}
        >
          <p>
            A foto sai desta sessão com{' '}
            {pendingTexts === 0
              ? 'o registro dela; nenhum texto foi lido nela'
              : countLabel(pendingTexts, 'texto lido nela', 'textos lidos nela')}
            . Os totais da sessão são refeitos na hora.
          </p>
          <p>Para contar esta foto de novo, envie a mesma foto outra vez.</p>
        </ConfirmModal>
      ) : null}
    </section>
  );
}
