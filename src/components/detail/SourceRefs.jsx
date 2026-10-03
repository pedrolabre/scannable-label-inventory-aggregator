import { cx } from '../../lib/cx.js';

import { fileNameText } from './detailText.js';

/**
 * Fotos em que um exemplar apareceu, pelo nome do arquivo, na ordem do
 * relatorio. O nome vem do aparelho de quem fotografou e aparece como texto.
 */
export default function SourceRefs({ sources, className }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <p
      data-fotos-origem=""
      className={cx('break-all text-rotulo text-neutro-tintaMedia', className)}
    >
      <span className="break-normal text-neutro-tintaFraca">
        {sources.length === 1 ? 'Foto: ' : 'Fotos: '}
      </span>
      {sources.map((source, index) => (
        <span key={source.sourceId}>
          {index > 0 ? ', ' : null}
          {fileNameText(source.fileName)}
        </span>
      ))}
    </p>
  );
}
