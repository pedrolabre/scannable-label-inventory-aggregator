import { AlertTriangle } from 'lucide-react';

import Button from './Button.jsx';
import InlineAlert from './InlineAlert.jsx';
import ModalShell from './ModalShell.jsx';

/**
 * Pergunta antes de uma acao que remove dados. O icone de perigo ao lado da
 * mensagem e o rotulo explicito no botao de confirmacao dizem o que acontece
 * antes do toque, em vez de deixar a decisao para um "OK" generico.
 *
 * `error` mantem o dialogo aberto depois de uma confirmacao que falhou: o aviso
 * aparece abaixo da mensagem, o botao de confirmar volta a ficar ativo e serve
 * de nova tentativa, e cancelar continua descartando a acao.
 *
 * Ele fecha no clique fora porque nao ha trabalho em andamento para descartar:
 * o que se perde e uma pergunta ainda sem resposta.
 */
export default function ConfirmModal({
  title,
  subtitle,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isConfirming = false,
  error = null,
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      width={480}
      compact
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isConfirming}>
            {error ? 'Tentar de novo' : confirmLabel}
          </Button>
        </>
      }
    >
      <ConfirmMessage error={error}>{children}</ConfirmMessage>
    </ModalShell>
  );
}

/**
 * Corpo da pergunta: o icone de perigo, o texto e o aviso da tentativa que
 * falhou. Serve tambem ao dialogo que faz a pergunta num passo proprio, sem
 * abrir um segundo dialogo por cima.
 */
export function ConfirmMessage({ error = null, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-marca-vermelhoBorda bg-marca-vermelhoTenue text-marca-vermelhoTexto"
          aria-hidden="true"
        >
          <AlertTriangle className="h-5 w-5" />
        </span>

        <div className="min-w-0 space-y-2 text-sm leading-relaxed text-neutro-tintaMedia">
          {children}
        </div>
      </div>

      {error ? <InlineAlert>{error}</InlineAlert> : null}
    </div>
  );
}
