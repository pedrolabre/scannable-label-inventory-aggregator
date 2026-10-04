/**
 * Uma linha de arquivo do dialogo de exportacao: o nome do arquivo, uma frase
 * sobre o que ele leva e o botao que o baixa (`children`). Na tela estreita o
 * botao fica abaixo do texto; a partir de `sm`, ao lado.
 */
export default function FileRow({ title, description, children }) {
  return (
    <div
      data-linha-arquivo=""
      className="flex flex-col gap-2 border-t border-neutro-divisor pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-neutro-tinta">{title}</p>
        <p className="text-rotulo text-neutro-tintaFraca">{description}</p>
      </div>
      {children}
    </div>
  );
}
