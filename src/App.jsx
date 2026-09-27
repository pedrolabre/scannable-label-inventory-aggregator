import CaptureButtons from './components/capture/CaptureButtons.jsx';
import CaptureSession from './components/capture/CaptureSession.jsx';
import SourceQueue from './components/capture/SourceQueue.jsx';
import { APP_NAME } from './lib/app-meta.js';

/**
 * Tela de leitura das fotos: sessao aberta, entrada de fotos e a fila com o
 * resultado de cada uma. A pagina nao rola (`global.css`); quem rola e o
 * corpo da tela.
 */
export default function App() {
  return (
    <main className="h-full overflow-y-auto bg-neutro-papel font-sans text-sm text-neutro-tinta">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-recuo py-6">
        <header className="space-y-2">
          <h1 className="font-display text-4xl font-bold tracking-tight text-marca-vermelho">
            {APP_NAME}
          </h1>
          <p className="text-neutro-tintaMedia">
            Tudo roda neste aparelho: as fotos e as leituras ficam aqui, sem enviar nada pela
            internet.
          </p>
        </header>

        <CaptureSession />
        <CaptureButtons />
        <SourceQueue />
      </div>
    </main>
  );
}
