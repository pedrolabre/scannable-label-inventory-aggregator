// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ConflictField from './ConflictField.jsx';

const view = useReactRoot();

const TEXTS = {
  cheap: 'LF1|A-1|PRODUTO|900|||c2',
  dear: 'LF1|A-1|PRODUTO|1000|||c1',
  dearAgain: 'LF1|A-1|PRODUTO|1000|||c3',
};

const NUMBERS = new Map([
  [TEXTS.cheap, 'c2'],
  [TEXTS.dear, 'c1'],
  [TEXTS.dearAgain, 'c3'],
]);

const PRICE_CONFLICT = {
  systemCode: 'A-1',
  field: 'priceInCentavos',
  status: 'open',
  chosenValue: null,
  variants: [
    { value: 900, copyCount: 1, texts: [TEXTS.cheap] },
    { value: 1000, copyCount: 2, texts: [TEXTS.dear, TEXTS.dearAgain] },
  ],
};

function variants() {
  return [...view.container.querySelectorAll('[data-variante]')];
}

function renderField(props = {}) {
  return view.render(
    <ConflictField
      conflict={PRICE_CONFLICT}
      copyNumbers={NUMBERS}
      onChoose={vi.fn()}
      onUndo={vi.fn()}
      {...props}
    />,
  );
}

describe('ConflictField', () => {
  it('mostra as variantes na ordem recebida, com o preço em reais, a contagem e os cN', async () => {
    await renderField();

    const group = view.container.querySelector('[role="group"]');

    expect(
      view.container.querySelector(`#${CSS.escape(group.getAttribute('aria-labelledby'))}`)
        .textContent,
    ).toBe('Preço');
    expect(view.container.querySelector('[data-situacao]').textContent).toBe('em aberto');
    expect(variants().map((button) => button.textContent)).toEqual([
      'R$ 9,001 exemplar: c2',
      'R$ 10,002 exemplares: c1, c3',
    ]);
    expect(variants().every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(
      true,
    );
    expect(view.container.querySelector('[data-desfazer]')).toBeNull();
  });

  it('mostra o campo ausente por escrito', async () => {
    await renderField({
      conflict: {
        ...PRICE_CONFLICT,
        field: 'ean',
        variants: [
          { value: '20000042', copyCount: 1, texts: [TEXTS.cheap] },
          { value: null, copyCount: 1, texts: [TEXTS.dear] },
        ],
      },
    });

    expect(variants().map((button) => button.textContent)).toEqual([
      '200000421 exemplar: c2',
      'sem EAN1 exemplar: c1',
    ]);
  });

  it('entrega a variante tocada e diz se ela já é a escolhida', async () => {
    const onChoose = vi.fn();

    await renderField({
      onChoose,
      conflict: { ...PRICE_CONFLICT, status: 'resolved', chosenValue: 1000 },
    });
    await view.click(variants()[0]);
    await view.click(variants()[1]);

    expect(onChoose.mock.calls).toEqual([
      [900, 0, false],
      [1000, 1, true],
    ]);
  });

  it('marca a escolhida, mostra o desfazer e entrega a posição dela', async () => {
    const onUndo = vi.fn();

    await renderField({
      onUndo,
      conflict: { ...PRICE_CONFLICT, status: 'resolved', chosenValue: 1000 },
    });

    expect(variants().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
    ]);
    expect(variants()[1].className).toContain('bg-marca-vermelhoTenue');
    expect(view.container.querySelector('[data-situacao]').textContent).toBe('resolvido');

    const undo = view.container.querySelector('[data-desfazer]');

    expect(undo.textContent).toBe('Desfazer escolha');
    expect(undo.getAttribute('aria-label')).toBe('Desfazer escolha do preço');

    await view.click(undo);

    expect(onUndo).toHaveBeenCalledWith(1);
  });

  it('marca a variante sem o campo quando ela é a escolhida', async () => {
    await renderField({
      conflict: {
        ...PRICE_CONFLICT,
        field: 'ncm',
        status: 'resolved',
        chosenValue: null,
        variants: [
          { value: '09012100', copyCount: 1, texts: [TEXTS.cheap] },
          { value: null, copyCount: 1, texts: [TEXTS.dear] },
        ],
      },
    });

    expect(variants().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
    ]);
  });

  it('ocupa sem desligar durante a gravação e desliga com a sessão carregando', async () => {
    await renderField({ isBusy: true });

    expect(variants().every((button) => button.getAttribute('aria-disabled') === 'true')).toBe(
      true,
    );
    expect(variants().some((button) => button.disabled)).toBe(false);

    await renderField({ isDisabled: true });

    expect(variants().every((button) => button.disabled)).toBe(true);
    expect(variants().some((button) => button.hasAttribute('aria-disabled'))).toBe(false);
  });

  it('mostra a escolha ignorada e o aviso de falha junto do campo', async () => {
    await renderField({
      ignoredChoice: {
        systemCode: 'A-1',
        field: 'priceInCentavos',
        value: 1500,
        reason: 'not-a-variant',
        message: 'o valor escolhido não está mais entre as variantes',
      },
      error: 'Não foi possível gravar.',
    });

    expect(view.container.querySelector('[data-escolha-ignorada]').textContent).toBe(
      'A escolha gravada (R$ 15,00) foi ignorada: o valor escolhido não está mais entre as variantes.',
    );
    expect(view.container.querySelector('[data-descartar]')).toBeNull();
    expect(view.container.querySelector('[role="alert"]').textContent).toBe(
      'Não foi possível gravar.',
    );
  });

  it('mostra marcação no valor como texto, com foco visível nas variantes', async () => {
    await renderField({
      conflict: {
        ...PRICE_CONFLICT,
        field: 'displayName',
        variants: [
          { value: '<b>CAFÉ</b>', copyCount: 1, texts: [TEXTS.cheap] },
          { value: 'CAFE', copyCount: 1, texts: [TEXTS.dear] },
        ],
      },
    });

    expect(variants()[0].textContent).toBe('<b>CAFÉ</b>1 exemplar: c2');
    expect(view.container.querySelector('b')).toBeNull();
    expect(variants()[0].className).toContain('focus-visible:outline');
    expect(variants()[0].className).toContain('min-h-controle');
  });
});
