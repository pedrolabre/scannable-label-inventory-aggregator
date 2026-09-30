import { useEffect, useId, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import { describeStorageError } from '../../storage/storageError.js';
import Button from '../ui/Button.jsx';
import Field, { TextInput } from '../ui/Field.jsx';
import IconButton from '../ui/IconButton.jsx';

import { formatSessionDate, sessionNameCount, sessionNameIssue } from './sessionText.js';

/**
 * Uma sessao na lista do dialogo: o nome, a data da ultima alteracao, a marca
 * da sessao aberta e as acoes de abrir, renomear e apagar.
 *
 * O renomear acontece na propria linha. `Enter` grava; `Esc` desiste da edicao
 * e para ali, sem fechar o dialogo, e o foco volta ao botao de renomear. O
 * nome passa pela mesma regra da gravacao antes de sair daqui, e a recusa
 * aparece com a frase dela, sem cortar o que foi digitado.
 *
 * O nome foi digitado por alguem e aparece sempre como texto.
 */
export default function SessionRow({
  session,
  isOpen,
  isRenaming,
  canChange,
  onOpen,
  onStartRename,
  onCancelRename,
  onRename,
  onDelete,
}) {
  const [draft, setDraft] = useState(session.name);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);
  const renameButtonRef = useRef(null);
  const wasRenaming = useRef(isRenaming);
  const restoreFocus = useRef(false);
  const inputId = useId();

  useEffect(() => {
    if (isRenaming && !wasRenaming.current) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }

    if (!isRenaming && wasRenaming.current && restoreFocus.current) {
      renameButtonRef.current?.focus();
    }

    restoreFocus.current = false;

    wasRenaming.current = isRenaming;
  }, [isRenaming]);

  function startRename() {
    setDraft(session.name);
    setError(null);
    onStartRename();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const issue = sessionNameIssue(draft);

    if (issue) {
      setError(issue);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      restoreFocus.current = true;
      await onRename(draft);
    } catch (failure) {
      restoreFocus.current = false;
      setError(describeStorageError(failure));
    } finally {
      setIsSaving(false);
    }
  }

  function cancelRename() {
    restoreFocus.current = true;
    onCancelRename();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelRename();
    }
  }

  if (isRenaming) {
    return (
      <li data-sessao={session.id} className="px-4 py-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field id={inputId} label="Nome da sessão" hint={sessionNameCount(draft)} error={error}>
            {(control) => (
              <TextInput
                {...control}
                ref={inputRef}
                focus="brand"
                value={draft}
                autoComplete="off"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
              />
            )}
          </Field>

          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={cancelRename} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              Salvar nome
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      data-sessao={session.id}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3"
    >
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words font-semibold text-neutro-tinta">{session.name}</p>
        <p className="text-rotulo text-neutro-tintaFraca">
          Alterada em {formatSessionDate(session.updatedAt)}
        </p>
      </div>

      <div className="flex flex-none items-center gap-2">
        {isOpen ? (
          <span className="rounded border border-marca-verdeBorda bg-marca-verdeTenue px-2 py-0.5 text-rotulo font-semibold text-marca-verdeTexto">
            Aberta
          </span>
        ) : (
          <Button onClick={onOpen} disabled={!canChange}>
            Abrir
          </Button>
        )}

        <IconButton ref={renameButtonRef} label={`Renomear ${session.name}`} onClick={startRename}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </IconButton>

        <IconButton
          label={`Apagar ${session.name}`}
          tone="danger"
          data-apagar=""
          onClick={onDelete}
          disabled={!canChange}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>
    </li>
  );
}
