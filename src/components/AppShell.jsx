import { cx } from '../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './ui/focusClasses.js';

/**
 * Identificador do conteudo principal. Ele e o alvo do atalho que pula o
 * cabecalho e o ancora do proprio `main`, e existe como constante para que os
 * dois lados nao possam divergir.
 */
export const MAIN_CONTENT_ID = 'conteudo-principal';

/**
 * Vistas da tela estreita, na ordem em que aparecem na barra. Cada coluna da
 * tela larga vira uma vista, e so uma aparece por vez.
 */
export const SHELL_VIEWS = Object.freeze({
  INTAKE: 'entrada',
  PRODUCTS: 'produtos',
  DETAIL: 'detalhe',
});

/**
 * Consulta do ponto de corte, a mesma largura do `lg` do `tailwind.config.js`.
 * Serve ao que o CSS nao resolve sozinho, como decidir para onde vai o foco
 * depois de uma troca de vista que so existe na tela estreita.
 */
export const WIDE_SCREEN_QUERY = '(min-width: 1100px)';

/** `true` a partir do ponto de corte; sem `matchMedia`, vale a tela estreita. */
export function isWideScreen() {
  return typeof window.matchMedia === 'function' && window.matchMedia(WIDE_SCREEN_QUERY).matches;
}

/**
 * Contorno da aplicacao: cinco faixas em coluna, dentro da altura da janela,
 * mais o aviso de versao nova enquanto ele existir.
 *
 *     cabecalho          48 px    nome e, na tela estreita, a barra de vistas
 *     aviso              so com versao nova da aplicacao instalada
 *     coluna esquerda   240 px    entrada: sessao, fotos e fila
 *     coluna central    elastica  produtos
 *     coluna direita    288 px    detalhe do produto
 *     linha de estado    36 px    contagens da sessao
 *
 * As medidas sao as da tela larga, a partir do ponto de corte. Abaixo dele as
 * tres colunas nao cabem com a tabela legivel, e o contorno troca de forma uma
 * vez so: uma coluna por vez, escolhida pela barra de vistas do cabecalho. Nao
 * ha passo intermediario de duas colunas.
 *
 * A janela e o limite, nas duas formas. Este contorno tem a altura dela e nao
 * deixa nada transbordar, e `html`, `body` e `#root` ja nao tem para onde
 * rolar. O que rola e um corpo nomeado dentro de uma `ShellColumn`: tres na
 * tela larga, um na estreita.
 *
 * Cada coluna chega dentro de uma vista, que e so o lugar dela na grade. A
 * vista que nao e a ativa sai da tela estreita por inteiro, e nao fica atras da
 * outra: o que nao se ve tambem nao recebe foco nem e lido. Na tela larga as
 * tres aparecem sempre, e a vista ativa nao muda nada.
 *
 * O primeiro elemento focavel da tela e um atalho que leva direto ao conteudo.
 * Ele fica fora da vista ate receber foco, e so quem navega por teclado o
 * encontra.
 *
 * O `main` recebe `tabIndex` negativo porque um destino de ancora que nao
 * aceita foco e ignorado por parte dos navegadores: o endereco muda e o foco
 * fica onde estava. Com ele, o atalho move o foco de verdade, e o valor
 * negativo mantem o elemento fora da ordem de tabulacao.
 *
 * O aviso fica entre o cabecalho e as colunas, no fluxo: quando aparece, as
 * colunas cedem a altura dele, e nada se sobrepoe ao conteudo.
 *
 * As tres colunas chegam por posicao, e nao como filhos soltos: este contorno
 * decide onde cada uma vive e com que largura, e nao sabe nada do que ha
 * dentro delas.
 */
export default function AppShell({
  header,
  notice = null,
  left,
  center,
  right,
  status,
  activeView = SHELL_VIEWS.INTAKE,
}) {
  const columns = [
    [SHELL_VIEWS.INTAKE, left],
    [SHELL_VIEWS.PRODUCTS, center],
    [SHELL_VIEWS.DETAIL, right],
  ];

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-neutro-papel font-sans text-sm text-neutro-tinta">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className={cx(
          'sr-only rounded border border-marca-vermelho bg-neutro-branco px-4 py-2',
          'text-sm font-semibold text-marca-vermelho',
          'focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50',
          FOCUS_OUTLINE,
          FOCUS_OUTLINE_COLORS.brand,
        )}
      >
        Pular para o conteúdo
      </a>

      {header}

      {notice}

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:grid-cols-janela"
      >
        {columns.map(([view, column]) => (
          <div
            key={view}
            data-vista={view}
            data-vista-ativa={view === activeView ? '' : undefined}
            className={cx(
              'min-h-0 min-w-0 flex-col lg:flex',
              view === SHELL_VIEWS.PRODUCTS
                ? 'lg:border-x lg:border-neutro-borda'
                : 'bg-neutro-branco',
              view === activeView ? 'flex' : 'hidden',
            )}
          >
            {column}
          </div>
        ))}
      </main>

      {status}
    </div>
  );
}
