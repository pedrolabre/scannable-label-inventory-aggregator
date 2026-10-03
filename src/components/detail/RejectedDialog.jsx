import { SOURCE_STATUSES } from '../../domain/schemas/sourceSchema.js';
import { countLabel } from '../capture/captureText.js';
import ModalShell from '../ui/ModalShell.jsx';

import { fileNameText } from './detailText.js';

/**
 * Textos rejeitados e fotos com falha da sessao aberta, em duas listas, cada
 * linha com a foto e o motivo.
 *
 * O texto rejeitado aparece cortado (`displayText`, 120 grafemas com `…`): um
 * QR Code fora do contrato pode trazer milhares de caracteres, e o texto
 * inteiro fica para a exportacao. O motivo ja nomeia o campo recusado
 * (`campo inválido: nome`). Texto e nome de arquivo aparecem como texto, nunca
 * como marcacao.
 *
 * O dialogo e so leitura: nada aqui muda a sessao. O foco preso, o `Esc` e a
 * volta do foco ao gatilho vem do `ModalShell`.
 */

const EMPTY_TEXT = '(texto vazio)';

function Section({ id, title, empty, children, count }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-rotulo font-semibold text-neutro-tintaMedia">
        {title} <span className="tabular-nums text-neutro-tintaFraca">({count})</span>
      </h3>
      {count === 0 ? (
        <p className="text-rotulo text-neutro-tintaFraca">{empty}</p>
      ) : (
        <ul className="divide-y divide-neutro-divisor border-y border-neutro-divisor">
          {children}
        </ul>
      )}
    </section>
  );
}

export default function RejectedDialog({ rejected, sources, onClose }) {
  const failed = sources.filter((source) => source.status === SOURCE_STATUSES.FAILED);

  return (
    <ModalShell
      title="Rejeitados e fotos com falha"
      subtitle={`${countLabel(rejected.length, 'texto rejeitado', 'textos rejeitados')}, ${countLabel(failed.length, 'foto com falha', 'fotos com falha')}. Nada disso entra na contagem.`}
      onClose={onClose}
    >
      <div className="space-y-6 text-sm">
        <Section
          id="rejected-texts-title"
          title="Textos rejeitados"
          count={rejected.length}
          empty="Nenhum texto rejeitado nesta sessão."
        >
          {rejected.map((entry) => (
            <li key={entry.readingId} data-rejeitado={entry.reason} className="space-y-1 py-2">
              <p className="break-all font-semibold text-neutro-tinta">
                {fileNameText(entry.fileName)}
              </p>
              <p className="text-marca-vermelhoTexto">{entry.message}</p>
              <p data-texto-rejeitado="" className="break-all text-rotulo text-neutro-tintaMedia">
                {entry.displayText === '' ? EMPTY_TEXT : entry.displayText}
              </p>
            </li>
          ))}
        </Section>

        <Section
          id="failed-sources-title"
          title="Fotos com falha"
          count={failed.length}
          empty="Nenhuma foto com falha nesta sessão."
        >
          {failed.map((source) => (
            <li
              key={source.sourceId}
              data-foto-falha={source.failureReason}
              className="space-y-1 py-2"
            >
              <p className="break-all font-semibold text-neutro-tinta">
                {fileNameText(source.fileName)}
              </p>
              <p className="text-marca-vermelhoTexto">{source.failureMessage}</p>
            </li>
          ))}
        </Section>
      </div>
    </ModalShell>
  );
}
