import { cx } from '../../lib/cx.js';

/**
 * Titulo de coluna, no desenho comum as tres. Exportado para a faixa propria de
 * uma coluna (`header`) continuar com o mesmo titulo das outras.
 */
export function ShellColumnTitle({ children }) {
  return (
    <h2 className="font-display text-xs font-semibold uppercase tracking-[0.09em] text-neutro-tintaFraca">
      {children}
    </h2>
  );
}

/**
 * Unica forma de criar regiao que rola na vertical.
 *
 * Ela encapsula o par que faz isso funcionar dentro de flex e que e a origem de
 * metade dos defeitos de layout nesse tipo de tela: o `min-height: 0` no
 * elemento intermediario, sem o qual o `overflow-y` do corpo nao vale, porque
 * um item de flex nao encolhe abaixo do proprio conteudo por padrao. Ele esta
 * aqui dentro para nao depender de quem monta a tela lembrar dele.
 *
 *     <section>                      flex column, min-height: 0
 *       <div>                        flex: none (titulo e acoes, ou a faixa propria)
 *       <div data-corpo>             flex: 1 1 auto, min-height: 0, overflow-y: auto
 *     </section>
 *
 * A tela tem exatamente tres destas, uma por coluna, e nenhuma esta dentro de
 * outra. Qualquer quarta e defeito, nao decisao de quem escreve o componente.
 *
 * O cabecalho tem duas formas. Na comum, `title` e o texto visivel e `actions`
 * o acompanha na mesma linha. Quando a coluna precisa de mais do que um titulo
 * (a de produtos tem a busca e a contagem), `header` substitui o conjunto e
 * recebe o desenho inteiro, sem recuo lateral, para que uma faixa possa
 * encostar nas bordas. `label` nomeia a regiao para quem usa leitor de tela e
 * cai no proprio titulo quando nao e informado; com `header`, ele e
 * obrigatorio.
 *
 * O recuo do corpo e o mesmo nas tres colunas e acompanha a densidade da tela;
 * `bodyClassName` acrescenta a ele o arranjo do conteudo, e `flush` tira o
 * recuo, para o corpo que encosta nas bordas, como a tabela de produtos.
 *
 * O corpo tem posicao relativa e contem o que e posicionado dentro dele. O
 * texto so para leitor de tela sai do fluxo com posicao absoluta; sem isso, o
 * de uma linha la embaixo da lista ficaria preso a janela, e nao ao corpo, e
 * esticaria a pagina que nao deve rolar.
 *
 * A regiao ocupa a altura inteira de quem a recebe. Na tela estreita ela vive
 * dentro de uma vista, e nao direto na grade, e sem isso o corpo nao teria
 * altura de onde rolar.
 */
export default function ShellColumn({
  title,
  label,
  actions,
  header,
  flush = false,
  className,
  bodyClassName,
  children,
  ...rest
}) {
  return (
    <section
      aria-label={label ?? title}
      className={cx('flex min-h-0 min-w-0 flex-1 flex-col', className)}
      {...rest}
    >
      <div className="flex-none">
        {header === undefined ? (
          <div className="flex items-center justify-between gap-3 px-recuo pb-1 pt-4 lg:pt-3">
            <ShellColumnTitle>{title}</ShellColumnTitle>
            {actions}
          </div>
        ) : (
          header
        )}
      </div>

      <div
        data-corpo=""
        className={cx(
          'relative min-h-0 flex-1 overflow-y-auto',
          flush ? null : 'px-recuo pb-recuo pt-3',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
