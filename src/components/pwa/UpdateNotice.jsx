import { RefreshCw } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { applyPendingUpdate, getUpdateSnapshot, subscribeToUpdate } from '../../pwa/updateState.js';
import { CAPTURE_ITEM_STATUSES } from '../../store/captureItem.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import Button from '../ui/Button.jsx';

const DETAIL_ID = 'aviso-versao-detalhe';

const WAITING_STATUSES = new Set([CAPTURE_ITEM_STATUSES.PENDING, CAPTURE_ITEM_STATUSES.PROCESSING]);

/**
 * Fotos da fila que ainda nao foram gravadas: as que esperam a vez ou estao em
 * leitura, e as que falharam por um motivo que nao e do arquivo e aguardam
 * nova tentativa. As duas listas so existem na memoria da pagina.
 */
export function queueStateOf(items) {
  let waiting = 0;
  let failed = 0;

  for (const item of items ?? []) {
    if (WAITING_STATUSES.has(item.status)) {
      waiting += 1;
    } else if (item.status === CAPTURE_ITEM_STATUSES.ERROR) {
      failed += 1;
    }
  }

  return { waiting, failed };
}

/** Frase abaixo do titulo, conforme o que a fila ainda guarda. */
export function updateDetailOf({ waiting, failed }) {
  if (waiting > 0) {
    return waiting === 1
      ? 'Atualize quando a fila terminar: 1 foto ainda não foi gravada.'
      : `Atualize quando a fila terminar: ${waiting} fotos ainda não foram gravadas.`;
  }

  if (failed > 0) {
    return failed === 1
      ? 'A foto com erro na fila sai da lista ao atualizar e precisa ser enviada de novo.'
      : `As ${failed} fotos com erro na fila saem da lista ao atualizar e precisam ser enviadas de novo.`;
  }

  return 'A sessão e as fotos gravadas continuam.';
}

/**
 * Aviso de versao nova, numa faixa entre o cabecalho e as colunas.
 *
 * A faixa entra no fluxo, sem sombra e sem flutuar sobre a tela: as colunas
 * cedem a altura dela, e a pagina continua sem rolagem. A frase de sempre e
 * curta de proposito: ao lado do botao, na tela de 390 px, ela cabe em duas
 * linhas, e a faixa toma o minimo da coluna. Ela nao toma o foco;
 * quem navega por teclado a encontra logo depois do cabecalho, e o texto e
 * anunciado pela regiao de estado, que existe sempre, vazia sem versao nova.
 *
 * `Atualizar` ativa a versao nova e recarrega a pagina. Enquanto houver foto
 * esperando a vez ou em leitura, o botao espera, com `aria-disabled` para
 * continuar focavel, e a frase diz quantas faltam: a fila so existe na memoria
 * e seria perdida. Foto que falhou e aguarda nova tentativa nao prende a
 * troca, porque pode nunca ser tentada de novo; a frase avisa que ela sai da
 * lista.
 */
export default function UpdateNotice() {
  const updateAvailable = useSyncExternalStore(
    subscribeToUpdate,
    getUpdateSnapshot,
    getUpdateSnapshot,
  );
  const items = useCaptureStore((state) => state.items);
  const queue = queueStateOf(items);
  const mustWait = queue.waiting > 0;

  function handleUpdate() {
    if (!mustWait) {
      applyPendingUpdate();
    }
  }

  return (
    <div role="status" data-aviso-versao="" className="flex-none">
      {updateAvailable ? (
        <section
          aria-label="Versão nova"
          className="flex items-center gap-3 border-b border-neutro-borda bg-neutro-branco px-recuo py-2"
        >
          <RefreshCw className="h-4 w-4 flex-none text-marca-vermelho" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-neutro-tintaMedia">
            <span className="font-semibold text-neutro-tinta">Versão nova disponível.</span>{' '}
            <span id={DETAIL_ID}>{updateDetailOf(queue)}</span>
          </p>
          <Button
            className="flex-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            aria-disabled={mustWait ? 'true' : undefined}
            aria-describedby={DETAIL_ID}
            onClick={handleUpdate}
          >
            Atualizar
          </Button>
        </section>
      ) : null}
    </div>
  );
}
