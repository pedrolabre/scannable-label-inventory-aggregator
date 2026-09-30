// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SegmentedControl from './SegmentedControl.jsx';

const view = useReactRoot();

const OPTIONS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'produtos', label: 'Produtos' },
  { value: 'detalhe', label: 'Detalhe' },
];

function Controlled({ initial = 'entrada', onChange = () => {}, ...props }) {
  const [value, setValue] = useState(initial);

  return (
    <SegmentedControl
      legend="Vista"
      name="vista"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      {...props}
    />
  );
}

function radios() {
  return [...view.container.querySelectorAll('input[type="radio"]')];
}

function checkedValues() {
  return radios()
    .filter((radio) => radio.checked)
    .map((radio) => radio.value);
}

describe('SegmentedControl', () => {
  it('é um grupo de radios com nome, legenda e uma opção marcada', async () => {
    await view.render(<Controlled />);

    const fieldset = view.container.querySelector('fieldset');
    const labels = [...view.container.querySelectorAll('label')].map((label) => label.textContent);

    expect(fieldset.querySelector('legend').textContent).toBe('Vista');
    expect(labels).toEqual(['Entrada', 'Produtos', 'Detalhe']);
    expect(radios().every((radio) => radio.name === 'vista')).toBe(true);
    expect(radios().every((radio) => radio.tabIndex === 0)).toBe(true);
    expect(checkedValues()).toEqual(['entrada']);
  });

  it('acende o realce de foco na opção desenhada ao lado do radio', async () => {
    await view.render(<Controlled />);

    const [selected, idle] = radios().map((radio) => radio.nextElementSibling);

    expect(radios()[0].className).toContain('peer');
    expect(radios()[0].className).toContain('sr-only');
    expect(selected.className).toContain('peer-focus-visible:outline-2');
    expect(selected.className).toContain('peer-focus-visible:outline-marca-vermelho');
    expect(idle.className).toContain('peer-focus-visible:outline-neutro-tintaFraca');
    expect(selected.className).toContain('h-controle');
  });

  it('troca a opção pelo clique', async () => {
    const onChange = vi.fn();

    await view.render(<Controlled onChange={onChange} />);
    await view.click(radios()[1]);

    expect(onChange).toHaveBeenCalledWith('produtos');
    expect(checkedValues()).toEqual(['produtos']);
  });

  it('anda com as setas, dá a volta e leva o foco junto', async () => {
    const onChange = vi.fn();

    await view.render(<Controlled onChange={onChange} />);
    await view.focus(radios()[0]);

    const right = await view.press('ArrowRight');

    expect(right.defaultPrevented).toBe(true);
    expect(checkedValues()).toEqual(['produtos']);
    expect(document.activeElement).toBe(radios()[1]);

    await view.press('ArrowDown');
    await view.press('ArrowRight');

    expect(checkedValues()).toEqual(['entrada']);
    expect(document.activeElement).toBe(radios()[0]);

    await view.press('ArrowLeft');

    expect(checkedValues()).toEqual(['detalhe']);

    await view.press('ArrowUp');

    expect(checkedValues()).toEqual(['produtos']);
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      'produtos',
      'detalhe',
      'entrada',
      'detalhe',
      'produtos',
    ]);
  });

  it('vai às pontas com Home e End', async () => {
    await view.render(<Controlled initial="produtos" />);
    await view.focus(radios()[1]);

    await view.press('End');

    expect(checkedValues()).toEqual(['detalhe']);
    expect(document.activeElement).toBe(radios()[2]);

    await view.press('Home');

    expect(checkedValues()).toEqual(['entrada']);
    expect(document.activeElement).toBe(radios()[0]);
  });

  it('deixa as outras teclas com o navegador', async () => {
    const onChange = vi.fn();

    await view.render(<Controlled onChange={onChange} />);
    await view.focus(radios()[0]);

    const tab = await view.press('Tab');
    const letter = await view.press('a');

    expect(tab.defaultPrevented).toBe(false);
    expect(letter.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('divide a largura com stretch e guarda a legenda para leitor de tela', async () => {
    await view.render(<Controlled stretch hideLegend />);

    const group = view.container.querySelector('fieldset > div');

    expect(group.className).toContain('grid-flow-col');
    expect(group.className).toContain('auto-cols-fr');
    expect(view.container.querySelector('legend').className).toBe('sr-only');
  });
});
