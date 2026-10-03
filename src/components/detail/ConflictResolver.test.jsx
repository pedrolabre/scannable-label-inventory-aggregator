// @vitest-environment jsdom

import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildInventoryReport } from '../../domain/services/inventoryReport.js';
import { createResolutionError, RESOLUTION_ERRORS } from '../../store/resolutionChoices.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ConflictResolver from './ConflictResolver.jsx';
import { productDetailOf } from './productDetail.js';

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
});

const SESSION_ID = 'sessao-teste';

const READINGS = [
  readingOf(
    'l1',
    'f1',
    lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 900, copy: 'c1' }),
  ),
  readingOf(
    'l2',
    'f1',
    lf1Text({ systemCode: 'A-1', displayName: 'CAFÉ', price: 1000, ean: '20000042', copy: 'c2' }),
  ),
];

function detailOf(resolutions = []) {
  const report = buildInventoryReport({
    session: { id: SESSION_ID, name: 'Inventário' },
    sources: [sourceOf('f1')],
    readings: READINGS,
    resolutions,
    generatedAt: '2026-10-06T12:00:00.000Z',
  });

  return productDetailOf(report, 'A-1');
}

const chosen = (choices) => [{ sessionId: SESSION_ID, systemCode: 'A-1', choices }];

/** Acoes do store trocadas por funcoes contadas; `isLoading` como pedido. */
function stubStore({ resolveConflict, clearResolution, isLoading = false } = {}) {
  const actions = {
    resolveConflict: resolveConflict ?? vi.fn(async () => {}),
    clearResolution: clearResolution ?? vi.fn(async () => {}),
  };

  useSessionStore.setState({ ...actions, isLoading });

  return actions;
}

function renderResolver(detail, props = {}) {
  return view.render(
    <ConflictResolver
      sessionId={SESSION_ID}
      systemCode="A-1"
      conflicts={detail.conflicts}
      ignoredChoices={detail.ignoredChoices}
      copies={detail.copies}
      {...props}
    />,
  );
}

function field(name) {
  return view.container.querySelector(`[data-campo="${name}"]`);
}

function variant(name, index) {
  return field(name).querySelector(`[data-variante="${index}"]`);
}

