// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import CopyList from './CopyList.jsx';

const view = useReactRoot();

const COPIES = [
  {
    systemCode: '118789',
    copy: 'c1',
    text: 'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1',
    readingCount: 1,
    sources: [{ sourceId: 'f1', fileName: 'qr-4.png' }],
    warnings: [],
  },
  {
    systemCode: '118789',
    copy: 'c1',
    text: 'LF1|118789|CANTINHO CAFE RUBI|85990|||c1',
    readingCount: 3,
    sources: [
      { sourceId: 'f1', fileName: 'qr-4.png' },
      { sourceId: 'f2', fileName: 'qr-8.png' },
    ],
    warnings: [
      {
        code: 'probable-reprint',
        sourceId: 'f2',
        fileName: 'qr-8.png',
        positionCount: 2,
        message: 'mesmo texto em 2 posições da mesma foto: provável reimpressão',
      },
    ],
  },
];

function items() {
  return [...view.container.querySelectorAll('li[data-exemplar]')];
}

describe('CopyList', () => {
  it('mostra cN, leituras, fotos, aviso e o texto inteiro de cada exemplar, na ordem recebida', async () => {
    await view.render(<CopyList copies={COPIES} />);

    const [first, second] = items();

    expect(items()).toHaveLength(2);
    expect(first.textContent).toContain('c11 leitura');
    expect(first.textContent).toContain('Foto: qr-4.png');
    expect(first.querySelector('[data-aviso]')).toBeNull();
    expect(first.querySelector('[data-texto-exemplar]').textContent).toBe(COPIES[0].text);
    expect(second.textContent).toContain('c13 leituras');
    expect(second.textContent).toContain('Fotos: qr-4.png, qr-8.png');
    expect(second.querySelector('[data-aviso]').textContent).toBe(
      'mesmo texto em 2 posições da mesma foto: provável reimpressãoem qr-8.png',
    );
    expect(second.querySelector('[data-texto-exemplar]').textContent).toBe(COPIES[1].text);
  });

  it('mostra marcação no texto como texto', async () => {
    const text = 'LF1|A-1|<script>x</script>|100|||c1';

    await view.render(<CopyList copies={[{ ...COPIES[0], text }]} />);

    expect(view.container.querySelector('[data-texto-exemplar]').textContent).toBe(text);
    expect(view.container.querySelector('script')).toBeNull();
  });
});
