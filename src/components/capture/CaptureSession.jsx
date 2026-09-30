import { useState } from 'react';

import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

/**
 * Sessao em que as fotos estao sendo gravadas e o atalho para abrir outra. A
 * mesma foto e recusada na mesma sessao, entao repetir uma folha pede sessao
 * nova.
 */

const CREATE_ERROR =
  'Não foi possível abrir uma sessão nova neste aparelho. Recarregue a página e tente de novo.';

const selectSessionName = (state) =>
  state.sessions.find((session) => session.id === state.currentSessionId)?.name ?? null;

export default function CaptureSession() {
  const sessionName = useSessionStore(selectSessionName);
  const isLoading = useSessionStore((state) => state.isLoading);
  const loadError = useSessionStore((state) => state.loadError);
  const createSession = useSessionStore((state) => state.createSession);
  const isRunning = useCaptureStore((state) => state.isRunning);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  async function handleCreate() {
    setIsCreating(true);
    setCreateError(null);

    try {
      await createSession();
    } catch {
      setCreateError(CREATE_ERROR);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section aria-labelledby="session-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-32">
          <h3 id="session-title" className="text-rotulo font-semibold text-neutro-tintaMedia">
            Sessão aberta
          </h3>
          <p className="truncate text-neutro-tinta">
            {sessionName ?? (isLoading ? 'Abrindo a sessão salva neste aparelho…' : 'Nenhuma')}
          </p>
        </div>

        <Button
          onClick={handleCreate}
          disabled={isRunning || isLoading || isCreating}
          className="whitespace-nowrap"
        >
          Nova sessão
        </Button>
      </div>

      <p className="text-rotulo text-neutro-tintaFraca">
        A mesma foto é recusada na mesma sessão. Para fotografar a mesma folha de novo, abra uma
        sessão nova.
      </p>

      {loadError ? <InlineAlert>{loadError}</InlineAlert> : null}
      {createError ? <InlineAlert>{createError}</InlineAlert> : null}
    </section>
  );
}
