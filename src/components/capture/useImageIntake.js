import { useMemo } from 'react';

import { SOURCE_ORIGINS } from '../../domain/schemas/sourceSchema.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';

/**
 * Ponte entre os seletores de foto e a fila. Cada seletor entrega os arquivos
 * escolhidos com a propria origem: a camera tira uma foto por vez, o envio
 * traz varias.
 *
 * O seletor e esvaziado logo depois da escolha. Sem isso, escolher o mesmo
 * arquivo duas vezes seguidas nao dispara `change`, e a segunda tentativa
 * pareceria ignorada; e a fila que recusa a foto repetida, com a frase dela.
 */

function enqueueInStore(files, origin) {
  return useCaptureStore.getState().enqueue(files, origin);
}

/** Copia a lista escolhida e libera o seletor para a proxima escolha. */
export function takeSelectedFiles(input) {
  const files = Array.from(input?.files ?? []);

  if (input) {
    input.value = '';
  }

  return files;
}

export default function useImageIntake(enqueue = enqueueInStore) {
  return useMemo(() => {
    const handlerFor = (origin) => (event) => {
      const files = takeSelectedFiles(event.target);

      if (files.length === 0) {
        return;
      }

      // A fila guarda a situacao de cada foto; aqui so se entrega o lote.
      Promise.resolve(enqueue(files, origin)).catch(() => {});
    };

    return {
      onCameraChange: handlerFor(SOURCE_ORIGINS.CAMERA),
      onFilesChange: handlerFor(SOURCE_ORIGINS.FILE),
    };
  }, [enqueue]);
}