describe('ConflictResolver', () => {
  it('lista os campos em conflito na ordem do relatório, com o resumo dos abertos', async () => {
    stubStore();
    await renderResolver(detailOf());

    const fields = [...view.container.querySelectorAll('[data-campo]')].map(
      (item) => item.dataset.campo,
    );

    expect(view.container.querySelector('h4').textContent).toBe('Conflitos');
    expect(fields).toEqual(['priceInCentavos', 'ean']);
    expect(view.container.querySelector('[data-resumo-conflitos]').textContent).toBe(
      '2 em aberto. Escolha o valor que vale para o relatório; a quantidade não muda.',
    );
    expect(variant('ean', 1).textContent).toBe('sem EAN1 exemplar: c1');
  });

  it('grava a variante tocada pelo store e deixa o foco nela', async () => {
    const actions = stubStore();

    await renderResolver(detailOf());
    await view.focus(variant('priceInCentavos', 1));
    await view.click(variant('priceInCentavos', 1));

    expect(actions.resolveConflict).toHaveBeenCalledWith(
      SESSION_ID,
      'A-1',
      'priceInCentavos',
      1000,
    );
    expect(document.activeElement).toBe(variant('priceInCentavos', 1));
  });

  it('não grava de novo a variante já escolhida', async () => {
    const actions = stubStore();

    await renderResolver(detailOf(chosen({ priceInCentavos: 1000 })));
    await view.click(variant('priceInCentavos', 1));

    expect(actions.resolveConflict).not.toHaveBeenCalled();
    expect(view.container.querySelector('[data-resumo-conflitos]').textContent).toBe(
      '1 em aberto. Escolha o valor que vale para o relatório; a quantidade não muda.',
    );
  });

  it('faz uma gravação por vez no produto, com os botões ocupados até ela voltar', async () => {
    let finish;
    const resolveConflict = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    stubStore({ resolveConflict });

    await renderResolver(detailOf());
    await view.click(variant('priceInCentavos', 0));
    await view.click(variant('ean', 0));

    expect(resolveConflict).toHaveBeenCalledTimes(1);
    expect(variant('ean', 0).getAttribute('aria-disabled')).toBe('true');
    expect(variant('ean', 0).disabled).toBe(false);

    await view.update(() => finish());
    await view.click(variant('ean', 0));

    expect(resolveConflict).toHaveBeenCalledTimes(2);
    expect(resolveConflict).toHaveBeenLastCalledWith(SESSION_ID, 'A-1', 'ean', '20000042');
  });

  it('desfaz pelo store e leva o foco à variante que estava escolhida', async () => {
    const actions = stubStore();

    await renderResolver(detailOf(chosen({ ean: null })));
    await view.click(field('ean').querySelector('[data-desfazer]'));

    expect(actions.clearResolution).toHaveBeenCalledWith(SESSION_ID, 'A-1', 'ean');

    await renderResolver(detailOf());

    expect(document.activeElement).toBe(variant('ean', 1));
    expect(field('ean').querySelector('[data-desfazer]')).toBeNull();
  });

  it('mostra a frase da recusa junto do campo e a apaga na tentativa seguinte', async () => {
    const resolveConflict = vi
      .fn()
      .mockRejectedValueOnce(createResolutionError(RESOLUTION_ERRORS.STALE_CONFLICT))
      .mockResolvedValueOnce(null);
    stubStore({ resolveConflict });

    await renderResolver(detailOf());
    await view.click(variant('ean', 0));

    expect(field('ean').querySelector('[role="alert"]').textContent).toBe(
      'Esta escolha não corresponde mais às variantes do produto. Confira o conflito e escolha de novo.',
    );
    expect(field('priceInCentavos').querySelector('[role="alert"]')).toBeNull();

    await view.click(variant('ean', 0));

    expect(field('ean').querySelector('[role="alert"]')).toBeNull();
  });

  it('mostra a falha do banco pela descrição das gravações', async () => {
    stubStore({ resolveConflict: vi.fn().mockRejectedValue(new Error('disco cheio')) });

    await renderResolver(detailOf());
    await view.click(variant('ean', 0));

    const alert = field('ean').querySelector('[role="alert"]').textContent;

    expect(alert).not.toContain('disco cheio');
    expect(alert.length).toBeGreaterThan(0);
  });

  it('desliga a escolha com a sessão carregando, com a frase do motivo', async () => {
    const actions = stubStore({ isLoading: true });

    await renderResolver(detailOf());

    expect(view.container.querySelector('[data-escolha-desligada]').textContent).toBe(
      'A escolha fica desligada enquanto a sessão carrega.',
    );
    expect(variant('ean', 0).disabled).toBe(true);

    await view.click(variant('ean', 0));

    expect(actions.resolveConflict).not.toHaveBeenCalled();
  });

  it('mostra a escolha que não é mais variante junto do campo, sem descartar', async () => {
    stubStore();

    await renderResolver(detailOf(chosen({ priceInCentavos: 1500 })));

    expect(field('priceInCentavos').querySelector('[data-escolha-ignorada]').textContent).toBe(
      'A escolha gravada (R$ 15,00) foi ignorada: o valor escolhido não está mais entre as variantes.',
    );
    expect(view.container.querySelector('[data-descartar]')).toBeNull();
  });

  it('descarta a escolha do campo que deixou de divergir e leva o foco ao título', async () => {
    const actions = stubStore();

    await renderResolver(detailOf(chosen({ displayName: 'CAFE' })));

    const note = view.container.querySelector('[data-escolha-ignorada="no-conflict"]');

    expect(note.querySelector('p').textContent).toBe(
      'Nome: A escolha gravada (CAFE) foi ignorada: os exemplares não divergem mais neste campo.',
    );

    await view.click(note.querySelector('[data-descartar]'));

    expect(actions.clearResolution).toHaveBeenCalledWith(SESSION_ID, 'A-1', 'displayName');
    expect(document.activeElement).toBe(view.container.querySelector('h4'));
  });

  it('leva o foco ao nome do produto quando a seção inteira sai', async () => {
    const orphan = {
      systemCode: 'A-1',
      field: 'displayName',
      value: 'CAFE',
      reason: 'no-conflict',
      message: 'os exemplares não divergem mais neste campo',
    };
    let setChoices;

    // O store de verdade troca o relatorio dentro da propria gravacao; aqui a
    // troca vem do descarte contado, no mesmo passo.
    function Screen() {
      const titleRef = useRef(null);
      const [choices, setState] = useState([orphan]);

      setChoices = setState;

      return (
        <>
          <h3 ref={titleRef} tabIndex={-1}>
            CAFÉ
          </h3>
          <ConflictResolver
            sessionId={SESSION_ID}
            systemCode="A-1"
            conflicts={[]}
            ignoredChoices={choices}
            copies={[]}
            fallbackFocusRef={titleRef}
          />
        </>
      );
    }

    stubStore({ clearResolution: vi.fn(async () => setChoices([])) });

    await view.render(<Screen />);
    await view.click(view.container.querySelector('[data-descartar]'));

    expect(view.container.querySelector('[data-conflitos]')).toBeNull();
    expect(document.activeElement).toBe(view.container.querySelector('h3'));
  });

  it('não desenha nada sem conflito e sem escolha ignorada', async () => {
    stubStore();

    await renderResolver({ conflicts: [], copies: [], ignoredChoices: [] });

    expect(view.container.innerHTML).toBe('');
  });
});
