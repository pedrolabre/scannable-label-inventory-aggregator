import { useCallback, useState } from 'react';

import AppHeader from './components/AppHeader.jsx';
import AppShell, { SHELL_VIEWS, isWideScreen } from './components/AppShell.jsx';
import CaptureColumn from './components/capture/CaptureColumn.jsx';
import DetailColumn from './components/detail/DetailColumn.jsx';
import RejectedDialog from './components/detail/RejectedDialog.jsx';
import StatusBar from './components/layout/StatusBar.jsx';
import ProductsColumn from './components/products/ProductsColumn.jsx';
import SessionDialog from './components/sessions/SessionDialog.jsx';
import useInventoryReport from './components/useInventoryReport.js';

/**
 * Montagem da tela e o pouco de estado que nao pertence a nenhuma coluna.
 *
 * A vista ativa da tela estreita mora aqui e morre no recarregamento: ela so
 * decide qual coluna aparece abaixo do ponto de corte, e na tela larga as tres
 * estao sempre a vista. A tela abre na Entrada, porque o primeiro gesto de uma
 * contagem e fotografar.
 *
 * O instante do relatorio e fixado uma vez, na montagem: a tela nao o mostra, e
 * assim so o conteudo da sessao refaz a conta.
 *
 * Um dialogo por vez, e por isso `openModal` guarda um identificador e nao uma
 * pilha: dois dialogos abertos dariam duas ordens de foco e dois `Esc`. Ele
 * tambem morre no recarregamento. Sao dois: sessoes, aberto pelo topo da
 * Entrada, e rejeitados e fotos com falha, aberto pelo gatilho acima das fotos
 * da sessao, que so aparece quando ha o que mostrar.
 *
 * O produto selecionado e estado de tela como os outros: o codigo do sistema
 * e a sessao em que foi escolhido. A selecao se desfaz quando o produto sai do
 * relatorio (a foto dele foi removida) ou quando outra sessao abre, mesmo que
 * ela tenha um produto com o mesmo codigo. Escolher um produto leva a vista
 * Detalhe, que na tela estreita e a unica a mostra.
 */

const MODALS = Object.freeze({ SESSIONS: 'sessoes', ISSUES: 'rejeitados' });

const NO_SESSION = 'sem-sessao';

export default function App() {
  const [activeView, setActiveView] = useState(SHELL_VIEWS.INTAKE);
  const [generatedAt] = useState(() => new Date().toISOString());
  const [openModal, setOpenModal] = useState(null);
  const [selection, setSelection] = useState(null);
  const [detailFocusRequest, setDetailFocusRequest] = useState(0);
  const report = useInventoryReport(generatedAt);
  const closeModal = useCallback(() => setOpenModal(null), []);

  const sessionId = report?.header.sessionId ?? null;
  const selectedProduct =
    selection && selection.sessionId === sessionId
      ? (report.products.find((product) => product.systemCode === selection.systemCode) ?? null)
      : null;

  // A selecao guardada acompanha o relatorio na tela. Sem isso, o produto que
  // saiu voltaria a aparecer selecionado se a foto dele fosse enviada de novo.
  if (selection && !selectedProduct) {
    setSelection(null);
  }

  const selectProduct = useCallback(
    (systemCode) => {
      setSelection({ sessionId, systemCode });
      setActiveView(SHELL_VIEWS.DETAIL);

      if (!isWideScreen()) {
        setDetailFocusRequest((request) => request + 1);
      }
    },
    [sessionId],
  );

  return (
    <>
      <AppShell
        activeView={activeView}
        header={<AppHeader activeView={activeView} onViewChange={setActiveView} />}
        left={
          <CaptureColumn
            onOpenSessions={() => setOpenModal(MODALS.SESSIONS)}
            onOpenIssues={() => setOpenModal(MODALS.ISSUES)}
            rejectedCount={report?.totals.rejectedCount ?? 0}
            failedCount={report?.header.failedSourceCount ?? 0}
          />
        }
        center={
          <ProductsColumn
            key={sessionId ?? NO_SESSION}
            products={report?.products}
            conflicts={report?.conflicts}
            selectedCode={selectedProduct?.systemCode ?? null}
            onSelect={selectProduct}
          />
        }
        right={
          <DetailColumn
            report={report}
            product={selectedProduct}
            focusRequest={detailFocusRequest}
          />
        }
        status={<StatusBar sourceCount={report?.header.sourceCount ?? 0} totals={report?.totals} />}
      />

      {openModal === MODALS.SESSIONS ? <SessionDialog onClose={closeModal} /> : null}
      {openModal === MODALS.ISSUES && report ? (
        <RejectedDialog rejected={report.rejected} sources={report.sources} onClose={closeModal} />
      ) : null}
    </>
  );
}
