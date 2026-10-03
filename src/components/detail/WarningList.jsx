import { fileNameText } from './detailText.js';

/**
 * Avisos de um exemplar: o mesmo texto em mais de uma posicao da mesma foto,
 * uma linha por foto, com a frase do relatorio e o nome da foto para a
 * conferencia a mao. Amarelo, porque e aviso: a contagem nao muda.
 */
export default function WarningList({ warnings }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Avisos" className="space-y-1">
      {warnings.map((warning) => (
        <li
          key={`${warning.code}-${warning.sourceId}`}
          data-aviso={warning.code}
          className="border-l-2 border-marca-amareloTexto pl-2 text-rotulo"
        >
          <p className="text-marca-amareloTexto">{warning.message}</p>
          <p className="break-all text-neutro-tintaFraca">em {fileNameText(warning.fileName)}</p>
        </li>
      ))}
    </ul>
  );
}
