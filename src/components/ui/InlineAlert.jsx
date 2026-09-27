import { cx } from '../../lib/cx.js';

/**
 * Aviso de erro exibido junto da acao que o gerou, em vez de uma faixa no topo
 * da aplicacao: quem acabou de tocar le a resposta no mesmo lugar em que tocou.
 *
 * O erro divide o vermelho com a marca e se distingue dela pelo peso: fundo
 * tenue, borda propria e texto proprio, nunca preenchimento cheio. Anuncia o
 * texto com `role="alert"` para quem usa leitor de tela.
 */
export default function InlineAlert({ className, children }) {
  return (
    <p
      role="alert"
      className={cx(
        'rounded border border-marca-vermelhoBorda bg-marca-vermelhoTenue p-3',
        'text-sm text-marca-vermelhoTexto',
        className,
      )}
    >
      {children}
    </p>
  );
}
