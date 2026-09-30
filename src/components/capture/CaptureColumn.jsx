import ShellColumn from '../layout/ShellColumn.jsx';
import SessionPicker from '../sessions/SessionPicker.jsx';

import CaptureButtons from './CaptureButtons.jsx';
import SessionSources from './SessionSources.jsx';
import SourceQueue from './SourceQueue.jsx';

/**
 * Coluna Entrada: a sessao aberta, os dois caminhos de foto, o lote em
 * andamento e as fotos gravadas na sessao, nessa ordem, que e a ordem do gesto.
 *
 * A frase sobre o aparelho fica junto dos botoes de foto, e nao no topo da
 * tela: e na hora de mandar a foto que importa saber que ela nao sai daqui.
 *
 * `onOpenSessions` abre o dialogo de sessoes, que mora no `App`: um dialogo por
 * vez, decidido num lugar so.
 */
export default function CaptureColumn({ onOpenSessions }) {
  return (
    <ShellColumn title="Entrada" bodyClassName="space-y-6">
      <SessionPicker onOpenSessions={onOpenSessions} />

      <div className="space-y-3">
        <CaptureButtons />
        <p data-aviso-aparelho="" className="text-rotulo text-neutro-tintaFraca">
          Tudo roda neste aparelho: as fotos e as leituras ficam aqui, sem enviar nada pela
          internet.
        </p>
      </div>

      <SourceQueue />
      <SessionSources />
    </ShellColumn>
  );
}
