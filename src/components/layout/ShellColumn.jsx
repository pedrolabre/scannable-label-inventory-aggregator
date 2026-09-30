import { cx } from '../../lib/cx.js';

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
 *       <div>                        flex: none (titulo e acoes)
 *       <div data-corpo>             flex: 1 1 auto, min-height: 0, overflow-y: auto
 *     </section>
 *
 * A tela tem exatamente tres destas, uma por coluna, e nenhuma esta dentro de
 * outra. Qualquer quarta e defeito, nao decisao de quem escreve o componente.
 *
 * `title` e o texto visivel do cabecalho, e `actions` o acompanha na mesma
 * linha. `label` nomeia a regiao para quem usa leitor de tela e cai no proprio
 * titulo quando nao e informado.
 *
 * O recuo do corpo e o mesmo nas tres colunas e acompanha a densidade da tela;
 * `bodyClassName` acrescenta a ele o arranjo do conteudo.
 *
 * A regiao ocupa a altura inteira de quem a recebe. Na tela estreita ela vive
 * dentro de uma vista, e nao direto na grade, e sem isso o corpo nao teria
 * altura de onde rolar.
 */
export default function ShellColumn({
  title,
  label,
  actions,
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
      <div className="flex flex-none items-center justify-between gap-3 px-recuo pb-1 pt-4 lg:pt-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.09em] text-neutro-tintaFraca">
          {title}
        </h2>
        {actions}
      </div>

      <div
        data-corpo=""
        className={cx('min-h-0 flex-1 overflow-y-auto px-recuo pb-recuo pt-3', bodyClassName)}
      >
        {children}
      </div>
    </section>
  );
}
