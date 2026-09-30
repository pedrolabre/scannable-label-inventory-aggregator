import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

import { cx } from '../../lib/cx.js';

import IconButton from './IconButton.jsx';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Nem todo ambiente calcula layout. No navegador, `getClientRects()` vazio e o
// sinal de que o elemento nao esta na tela. Num ambiente sem layout, o mesmo
// teste devolve vazio para tudo, e o cerco do foco nao valeria em teste
// nenhum. Entao a pergunta vem antes: este documento desenha? O corpo da
// pagina sempre tem caixa onde ha layout, e nunca tem onde nao ha.
function documentHasLayout(element) {
  const body = element?.ownerDocument?.body;

  return Boolean(body) && body.getClientRects().length > 0;
}

function focusableElementsOf(container) {
  if (!container) {
    return [];
  }

  const candidates = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));

  if (!documentHasLayout(container)) {
    return candidates;
  }

  return candidates.filter((element) => element.getClientRects().length > 0);
}

/**
 * Estrutura compartilhada dos dialogos: cortina escura, painel de canto reto,
 * cabecalho fixo, corpo rolavel e rodape de acoes.
 *
 * Enquanto o dialogo esta aberto ele e o unico alvo do teclado: `Tab` circula
 * entre os controles do painel sem escapar para a tela atras, `Esc` fecha. O
 * foco entra no botao de fechar quando o dialogo aparece e volta para o
 * elemento que o abriu quando ele sai, de modo que quem navega por teclado
 * retoma de onde parou. O titulo nomeia o dialogo para leitores de tela.
 *
 * Um controle de dentro que precisa do proprio `Esc`, como o campo em edicao,
 * para a propagacao da tecla: ela nao chega ao documento e o dialogo fica.
 *
 * `width` e a largura do painel em pixel, a medida do desenho. O painel para em
 * `calc(100dvh - 96px)` e quem cresce e o corpo, pelo mesmo padrao das colunas.
 *
 * Abaixo do ponto de corte a medida do desenho deixa de valer: todo dialogo
 * ocupa a janela, menos 16 px de cada lado, na largura e na altura. `compact` e
 * a excecao: a confirmacao curta, que e uma pergunta e nao uma tarefa,
 * continua do tamanho do proprio texto.
 *
 * `closeOnBackdrop` em `false` deixa o clique fora sem efeito, para o dialogo
 * com trabalho em andamento que o clique descartaria.
 *
 * `footer` recebe os botoes de acao ja montados, para que cada dialogo decida o
 * proprio conjunto sem que esta estrutura precise conhece-lo.
 */
export default function ModalShell({
  title,
  subtitle,
  width = 560,
  closeOnBackdrop = true,
  compact = false,
  onClose,
  footer,
  children,
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;

    closeButtonRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const panel = panelRef.current;
      const focusable = focusableElementsOf(panel);

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // O foco pode estar fora do painel quando o usuario volta da barra do
      // navegador com `Tab`: nesse caso ele reentra pelo primeiro controle.
      if (!panel?.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // O clique so fecha quando nasce na propria cortina: arrastar uma selecao de
  // dentro do painel e soltar fora nao deve descartar o dialogo.
  function handleOverlayMouseDown(event) {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutro-cortina p-4"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width, maxWidth: '100%' }}
        className={cx(
          'flex max-h-[calc(100dvh-96px)] flex-col rounded border',
          'border-neutro-borda bg-neutro-branco shadow-modal',
          compact
            ? null
            : 'max-lg:!h-[calc(100dvh-32px)] max-lg:!max-h-none max-lg:!w-[calc(100dvw-32px)]',
        )}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-neutro-borda px-recuo py-4 lg:py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h2
              id={titleId}
              className="break-words font-display text-xl font-bold leading-tight tracking-[-0.015em] text-neutro-tinta lg:text-lg"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="break-words text-rotulo leading-snug text-neutro-tintaFraca">
                {subtitle}
              </p>
            ) : null}
          </div>

          <IconButton ref={closeButtonRef} label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-recuo py-4">{children}</div>

        {footer ? (
          <footer className="flex flex-none flex-col-reverse gap-2 border-t border-neutro-borda px-recuo py-3 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
