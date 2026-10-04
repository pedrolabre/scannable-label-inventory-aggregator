/**
 * Disparo do download de um arquivo gerado na propria pagina.
 *
 * O endereco temporario e criado, usado e liberado na mesma chamada. Sem a
 * liberacao o navegador segura os bytes do arquivo ate a pagina ser fechada, e
 * cada exportacao repetida deixaria mais um arquivo inteiro na memoria.
 *
 * O documento e a fabrica de enderecos chegam por parametro, com o valor do
 * navegador como padrao. E o que permite conferir o disparo sem baixar nada.
 */
export function downloadBlob(blob, fileName, { documentRef = document, urlRef = URL } = {}) {
  const href = urlRef.createObjectURL(blob);

  try {
    const anchor = documentRef.createElement('a');

    anchor.href = href;
    anchor.download = fileName;
    anchor.rel = 'noopener';

    documentRef.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    urlRef.revokeObjectURL(href);
  }
}
