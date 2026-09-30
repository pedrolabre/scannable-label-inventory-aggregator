import { useSessionStore } from '../../store/useSessionStore.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

/**
 * Topo da coluna Entrada: a sessao em que as fotos estao sendo gravadas e o
 * botao que abre o dialogo de sessoes. A mesma foto e recusada na mesma
 * sessao, entao repetir uma folha pede sessao nova, criada no dialogo.
 *
 * O nome foi digitado por alguem e aparece sempre como texto.
 */

const selectSessionName = (state) =>
  state.sessions.find((session) => session.id === state.currentSessionId)?.name ?? null;

export default function SessionPicker({ onOpenSessions }) {
  const sessionName = useSessionStore(selectSessionName);
  const isLoading = useSessionStore((state) => state.isLoading);
  const loadError = useSessionStore((state) => state.loadError);

  return (
    <section aria-labelledby="session-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-32">
          <h3 id="session-title" className="text-rotulo font-semibold text-neutro-tintaMedia">
            Sessão aberta
          </h3>
          <p data-sessao-aberta="" className="truncate text-neutro-tinta" title={sessionName ?? ''}>
            {sessionName ?? (isLoading ? 'Abrindo a sessão salva neste aparelho…' : 'Nenhuma')}
          </p>
        </div>

        <Button onClick={onOpenSessions} className="whitespace-nowrap">
          Sessões
        </Button>
      </div>

      <p className="text-rotulo text-neutro-tintaFraca">
        A mesma foto é recusada na mesma sessão. Para fotografar a mesma folha de novo, crie uma
        sessão nova em Sessões.
      </p>

      {loadError ? <InlineAlert>{loadError}</InlineAlert> : null}
    </section>
  );
}
