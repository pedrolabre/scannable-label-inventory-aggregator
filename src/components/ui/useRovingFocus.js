import { useCallback, useRef, useState } from 'react';

const ITEM_ATTRIBUTE = 'data-roving';

const MOVES = Object.freeze({
  ArrowDown: (index) => index + 1,
  ArrowUp: (index) => index - 1,
  Home: () => 0,
  End: (index, last) => last,
});

/**
 * Uma parada de `Tab` para uma lista de controles, com as setas andando entre
 * eles.
 *
 * So um item da lista fica na ordem de tabulacao: o ultimo que recebeu o foco,
 * enquanto a escolha do grupo nao muda; senao, o item ativo (o escolhido, o
 * selecionado); senao, o primeiro. Seta para baixo e seta para cima andam um
 * item, sem dar a volta nas pontas; `Home` e `End` vao ao primeiro e ao
 * ultimo. A tecla tratada tem a acao padrao cancelada, para que a regiao em
 * volta nao role junto.
 *
 * As setas so movem o foco. Escolher continua com o proprio controle: o
 * clique, o `Enter` ou o `Espaco` do botao. E isso que deixa andar por uma
 * lista de variantes sem gravar nada, e por uma lista de produtos sem trocar a
 * vista da tela estreita a cada tecla.
 *
 * Quem usa liga `containerRef` e `onKeyDown` no elemento que contem os itens, e
 * espalha `itemProps(index)` em cada item, na ordem da tela. Item desligado
 * nao recebe foco e e pulado pelas setas.
 */
export function useRovingFocus({ count, activeIndex = -1 }) {
  const containerRef = useRef(null);
  const [memory, setMemory] = useState(null);

  const hasActive = activeIndex >= 0 && activeIndex < count;
  const remembered =
    memory !== null && memory.activeIndex === activeIndex && memory.index < count
      ? memory.index
      : null;
  const tabbableIndex = remembered ?? (hasActive ? activeIndex : 0);

  const remember = useCallback(
    (index) => {
      setMemory((current) =>
        current?.index === index && current.activeIndex === activeIndex
          ? current
          : { index, activeIndex },
      );
    },
    [activeIndex],
  );

  const onKeyDown = useCallback((event) => {
    const move = MOVES[event.key];

    if (!move || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    const items = [...(containerRef.current?.querySelectorAll(`[${ITEM_ATTRIBUTE}]`) ?? [])];
    const enabled = items.filter((item) => !item.disabled);
    const current = enabled.indexOf(event.target.closest?.(`[${ITEM_ATTRIBUTE}]`));

    if (current === -1) {
      return;
    }

    event.preventDefault();

    const last = enabled.length - 1;
    const next = Math.min(Math.max(move(current, last), 0), last);

    if (next !== current) {
      enabled[next].focus();
    }
  }, []);

  const itemProps = (index) => ({
    [ITEM_ATTRIBUTE]: '',
    tabIndex: index === tabbableIndex ? 0 : -1,
    onFocus: () => remember(index),
  });

  return { containerRef, onKeyDown, itemProps };
}
