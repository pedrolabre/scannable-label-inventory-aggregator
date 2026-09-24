import { APP_NAME } from './lib/app-meta.js';

export default function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 bg-neutro-papel px-recuo text-center font-sans text-sm text-neutro-tinta">
      <h1 className="font-display text-4xl font-bold tracking-tight text-marca-vermelho">
        {APP_NAME}
      </h1>
      <p className="max-w-sm text-neutro-tintaMedia">
        Tudo roda neste aparelho: as fotos e as leituras ficam aqui, sem enviar nada pela
        internet.
      </p>
    </main>
  );
}
