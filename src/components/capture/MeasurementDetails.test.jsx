// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { newCaptureItem } from '../../store/captureItem.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import MeasurementDetails from './MeasurementDetails.jsx';

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
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

describe('MeasurementDetails', () => {
  it('fica recolhida, com o resumo focável e o realce de foco', async () => {
    await view.render(<MeasurementDetails items={[item(1, { status: 'read' })]} />);

    const details = view.container.querySelector('details');
    const summary = details.querySelector('summary');

    expect(details.open).toBe(false);
    expect(summary.textContent).toBe('Medição');
    expect(summary.className).toContain('h-controle');
    expect(summary.className).toContain('focus-visible:outline-2');
    expect(summary.querySelector('svg').getAttribute('aria-hidden')).toBe('true');

    await view.focus(summary);

    expect(document.activeElement).toBe(summary);

    await view.click(summary);

    expect(details.open).toBe(true);
  });

  it('lista o tempo de cada foto medida, com o nome do arquivo', async () => {
    await view.render(
      <MeasurementDetails
        items={[
          item(1, {
            status: 'read',
            measurement: { durationMs: 1840, steps: { load: 310, decode: 1490 }, heapBytes: null },
          }),
          item(2, { status: 'pending' }),
        ]}
      />,
    );

    const lines = [...view.container.querySelectorAll('ul[aria-label="Tempo de cada foto"] li')];

    expect(lines.map((line) => line.textContent)).toEqual([
      'foto-1.jpg Tempo: 1.840 ms (abrir 310 ms, ler 1.490 ms)',
    ]);
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

    const items = [
      item(1, {
        status: 'read',
        sourceId: 'fonte-1',
        summary: { symbolCount: 1, validCount: 1, rejectedCount: 0 },
        measurement: { durationMs: 42, steps: { load: 10, decode: 25 }, heapBytes: null },
      }),
      item(2),
    ];

    await view.render(<MeasurementDetails items={items} copyText={copyText} />);
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
    await view.render(
      <MeasurementDetails
        items={[item(1, { status: 'duplicate', message: 'repetida' })]}
        copyText={vi.fn(async () => Promise.reject(new Error('x')))}
      />,
    );
    await view.click(buttonNamed('Copiar medição'));

    expect(view.container.querySelector('[role="alert"]').textContent).toContain(
      'Não foi possível copiar a medição.',
    );
  });
});
