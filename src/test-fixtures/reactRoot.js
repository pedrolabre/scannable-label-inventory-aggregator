import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach } from 'vitest';

/**
 * Raiz de React montada num `div` novo a cada teste e desmontada depois dele.
 * `render` e `click` rodam dentro de `act`, com os efeitos ja aplicados quando
 * voltam.
 */
export function useReactRoot() {
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
    /** Escolha de arquivos num seletor, como o navegador entrega. */
    choose: async (input, files) => {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      await act(async () => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    },
  };
}
