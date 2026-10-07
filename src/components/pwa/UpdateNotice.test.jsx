// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { announceUpdate, getUpdateSnapshot, resetUpdateState } from '../../pwa/updateState.js';
import { CAPTURE_ITEM_STATUSES } from '../../store/captureItem.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import UpdateNotice, { queueStateOf, updateDetailOf } from './UpdateNotice.jsx';

const initialCapture = useCaptureStore.getState();
const view = useReactRoot({
  cleanup: () => {
    useCaptureStore.setState(initialCapture, true);
    resetUpdateState();
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

const { PENDING, PROCESSING, READ, FAILED, DUPLICATE, ERROR } = CAPTURE_ITEM_STATUSES;

function itemsWith(...statuses) {
  return statuses.map((status, index) => ({ id: index + 1, status }));
}

function band() {
  return view.container.querySelector('section[aria-label="Versão nova"]');
}

function updateButton() {
  return [...view.container.querySelectorAll('button')].find(
    (button) => button.textContent.trim() === 'Atualizar',
  );
}

async function announce(apply = vi.fn()) {
  await view.update(() => announceUpdate(apply));

  return apply;
}

describe('fila ainda não gravada', () => {
  it('conta à espera as fotos pendentes e em leitura, e à parte as com erro', () => {
    expect(
      queueStateOf(itemsWith(PENDING, PROCESSING, READ, FAILED, DUPLICATE, ERROR, ERROR)),
    ).toEqual({ waiting: 2, failed: 2 });
    expect(queueStateOf([])).toEqual({ waiting: 0, failed: 0 });
  });

  it('escreve a frase conforme a fila, no singular e no plural', () => {
    expect(updateDetailOf({ waiting: 0, failed: 0 })).toBe(
      'A sessão e as fotos gravadas continuam depois de atualizar.',
    );
    expect(updateDetailOf({ waiting: 1, failed: 0 })).toBe(
      'Atualize quando a fila terminar: 1 foto ainda não foi gravada.',
    );
    expect(updateDetailOf({ waiting: 3, failed: 2 })).toBe(
      'Atualize quando a fila terminar: 3 fotos ainda não foram gravadas.',
    );
    expect(updateDetailOf({ waiting: 0, failed: 1 })).toBe(
      'A foto com erro na fila sai da lista ao atualizar e precisa ser enviada de novo.',
    );
    expect(updateDetailOf({ waiting: 0, failed: 2 })).toBe(
      'As 2 fotos com erro na fila saem da lista ao atualizar e precisam ser enviadas de novo.',
    );
  });
});

describe('sem versão nova', () => {
  it('deixa só a região de estado, vazia e sem altura', async () => {
    await view.render(<UpdateNotice />);

    const region = view.container.querySelector('[data-aviso-versao]');

    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent).toBe('');
    expect(view.container.querySelector('button')).toBeNull();
  });
});

describe('com versão nova', () => {
  it('aparece dentro da região de estado, sem tomar o foco nem aplicar a troca', async () => {
    await view.render(<UpdateNotice />);
    const before = document.activeElement;
    const apply = await announce();

    expect(band().closest('[role="status"]')).toBeTruthy();
    expect(band().textContent).toContain('Versão nova do StockVision disponível.');
    expect(band().textContent).toContain(
      'A sessão e as fotos gravadas continuam depois de atualizar.',
    );
    expect(document.activeElement).toBe(before);
    expect(apply).not.toHaveBeenCalled();
  });

  it('fica no fluxo, sem sombra e sem posição fixa, com o ícone fora da leitura', async () => {
    await view.render(<UpdateNotice />);
    await announce();

    expect(band().className).toBe(
      'flex items-center gap-3 border-b border-neutro-borda bg-neutro-branco px-recuo py-2',
    );
    expect(band().querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('usa o botão padrão, com foco visível e a altura do controle', async () => {
    await view.render(<UpdateNotice />);
    await announce();

    const button = updateButton();

    expect(button.className).toContain('h-controle');
    expect(button.className).toContain('focus-visible:outline-2');
    expect(button.getAttribute('aria-describedby')).toBe('aviso-versao-detalhe');
  });

  it('aplica a troca no toque e some da tela', async () => {
    await view.render(<UpdateNotice />);
    const apply = await announce();

    await view.click(updateButton());

    expect(apply).toHaveBeenCalledTimes(1);
    expect(band()).toBeNull();
  });

  it('é alcançado pelo teclado: botão nativo, focável e sem tabIndex negativo', async () => {
    await view.render(<UpdateNotice />);
    await announce();

    const button = updateButton();

    await view.focus(button);

    expect(document.activeElement).toBe(button);
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.tabIndex).toBe(0);
  });
});

describe('com a fila em andamento', () => {
  it('espera a fila: o botão continua focável, com aria-disabled, e o toque não troca nada', async () => {
    await view.render(<UpdateNotice />);
    await view.update(() =>
      useCaptureStore.setState({ items: itemsWith(READ, PROCESSING, PENDING) }),
    );
    const apply = await announce();

    const button = updateButton();

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(band().textContent).toContain(
      'Atualize quando a fila terminar: 2 fotos ainda não foram gravadas.',
    );

    await view.click(button);

    expect(apply).not.toHaveBeenCalled();
    expect(getUpdateSnapshot()).toBe(true);
  });

  it('libera o botão quando a fila termina', async () => {
    await view.render(<UpdateNotice />);
    await view.update(() => useCaptureStore.setState({ items: itemsWith(PROCESSING) }));
    const apply = await announce();

    await view.update(() => useCaptureStore.setState({ items: itemsWith(READ) }));

    expect(updateButton().hasAttribute('aria-disabled')).toBe(false);

    await view.click(updateButton());

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('avisa que a foto com erro sai da lista, sem prender a troca', async () => {
    await view.render(<UpdateNotice />);
    await view.update(() => useCaptureStore.setState({ items: itemsWith(READ, ERROR) }));
    const apply = await announce();

    expect(band().textContent).toContain(
      'A foto com erro na fila sai da lista ao atualizar e precisa ser enviada de novo.',
    );

    await view.click(updateButton());

    expect(apply).toHaveBeenCalledTimes(1);
  });
});
