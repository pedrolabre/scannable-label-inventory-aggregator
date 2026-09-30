import { APP_NAME } from '../lib/app-meta.js';

import { SHELL_VIEWS } from './AppShell.jsx';
import SegmentedControl from './ui/SegmentedControl.jsx';

const VIEW_OPTIONS = [
  { value: SHELL_VIEWS.INTAKE, label: 'Entrada' },
  { value: SHELL_VIEWS.PRODUCTS, label: 'Produtos' },
  { value: SHELL_VIEWS.DETAIL, label: 'Detalhe' },
];

/**
 * Faixa do topo: o nome do produto e, na tela estreita, a barra de vistas.
 *
 * A sessao aberta mora na coluna Entrada, junto das fotos que entram nela, e
 * nao aqui: o topo fica com o que vale para a tela inteira.
 *
 * O nome cede antes de qualquer outra coisa na linha: termina em reticencias em
 * vez de empurrar a faixa para uma segunda linha.
 *
 * Abaixo do ponto de corte a faixa ganha uma segunda linha, a barra de vistas,
 * que escolhe qual das tres colunas ocupa a tela. Na tela larga as tres estao
 * sempre a vista e a barra nao existe.
 */
export default function AppHeader({ activeView = SHELL_VIEWS.INTAKE, onViewChange }) {
  return (
    <header className="flex flex-none flex-col border-b border-neutro-borda bg-neutro-branco">
      <div className="flex h-topo min-w-0 items-center px-recuo">
        <h1 className="min-w-0 truncate font-display text-xl font-bold tracking-[-0.015em] text-marca-vermelho lg:text-lg">
          {APP_NAME}
        </h1>
      </div>

      <nav aria-label="Vistas" data-barra-vistas="" className="px-recuo pb-3 lg:hidden">
        <SegmentedControl
          legend="Vista"
          name="vista"
          options={VIEW_OPTIONS}
          value={activeView}
          onChange={onViewChange}
          stretch
          hideLegend
        />
      </nav>
    </header>
  );
}
