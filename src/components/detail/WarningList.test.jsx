// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import WarningList from './WarningList.jsx';

const view = useReactRoot();

const WARNING = {
  code: 'probable-reprint',
  sourceId: 'f1',
  fileName: 'gondola-1.jpg',
  positionCount: 2,
  message: 'mesmo texto em 2 posições da mesma foto: provável reimpressão',
};

describe('WarningList', () => {
  it('mostra a frase do aviso e a foto, em amarelo', async () => {
    await view.render(
      <WarningList warnings={[WARNING, { ...WARNING, sourceId: 'f2', fileName: null }]} />,
    );

    const items = [...view.container.querySelectorAll('li')];

    expect(items.map((item) => item.textContent)).toEqual([
      'mesmo texto em 2 posições da mesma foto: provável reimpressãoem gondola-1.jpg',
      'mesmo texto em 2 posições da mesma foto: provável reimpressãoem foto sem nome',
    ]);
    expect(items[0].dataset.aviso).toBe('probable-reprint');
    expect(items[0].querySelector('p').className).toContain('text-marca-amareloTexto');
  });

  it('não desenha nada sem aviso', async () => {
    await view.render(<WarningList warnings={[]} />);

    expect(view.container.innerHTML).toBe('');
  });
});
