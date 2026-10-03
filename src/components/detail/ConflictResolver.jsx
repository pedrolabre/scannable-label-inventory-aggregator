import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { IGNORED_CHOICE_REASONS } from '../../domain/services/conflictResolution.js';
import { CONFLICT_STATUSES } from '../../domain/services/reportSections.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import InlineAlert from '../ui/InlineAlert.jsx';

import ConflictField from './ConflictField.jsx';
import { choiceErrorText } from './detailText.js';
import IgnoredChoiceNote from './IgnoredChoiceNote.jsx';
import { copyNumberByText } from './productDetail.js';

/**
 * Conflitos do produto escolhido, campo a campo, e as escolhas gravadas que
 * deixaram de valer.
 *
 * Escolher grava pela acao do store (`resolveConflict`), e desfazer ou
 * descartar retira pela outra (`clearResolution`); o relatorio, derivado da
 * sessao, se refaz na hora, com a tabela e a linha de estado junto. A
 * quantidade nunca muda: a escolha so define os dados que saem no relatorio.
 *
 * Uma gravacao por vez no produto inteiro. O store soma a escolha nova as ja
 * gravadas do produto lidas na hora da chamada, e duas gravacoes em voo fariam
 * a segunda apagar a primeira. Enquanto uma volta, os botoes ficam ocupados.
 *
 * Com a fila de fotos andando a escolha continua liberada: a foto nova so pode
 * acrescentar variante, e a escolha que deixar de valer aparece como ignorada.
 * Com a sessao carregando, ela fica desligada, com a frase do motivo.
 *
 * Foco: depois de escolher ele fica no botao escolhido, que continua na tela.
 * Desfazer tira o proprio botao, e o foco vai a variante que estava escolhida;
 * descartar tira a nota, e o foco vai ao titulo da secao, ou ao nome do
 * produto (`fallbackFocusRef`) quando a secao inteira sai.
 */
export default function ConflictResolver({
  sessionId,
  systemCode,
  conflicts,
  ignoredChoices,
  copies,
  fallbackFocusRef,
}) {
  const isLoading = useSessionStore((state) => state.isLoading);
  const resolveConflict = useSessionStore((state) => state.resolveConflict);
  const clearResolution = useSessionStore((state) => state.clearResolution);

  const [busyField, setBusyField] = useState(null);
  const [errors, setErrors] = useState({});
  const [focusTarget, setFocusTarget] = useState(null);
  const busyRef = useRef(false);
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const headingId = useId();

  const copyNumbers = useMemo(() => copyNumberByText(copies), [copies]);
  const conflictFields = new Set(conflicts.map((conflict) => conflict.field));
  const notVariant = new Map(
    ignoredChoices
      .filter((choice) => choice.reason === IGNORED_CHOICE_REASONS.NOT_A_VARIANT)
      .map((choice) => [choice.field, choice]),
  );
  const orphans = ignoredChoices.filter(
    (choice) =>
      choice.reason === IGNORED_CHOICE_REASONS.NO_CONFLICT && !conflictFields.has(choice.field),
  );
  const openCount = conflicts.filter((item) => item.status === CONFLICT_STATUSES.OPEN).length;

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    const variant =
      focusTarget.field === undefined
        ? null
        : sectionRef.current?.querySelector(
            `[data-campo="${focusTarget.field}"] [data-variante="${focusTarget.index}"]`,
          );

    (variant ?? headingRef.current ?? fallbackFocusRef?.current)?.focus();
    setFocusTarget(null);
  }, [focusTarget, fallbackFocusRef]);

  async function write(field, action, nextFocus) {
    if (busyRef.current || isLoading) {
      return;
    }

    busyRef.current = true;
    setBusyField(field);
    setErrors((current) => ({ ...current, [field]: null }));

    try {
      await action();

      if (nextFocus) {
        setFocusTarget(nextFocus);
      }
    } catch (error) {
      setErrors((current) => ({ ...current, [field]: choiceErrorText(error) }));
    } finally {
      busyRef.current = false;
      setBusyField(null);
    }
  }

  if (conflicts.length === 0 && orphans.length === 0) {
    return null;
  }

  const isBusy = busyField !== null;

  return (
    <section ref={sectionRef} aria-labelledby={headingId} data-conflitos="" className="space-y-3">
      <div className="space-y-1">
        <h4
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="text-rotulo font-semibold text-neutro-tintaMedia outline-none"
        >
          Conflitos
        </h4>
        <p data-resumo-conflitos="" className="text-rotulo text-neutro-tintaFraca">
          {conflicts.length === 0
            ? 'Nenhum conflito nas leituras deste produto.'
            : openCount === 0
              ? 'Todos resolvidos. A quantidade não muda com a escolha.'
              : `${openCount} em aberto. Escolha o valor que vale para o relatório; a quantidade não muda.`}
        </p>
        {isLoading ? (
          <p data-escolha-desligada="" className="text-rotulo text-neutro-tintaFraca">
            A escolha fica desligada enquanto a sessão carrega.
          </p>
        ) : null}
      </div>

      {conflicts.map((conflict) => (
        <ConflictField
          key={conflict.field}
          conflict={conflict}
          copyNumbers={copyNumbers}
          ignoredChoice={notVariant.get(conflict.field) ?? null}
          isBusy={isBusy}
          isDisabled={isLoading}
          error={errors[conflict.field] ?? null}
          onChoose={(value, index, isChosen) => {
            if (!isChosen) {
              write(conflict.field, () =>
                resolveConflict(sessionId, systemCode, conflict.field, value),
              );
            }
          }}
          onUndo={(index) =>
            write(conflict.field, () => clearResolution(sessionId, systemCode, conflict.field), {
              field: conflict.field,
              index,
            })
          }
        />
      ))}

      {orphans.map((choice) => (
        <div key={choice.field} className="space-y-2">
          <IgnoredChoiceNote
            choice={choice}
            withTitle
            isBusy={isBusy}
            isDisabled={isLoading}
            onDiscard={() =>
              write(choice.field, () => clearResolution(sessionId, systemCode, choice.field), {})
            }
          />
          {errors[choice.field] ? <InlineAlert>{errors[choice.field]}</InlineAlert> : null}
        </div>
      ))}
    </section>
  );
}
