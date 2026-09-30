// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { newCaptureItem } from '../../store/captureItem.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SourceQueue from './SourceQueue.jsx';

const initialCapture = useCaptureStore.getState();
const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => {
    useCaptureStore.setState(initialCapture, true);
    useSessionStore.setState(initialSession, true);
  },
});

const SESSION = 'sessao-1';

function item(id, overrides) {
  return {
    ...newCaptureItem(id, null, 'camera', SESSION),
    fileName: `foto-${id}.jpg`,
    ...overrides,
  };
}

function buttonNamed(name) {
  return [...view.container.querySelectorAll('button')].find(
    (button) => button.textContent === name,
  );
}

beforeEach(() => {
  useSessionStore.setState({ currentSessionId: SESSION, sources: [], readings: [] });
});

describe('SourceQueue', () => {
  it('diz que o lote está vazio, sem lista nem botões', async () => {
    await view.render(<SourceQueue />);

    expect(view.container.textContent).toContain('Nenhuma foto neste lote.');
    expect(view.container.querySelector('ul')).toBeNull();
    expect(view.container.querySelectorAll('button')).toHaveLength(0);
  });

  it('escreve o andamento e uma linha por foto, e acompanha a fila', async () => {
    useCaptureStore.setState({
      items: [item(1, { status: 'read' }), item(2, { status: 'processing' }), item(3)],
      isRunning: true,
    });

    await view.render(<SourceQueue />);

    const progress = view.container.querySelector('[aria-live="polite"]');

    expect(progress.textContent).toBe('Foto 2 de 3');
    expect(view.container.querySelectorAll('ul[aria-label="Fotos do lote"] > li')).toHaveLength(3);

    await view.update(() =>
      useCaptureStore.setState({
        items: [
          item(1, { status: 'read' }),
          item(2, { status: 'read' }),
          item(3, { status: 'processing' }),
        ],
      }),
    );

    expect(progress.textContent).toBe('Foto 3 de 3');
  });

  it('mostra o erro atual e tenta de novo só quando há foto com erro', async () => {
    const retry = vi.fn(async () => {});

    useCaptureStore.setState({
      items: [item(1, { status: 'read' }), item(2, { status: 'error', message: 'falhou' })],
      currentError: 'O leitor de QR Code não carregou. Recarregue a página e tente de novo.',
      retry,
    });

    await view.render(<SourceQueue />);

    expect(view.container.querySelector('[role="alert"]').textContent).toContain(
      'O leitor de QR Code não carregou.',
    );

    await view.click(buttonNamed('Tentar de novo'));

    expect(retry).toHaveBeenCalledTimes(1);

    await view.update(() =>
      useCaptureStore.setState({ items: [item(1, { status: 'read' })], currentError: null }),
    );

    expect(buttonNamed('Tentar de novo')).toBeUndefined();
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });

  it('guarda a medição recolhida no fim da fila depois da primeira foto terminada', async () => {
    const copyText = vi.fn(async () => {});

    useCaptureStore.setState({ items: [item(1, { status: 'processing' })] });

    await view.render(<SourceQueue copyText={copyText} />);

    expect(view.container.querySelector('details')).toBeNull();

    await view.update(() =>
      useCaptureStore.setState({
        items: [
          item(1, {
            status: 'read',
            measurement: { durationMs: 42, steps: { load: 10, decode: 25 }, heapBytes: null },
          }),
        ],
      }),
    );

    const details = view.container.querySelector('section > details');

    expect(details.open).toBe(false);
    expect(details.querySelector('summary').textContent).toBe('Medição');
    expect(details.previousElementSibling.getAttribute('aria-label')).toBe('Fotos do lote');
    expect(
      view.container.querySelector('ul[aria-label="Fotos do lote"]').textContent,
    ).not.toContain('Tempo:');

    await view.click(buttonNamed('Copiar medição'));

    expect(copyText).toHaveBeenCalledTimes(1);
  });

  it('deixa no lote só as fotos que não estão entre as fotos da sessão aberta', async () => {
    useCaptureStore.setState({
      items: [
        item(1, { status: 'read', sourceId: 'fonte-1' }),
        item(2, { status: 'failed', sourceId: 'fonte-2' }),
        item(3, { status: 'duplicate' }),
        item(4, { status: 'read', sourceId: 'fonte-4', sessionId: 'sessao-2' }),
        item(5),
      ],
    });

    await view.render(<SourceQueue />);

    const rows = [...view.container.querySelectorAll('ul[aria-label="Fotos do lote"] > li')];

    expect(view.container.querySelector('[aria-live="polite"]').textContent).toBe('Foto 5 de 5');
    expect(rows.map((row) => row.querySelector('p').textContent)).toEqual([
      'foto-3.jpg',
      'foto-4.jpg',
      'foto-5.jpg',
    ]);
    expect(view.container.textContent).toContain(
      'As fotos lidas e as que falharam passam para Fotos da sessão, abaixo.',
    );
  });
});
