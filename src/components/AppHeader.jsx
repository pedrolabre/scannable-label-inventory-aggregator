import { useEffect, useRef } from 'react';
import { Download, Trash2 } from 'lucide-react';

import { APP_NAME } from '../lib/app-meta.js';

import { SHELL_VIEWS } from './AppShell.jsx';
import Button from './ui/Button.jsx';
import SegmentedControl from './ui/SegmentedControl.jsx';

const VIEW_OPTIONS = [
  { value: SHELL_VIEWS.INTAKE, label: 'Entrada' },
  { value: SHELL_VIEWS.PRODUCTS, label: 'Produtos' },
  { value: SHELL_VIEWS.DETAIL, label: 'Detalhe' },
];

const HEADER_ACTION_CLASSES = 'flex-none max-lg:w-controle max-lg:px-0';
const HEADER_ACTION_LABEL_CLASSES = 'max-lg:sr-only';

/**
 * Faixa do topo: o nome do produto, a acao de exportar e, na tela estreita, a
 * barra de vistas.
 *
 * A sessao aberta mora na coluna Entrada, junto das fotos que entram nela, e
 * nao aqui: o topo fica com o que vale para a tela inteira. Exportar e uma
 * dessas acoes: o arquivo sai do relatorio inteiro, e nao de uma coluna.
 *
 * O nome e o botao dividem a mesma linha, nas duas larguras, e a faixa nao
 * cresce. O botao nunca encolhe; quem cede e o nome, que termina em
 * reticencias em vez de empurrar a faixa para uma segunda linha. O botao e
 * neutro: o vermelho cheio fica para o download, dentro do dialogo.
 * `exportDisabled` o desliga enquanto nao ha sessao aberta, e sem `onExport`
 * ele nao aparece.
 *
 * Abaixo do ponto de corte a faixa ganha uma segunda linha, a barra de vistas,
 * que escolhe qual das tres colunas ocupa a tela. Na tela larga as tres estao
 * sempre a vista e a barra nao existe.
 */
export default function AppHeader({
  activeView = SHELL_VIEWS.INTAKE,
  onViewChange,
  onExport,
  exportDisabled = false,
  onClear,
  clearDisabled = false,
  exportFocusRequest = 0,
}) {
  const exportRef = useRef(null);

  useEffect(() => {
    if (exportFocusRequest > 0) {
      exportRef.current?.focus();
    }
  }, [exportFocusRequest]);

  return (
    <header className="flex flex-none flex-col border-b border-neutro-borda bg-neutro-branco">
      <div className="flex h-topo min-w-0 items-center justify-between gap-4 px-recuo">
        <h1 className="min-w-0 flex-1 truncate font-display text-xl font-bold tracking-[-0.015em] text-marca-vermelho lg:text-lg">
          {APP_NAME}
        </h1>

        {onClear || onExport ? (
          <div className="flex flex-none items-center gap-2">
            {onClear ? (
              <Button
                data-gatilho-limpar=""
                className={HEADER_ACTION_CLASSES}
                disabled={clearDisabled}
                onClick={onClear}
              >
                <Trash2 className="h-4 w-4 lg:h-[15px] lg:w-[15px]" aria-hidden="true" />
                <span className={HEADER_ACTION_LABEL_CLASSES}>Limpar fotos</span>
              </Button>
            ) : null}

            {onExport ? (
              <Button
                ref={exportRef}
                data-gatilho-exportar=""
                className={HEADER_ACTION_CLASSES}
                disabled={exportDisabled}
                onClick={onExport}
              >
                <Download className="h-4 w-4 lg:h-[15px] lg:w-[15px]" aria-hidden="true" />
                <span className={HEADER_ACTION_LABEL_CLASSES}>Exportar</span>
              </Button>
            ) : null}
          </div>
        ) : null}
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
