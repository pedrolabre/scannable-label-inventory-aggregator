import ShellColumn from '../layout/ShellColumn.jsx';

import CaptureButtons from './CaptureButtons.jsx';
import CaptureSession from './CaptureSession.jsx';
import SourceQueue from './SourceQueue.jsx';

/**
 * Coluna Entrada: a sessao aberta, os dois caminhos de foto e a fila com o
 * resultado de cada uma, nessa ordem, que e a ordem do gesto.
 *
 * A frase sobre o aparelho fica junto dos botoes de foto, e nao no topo da
 * tela: e na hora de mandar a foto que importa saber que ela nao sai daqui.
 */
export default function CaptureColumn() {
  return (
    <ShellColumn title="Entrada" bodyClassName="space-y-6">
      <CaptureSession />

      <div className="space-y-3">
        <CaptureButtons />
        <p data-aviso-aparelho="" className="text-rotulo text-neutro-tintaFraca">
          Tudo roda neste aparelho: as fotos e as leituras ficam aqui, sem enviar nada pela
          internet.
        </p>
      </div>

      <SourceQueue />
    </ShellColumn>
  );
}
