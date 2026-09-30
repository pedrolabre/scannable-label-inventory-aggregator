import { useEffect, useRef, useState } from 'react';

import { describeStorageError, describeStorageReadError } from '../../storage/storageError.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import Button from '../ui/Button.jsx';
import { ConfirmMessage } from '../ui/ConfirmModal.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import SessionRow from './SessionRow.jsx';

/**
 * Sessoes guardadas no aparelho: abrir, renomear, apagar e criar uma nova.
 *
 * Apagar pergunta antes, num passo deste mesmo dialogo, e nao num segundo
 * dialogo por cima: um so painel prende o foco, e o `Esc` e o foco devolvido
 * continuam com o gatilho que abriu as sessoes.
 *
 * Com fotos na fila, abrir, apagar e criar ficam desligados: cada foto grava na
 * sessao em que entrou, e trocar ou apagar essa sessao no meio do lote faria as
 * seguintes falharem. Renomear continua livre. O mesmo vale enquanto uma
 * sessao carrega.
 */

const CREATE_ERROR =
  'Não foi possível abrir uma sessão nova neste aparelho. Recarregue a página e tente de novo.';

const BUSY_NOTE =
  'Com fotos na fila, abrir, apagar e criar sessão ficam desligados até a fila terminar.';

export default function SessionDialog({ onClose }) {
  const sessions = useSessionStore((state) => state.sessions);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const isLoading = useSessionStore((state) => state.isLoading);
  const selectSession = useSessionStore((state) => state.selectSession);
  const createSession = useSessionStore((state) => state.createSession);
  const renameSession = useSessionStore((state) => state.renameSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const isRunning = useCaptureStore((state) => state.isRunning);

  const [renamingId, setRenamingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const bodyRef = useRef(null);
  const cancelDeleteRef = useRef(null);

  const canChange = !isRunning && !isLoading && !isWorking;

  // O botao que levou a mudanca de passo sai da tela junto com ela; o foco vai
  // para o lugar que continua: o cancelar da pergunta, o apagar da linha de
  // onde a pergunta saiu, ou a lista depois da sessao apagada.
  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    if (focusTarget.kind === 'cancel') {
      cancelDeleteRef.current?.focus();
    } else if (focusTarget.kind === 'row') {
      bodyRef.current
        ?.querySelector(`[data-sessao="${CSS.escape(focusTarget.id)}"] [data-apagar]`)
        ?.focus();
    } else {
      bodyRef.current?.querySelector('[data-lista-sessoes]')?.focus();
    }

    setFocusTarget(null);
  }, [focusTarget]);

  async function run(action, describe) {
    setIsWorking(true);
    setError(null);

    try {
      await action();
      return true;
    } catch (failure) {
      setError(describe(failure));
      return false;
    } finally {
      setIsWorking(false);
    }
  }

  async function handleOpen(sessionId) {
    if (await run(() => selectSession(sessionId), describeStorageReadError)) {
      onClose();
    }
  }

  async function handleCreate() {
    if (
      await run(
        () => createSession(),
        () => CREATE_ERROR,
      )
    ) {
      onClose();
    }
  }

  async function handleRename(sessionId, name) {
    await renameSession(sessionId, name);
    setRenamingId(null);
  }

  function askDelete(session) {
    setRenamingId(null);
    setError(null);
    setDeleting(session);
    setFocusTarget({ kind: 'cancel' });
  }

  function cancelDelete() {
    const { id } = deleting;

    setDeleting(null);
    setError(null);
    setFocusTarget({ kind: 'row', id });
  }

  async function confirmDelete() {
    if (await run(() => deleteSession(deleting.id), describeStorageError)) {
      setDeleting(null);
      setFocusTarget({ kind: 'list' });
    }
  }

  if (deleting) {
    const isOpenSession = deleting.id === currentSessionId;

    return (
      <ModalShell
        title="Apagar sessão"
        subtitle={deleting.name}
        onClose={onClose}
        footer={
          <>
            <Button
              key="cancelar"
              ref={cancelDeleteRef}
              onClick={cancelDelete}
              disabled={isWorking}
            >
              Cancelar
            </Button>
            <Button key="apagar" variant="danger" onClick={confirmDelete} disabled={!canChange}>
              {error ? 'Tentar de novo' : 'Apagar sessão'}
            </Button>
          </>
        }
      >
        <div ref={bodyRef}>
          <ConfirmMessage error={error}>
            <p>
              A sessão sai deste aparelho com as fotos lidas, os textos de cada foto e as escolhas
              feitas nos conflitos. Não há como trazê-la de volta.
            </p>
            {isOpenSession ? (
              <p>
                Ela é a sessão aberta: em seguida abre a sessão alterada por último, ou uma nova se
                não sobrar nenhuma.
              </p>
            ) : null}
          </ConfirmMessage>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Sessões"
      subtitle="Guardadas neste aparelho, da alterada por último à mais antiga."
      onClose={onClose}
      footer={
        <Button key="nova" variant="primary" onClick={handleCreate} disabled={!canChange}>
          Nova sessão
        </Button>
      }
    >
      <div ref={bodyRef} className="space-y-4">
        {isRunning ? <p className="text-rotulo text-neutro-tintaFraca">{BUSY_NOTE}</p> : null}
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        {sessions.length > 0 ? (
          <ul
            data-lista-sessoes=""
            aria-label="Sessões guardadas"
            tabIndex={-1}
            className="divide-y divide-neutro-divisor rounded border border-neutro-divisor outline-none"
          >
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isOpen={session.id === currentSessionId}
                isRenaming={session.id === renamingId}
                canChange={canChange}
                onOpen={() => handleOpen(session.id)}
                onStartRename={() => setRenamingId(session.id)}
                onCancelRename={() => setRenamingId(null)}
                onRename={(name) => handleRename(session.id, name)}
                onDelete={() => askDelete(session)}
              />
            ))}
          </ul>
        ) : (
          <p data-lista-sessoes="" tabIndex={-1} className="text-neutro-tintaFraca outline-none">
            Nenhuma sessão guardada neste aparelho.
          </p>
        )}
      </div>
    </ModalShell>
  );
}
