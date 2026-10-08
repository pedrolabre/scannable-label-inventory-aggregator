import { useState } from 'react';

import { describeStorageError } from '../../storage/storageError.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import ConfirmModal from '../ui/ConfirmModal.jsx';

import { countLabel } from './captureText.js';

/** `3 fotos gravadas, 5 textos lidos e 1 escolha de conflito`. */
function joinCounts(parts) {
  if (parts.length <= 1) {
    return parts.join('');
  }

  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

export function useCanClearSources() {
  const hasSession = useSessionStore((state) => state.currentSessionId !== null);
  const isLoading = useSessionStore((state) => state.isLoading);
  const sourceCount = useSessionStore((state) => state.sources.length);
  const batchCount = useCaptureStore((state) => state.items.length);
  const isRunning = useCaptureStore((state) => state.isRunning);

  return hasSession && !isLoading && !isRunning && (sourceCount > 0 || batchCount > 0);
}

export default function ClearSourcesDialog({ onClose, onCleared }) {
  const sessions = useSessionStore((state) => state.sessions);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const sources = useSessionStore((state) => state.sources);
  const readings = useSessionStore((state) => state.readings);
  const resolutions = useSessionStore((state) => state.resolutions);
  const clearSessionSources = useSessionStore((state) => state.clearSessionSources);
  const batchCount = useCaptureStore((state) => state.items.length);
  const clearBatch = useCaptureStore((state) => state.clearBatch);

  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState(null);

  const sessionName = sessions.find((session) => session.id === currentSessionId)?.name;
  const hasStoredContent = sources.length > 0 || resolutions.length > 0;

  async function confirmClear() {
    setIsClearing(true);
    setError(null);

    try {
      if (hasStoredContent) {
        await clearSessionSources(currentSessionId);
      }

      clearBatch();
    } catch (failure) {
      setError(describeStorageError(failure));
      setIsClearing(false);

      return;
    }

    onCleared();
  }

  const counts = [
    countLabel(sources.length, 'foto gravada', 'fotos gravadas'),
    readings.length > 0 ? countLabel(readings.length, 'texto lido', 'textos lidos') : null,
    resolutions.length > 0
      ? countLabel(resolutions.length, 'escolha de conflito', 'escolhas de conflito')
      : null,
  ].filter(Boolean);

  return (
    <ConfirmModal
      title="Limpar fotos"
      subtitle={sessionName}
      confirmLabel="Limpar fotos"
      isConfirming={isClearing}
      error={error}
      onConfirm={confirmClear}
      onCancel={onClose}
    >
      <p data-limpeza-contagem="">
        {sources.length > 0
          ? `A limpeza apaga desta sessão ${joinCounts(counts)}.`
          : resolutions.length > 0
            ? `Nenhuma foto está gravada nesta sessão; a limpeza apaga ${joinCounts(counts.slice(1))}.`
            : 'Nenhuma foto está gravada nesta sessão.'}
        {batchCount > 0 ? ' A fila de fotos também é esvaziada.' : ''}
      </p>
      <p>
        A sessão continua aberta, com o mesmo nome, e as outras sessões não mudam. Esta limpeza não
        pode ser desfeita.
      </p>
    </ConfirmModal>
  );
}
