import { useState } from 'react';

import AppHeader from './components/AppHeader.jsx';
import AppShell, { SHELL_VIEWS } from './components/AppShell.jsx';
import CaptureColumn from './components/capture/CaptureColumn.jsx';
import ShellColumn from './components/layout/ShellColumn.jsx';
import StatusBar from './components/layout/StatusBar.jsx';
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
 */

function productsMessage(report) {
  const count = report?.totals.productCount ?? 0;

  if (count === 0) {
    return 'Nenhum produto lido nesta sessão. Envie fotos das etiquetas em Entrada.';
  }

  return count === 1 ? '1 produto lido nesta sessão.' : `${count} produtos lidos nesta sessão.`;
}

export default function App() {
  const [activeView, setActiveView] = useState(SHELL_VIEWS.INTAKE);
  const [generatedAt] = useState(() => new Date().toISOString());
  const report = useInventoryReport(generatedAt);

  return (
    <AppShell
      activeView={activeView}
      header={<AppHeader activeView={activeView} onViewChange={setActiveView} />}
      left={<CaptureColumn />}
      center={
        <ShellColumn title="Produtos">
          <p data-estado-produtos="" className="text-neutro-tintaFraca">
            {productsMessage(report)}
          </p>
        </ShellColumn>
      }
      right={
        <ShellColumn title="Detalhe">
          <p data-estado-detalhe="" className="text-neutro-tintaFraca">
            Nenhum produto selecionado.
          </p>
        </ShellColumn>
      }
      status={<StatusBar sourceCount={report?.header.sourceCount ?? 0} totals={report?.totals} />}
    />
  );
}
