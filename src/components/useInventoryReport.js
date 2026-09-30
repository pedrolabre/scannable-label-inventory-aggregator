import { useMemo } from 'react';

import { buildInventoryReport } from '../domain/services/inventoryReport.js';
import { useSessionStore } from '../store/useSessionStore.js';

/**
 * Relatorio da sessao aberta, derivado do store a cada mudanca do conteudo
 * dela e nunca gravado. A tela inteira le este mesmo objeto.
 *
 * `generatedAt` chega de quem chama: o relatorio nao le o relogio, e a tela
 * fixa o instante uma vez, para que so o conteudo da sessao refaca a conta.
 *
 * O store troca a sessao aberta e o conteudo dela juntos, entao o relatorio
 * nunca mistura uma sessao com as leituras de outra; enquanto outra sessao
 * carrega, continua o da que esta aberta. Sem sessao aberta, devolve `null`.
 */

const selectOpenSession = (state) =>
  state.sessions.find((session) => session.id === state.currentSessionId) ?? null;

export default function useInventoryReport(generatedAt) {
  const session = useSessionStore(selectOpenSession);
  const sources = useSessionStore((state) => state.sources);
  const readings = useSessionStore((state) => state.readings);
  const resolutions = useSessionStore((state) => state.resolutions);

  return useMemo(() => {
    if (!session) {
      return null;
    }

    return buildInventoryReport({ session, sources, readings, resolutions, generatedAt });
  }, [session, sources, readings, resolutions, generatedAt]);
}
