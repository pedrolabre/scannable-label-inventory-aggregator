// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import { useRovingFocus } from './useRovingFocus.js';

const view = useReactRoot();

const LABELS = ['Primeiro', 'Segundo', 'Terceiro', 'Quarto'];

function List({ labels = LABELS, activeIndex = -1, disabled = [], onChoose = () => {} }) {
  const { containerRef, onKeyDown, itemProps } = useRovingFocus({
    count: labels.length,
    activeIndex,
  });

  return (
    <>
      <button type="button">Antes</button>
      <div ref={containerRef} onKeyDown={onKeyDown}>
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            disabled={disabled.includes(index)}
            onClick={() => onChoose(index)}
            {...itemProps(index)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

function items() {
  return [...view.container.querySelectorAll('[data-roving]')];
}

function tabStops() {
  return items()
    .filter((item) => item.tabIndex === 0)
    .map((item) => item.textContent);
}

describe('useRovingFocus', () => {
  it('deixa só o primeiro item na ordem do Tab quando nenhum está ativo', async () => {
    await view.render(<List />);

    expect(tabStops()).toEqual(['Primeiro']);
    expect(items().map((item) => item.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('deixa o item ativo na ordem do Tab', async () => {
    await view.render(<List activeIndex={2} />);

    expect(tabStops()).toEqual(['Terceiro']);
  });

  it('anda com as setas sem dar a volta e vai às pontas com Home e End', async () => {
    await view.render(<List />);
    await view.focus(items()[0]);

    const down = await view.press('ArrowDown');
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement.textContent).toBe('Segundo');

    await view.press('End');
    expect(document.activeElement.textContent).toBe('Quarto');

    await view.press('ArrowDown');
    expect(document.activeElement.textContent).toBe('Quarto');

    await view.press('Home');
    expect(document.activeElement.textContent).toBe('Primeiro');

    await view.press('ArrowUp');
    expect(document.activeElement.textContent).toBe('Primeiro');
  });

  it('leva a parada do Tab ao último item focado, até a escolha mudar', async () => {
    const { rerender } = await renderWithProps({ activeIndex: 0 });
    await view.focus(items()[0]);
    await view.press('ArrowDown');
    await view.press('ArrowDown');

    expect(tabStops()).toEqual(['Terceiro']);

    await rerender({ activeIndex: 1 });

    expect(tabStops()).toEqual(['Segundo']);
  });

  it('só move o foco: escolher continua com o clique do próprio item', async () => {
    const onChoose = vi.fn();
    await view.render(<List onChoose={onChoose} />);
    await view.focus(items()[0]);
    await view.press('ArrowDown');
    await view.press('End');

    expect(onChoose).not.toHaveBeenCalled();

    await view.click(document.activeElement);

    expect(onChoose).toHaveBeenCalledWith(3);
  });

  it('pula o item desligado', async () => {
    await view.render(<List disabled={[1]} />);
    await view.focus(items()[0]);
    await view.press('ArrowDown');

    expect(document.activeElement.textContent).toBe('Terceiro');
  });

  it('deixa passar a tecla com modificador e a tecla que não anda', async () => {
    await view.render(<List />);
    await view.focus(items()[0]);

    const shifted = await view.press('ArrowDown', { shiftKey: true });
    const tab = await view.press('Tab');

    expect(shifted.defaultPrevented).toBe(false);
    expect(tab.defaultPrevented).toBe(false);
    expect(document.activeElement.textContent).toBe('Primeiro');
  });

  it('volta ao primeiro quando o item lembrado sai da lista', async () => {
    const { rerender } = await renderWithProps({});
    await view.focus(items()[3]);

    expect(tabStops()).toEqual(['Quarto']);

    await rerender({ labels: LABELS.slice(0, 2) });

    expect(tabStops()).toEqual(['Primeiro']);
  });
});

async function renderWithProps(initial) {
  let props = initial;
  await view.render(<List {...props} />);

  return {
    rerender: async (next) => {
      props = { ...props, ...next };
      await view.render(<List {...props} />);
    },
  };
}
