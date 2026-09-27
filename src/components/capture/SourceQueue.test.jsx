// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { newCaptureItem } from '../../store/captureItem.js';
import { useCaptureStore } from '../../store/useCaptureStore.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SourceQueue from './SourceQueue.jsx';

const view = useReactRoot();
const initialCapture = useCaptureStore.getState();
const initialSession = useSessionStore.getState();

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

afterEach(() => {
  useCaptureStore.setState(initialCapture, true);
  useSessionStore.setState(initialSession, true);
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

  it('copia a medição do lote em colunas e confirma', async () => {
    const copyText = vi.fn(async () => {});

    useSessionStore.setState({
      sources: [{ id: 'fonte-1', sessionId: SESSION, width: 100, height: 50 }],
      readings: [
        {
          id: 'l1',
          sessionId: SESSION,
          sourceId: 'fonte-1',
          text: 'LF1|DEMO-005|MAÇÃ FUJI KG|1099|||c1',
          readAt: '2026-09-29T12:00:00.000Z',
        },
      ],
    });
    useCaptureStore.setState({
      items: [
        item(1, {
          status: 'read',
          sourceId: 'fonte-1',
          summary: { symbolCount: 1, validCount: 1, rejectedCount: 0 },
          measurement: { durationMs: 42, steps: { load: 10, decode: 25 }, heapBytes: null },
        }),
        item(2),
      ],
    });

    await view.render(<SourceQueue copyText={copyText} />);
    await view.click(buttonNamed('Copiar medição'));

    const [text] = copyText.mock.calls[0];
    const lines = text.split('\n');

    expect(lines[3].startsWith('Ordem\tArquivo\t')).toBe(true);
    expect(lines[4].split('\t')).toEqual([
      '1',
      'foto-1.jpg',
      'câmera',
      'lida',
      '100',
      '50',
      '0,0',
      '1',
      '1',
      '0',
      '0',
      '10',
      '25',
      '42',
      '',
      '',
    ]);
    expect(lines[5].split('\t').slice(0, 4)).toEqual(['2', 'foto-2.jpg', 'câmera', 'na fila']);
    expect(view.container.querySelector('[role="status"]').textContent).toBe(
      'Medição copiada. Cole na planilha.',
    );
  });

  it('avisa quando o navegador recusa a cópia', async () => {
    useCaptureStore.setState({ items: [item(1, { status: 'duplicate', message: 'repetida' })] });

    await view.render(<SourceQueue copyText={vi.fn(async () => Promise.reject(new Error('x')))} />);
    await view.click(buttonNamed('Copiar medição'));

    expect(view.container.querySelector('[role="alert"]').textContent).toContain(
      'Não foi possível copiar a medição.',
    );
  });
});
