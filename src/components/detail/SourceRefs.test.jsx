// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SourceRefs from './SourceRefs.jsx';

const view = useReactRoot();

describe('SourceRefs', () => {
  it('lista as fotos pelo nome, na ordem recebida, com a foto sem nome por escrito', async () => {
    await view.render(
      <SourceRefs
        sources={[
          { sourceId: 'f1', fileName: 'gondola-1.jpg' },
          { sourceId: 'f2', fileName: null },
        ]}
      />,
    );

    expect(view.container.textContent).toBe('Fotos: gondola-1.jpg, foto sem nome');
  });

  it('usa o singular com uma foto e mostra marcação no nome como texto', async () => {
    await view.render(<SourceRefs sources={[{ sourceId: 'f1', fileName: '<img src=x>.jpg' }]} />);

    expect(view.container.textContent).toBe('Foto: <img src=x>.jpg');
    expect(view.container.querySelector('img')).toBeNull();
  });

  it('não desenha nada sem foto', async () => {
    await view.render(<SourceRefs sources={[]} />);

    expect(view.container.innerHTML).toBe('');
  });
});
