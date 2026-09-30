import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach } from 'vitest';

/**
 * Raiz de React montada num `div` novo a cada teste e desmontada depois dele.
 * `render`, `click`, `focus` e `press` rodam dentro de `act`, com os efeitos ja
 * aplicados quando voltam.
 *
 * `cleanup` roda depois da desmontagem. E nele que o teste devolve os stores ao
 * estado inicial: o `afterEach` do proprio arquivo rodaria antes deste (os
 * ganchos de saida correm na ordem inversa do registro), com a tela ainda
 * montada, e a troca de estado chegaria a ela fora de `act`.
 */
export function useReactRoot({ cleanup } = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const handle = { container: null, root: null };

  beforeEach(() => {
    handle.container = document.createElement('div');
    document.body.appendChild(handle.container);
    handle.root = createRoot(handle.container);
  });

  afterEach(() => {
    act(() => {
      handle.root.unmount();
    });
    handle.container.remove();
    cleanup?.();
  });

  return {
    get container() {
      return handle.container;
    },
    render: async (element) => {
      await act(async () => {
        handle.root.render(element);
      });
    },
    /** Mudanca de estado fora do React, com a tela ja redesenhada na volta. */
    update: async (change) => {
      await act(async () => {
        change();
      });
    },
    click: async (element) => {
      await act(async () => {
        element.click();
      });
    },
    focus: async (element) => {
      await act(async () => {
        element.focus();
      });
    },
    /**
     * Tecla pressionada no elemento com o foco, como o navegador entrega.
     * Devolve o evento, para o teste conferir se a acao padrao foi cancelada.
     */
    press: async (key, { shiftKey = false } = {}) => {
      const event = new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true,
      });

      await act(async () => {
        (document.activeElement ?? document.body).dispatchEvent(event);
      });

      return event;
    },
    /** Escolha de arquivos num seletor, como o navegador entrega. */
    choose: async (input, files) => {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      await act(async () => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    },
  };
}
