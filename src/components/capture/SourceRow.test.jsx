// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { newCaptureItem } from '../../store/captureItem.js';
import { useSessionStore } from '../../store/useSessionStore.js';
import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SourceRow from './SourceRow.jsx';

const view = useReactRoot();
const initialSession = useSessionStore.getState();

const SESSION = 'sessao-1';
const CORNERS = {
  topLeft: { x: 1, y: 1 },
  topRight: { x: 9, y: 1 },
  bottomRight: { x: 9, y: 9 },
  bottomLeft: { x: 1, y: 9 },
};

function item(overrides) {
  return { ...newCaptureItem(1, null, 'camera', SESSION), fileName: 'foto.jpg', ...overrides };
}

function reading(id, text, sourceId = 'fonte-1') {
  return {
    id,
    sessionId: SESSION,
    sourceId,
    text,
    position: CORNERS,
    readAt: '2026-09-29T12:00:00.000Z',
  };
}

async function renderRow(entry) {
  await view.render(
    <ul>
      <SourceRow item={entry} />
    </ul>,
  );

  return view.container.querySelector('li');
}

beforeEach(() => {
  useSessionStore.setState({ currentSessionId: SESSION, sources: [], readings: [] });
});

afterEach(() => {
  useSessionStore.setState(initialSession, true);
});

describe('SourceRow', () => {
  it('mostra a situação da foto que espera e da que está sendo lida', async () => {
    expect((await renderRow(item({ status: 'pending' }))).textContent).toContain('na fila');
    expect((await renderRow(item({ status: 'processing' }))).textContent).toContain('processando');
  });

  it('lista os textos válidos e os rejeitados com o motivo, com tamanho, contagem e tempo', async () => {
    useSessionStore.setState({
      sources: [{ id: 'fonte-1', sessionId: SESSION, width: 4032, height: 3024 }],
      readings: [
        reading('l1', 'LF1|DEMO-005|MAÇÃ FUJI KG|1099|||c1'),
        reading('l2', 'LF2|DEMO-004|X|1|||c1'),
        reading('l3', 'LF1|DEMO-001||1899|||c1'),
        reading('l9', 'LF1|OUTRA|FOTO|1|||c1', 'fonte-2'),
      ],
    });

    const row = await renderRow(
      item({
        status: 'read',
        sourceId: 'fonte-1',
        summary: { symbolCount: 3, validCount: 1, rejectedCount: 2 },
        measurement: { durationMs: 1840, steps: { load: 310, decode: 1490 }, heapBytes: null },
      }),
    );
    const lists = [...row.querySelectorAll('ul')];

    expect(row.textContent).toContain('lida');
    expect(row.textContent).toContain('4032 × 3024 px (12,2 MP)');
    expect(row.textContent).toContain('3 símbolos: 1 válido, 2 rejeitados; 3 com posição');
    expect(row.textContent).toContain('Tempo: 1.840 ms (abrir 310 ms, ler 1.490 ms)');
    expect(lists).toHaveLength(2);
    expect([...lists[0].children].map((li) => li.textContent)).toEqual([
      'LF1|DEMO-005|MAÇÃ FUJI KG|1099|||c1',
    ]);
    expect([...lists[1].children].map((li) => li.textContent)).toEqual([
      'LF2|DEMO-004|X|1|||c1 — versão não suportada',
      'LF1|DEMO-001||1899|||c1 — campo inválido: nome',
    ]);
  });

  it('avisa a foto sem nenhum símbolo', async () => {
    const row = await renderRow(
      item({
        status: 'read',
        sourceId: 'fonte-1',
        summary: { symbolCount: 0, validCount: 0, rejectedCount: 0 },
        warnings: ['no-symbols'],
        message: 'nenhum símbolo encontrado',
      }),
    );

    expect(row.textContent).toContain('nenhum símbolo encontrado');
    expect(row.textContent).toContain('0 símbolos');
    expect(row.querySelectorAll('ul')).toHaveLength(0);
  });

  it('mostra o motivo da foto que o navegador não abriu', async () => {
    const row = await renderRow(
      item({
        status: 'failed',
        sourceId: 'fonte-1',
        failureReason: 'unsupported-format',
        message: 'formato de imagem não suportado',
      }),
    );

    expect(row.textContent).toContain('falhou');
    expect(row.textContent).toContain('formato de imagem não suportado');
  });

  it('mostra a foto repetida e a foto com erro, com as frases', async () => {
    const repeated = await renderRow(
      item({
        status: 'duplicate',
        message: 'Esta foto já foi lida nesta sessão. Escolha outra foto ou abra outra sessão.',
      }),
    );

    expect(repeated.textContent).toContain('recusada: foto repetida');
    expect(repeated.textContent).toContain('Esta foto já foi lida nesta sessão.');

    const failed = await renderRow(
      item({ status: 'error', message: 'A leitura desta foto falhou. Tente de novo.' }),
    );

    expect(failed.textContent).toContain('erro');
    expect(failed.textContent).toContain('A leitura desta foto falhou. Tente de novo.');
  });

  it('exibe texto com marcação como texto, sem criar elemento', async () => {
    const markup = '<img src=x onerror="alert(1)"><b>LF1</b>';

    useSessionStore.setState({ readings: [reading('l1', markup), reading('l2', '')] });

    const row = await renderRow(
      item({
        status: 'read',
        sourceId: 'fonte-1',
        summary: { symbolCount: 2, validCount: 0, rejectedCount: 2 },
      }),
    );

    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('b')).toBeNull();
    expect(row.textContent).toContain(`${markup} — não é LF1`);
    expect(row.textContent).toContain('(texto vazio) — não é LF1');
  });

  it('avisa quando a foto foi gravada em outra sessão', async () => {
    useSessionStore.setState({ currentSessionId: 'sessao-2' });

    const row = await renderRow(
      item({
        status: 'read',
        sourceId: 'fonte-1',
        summary: { symbolCount: 1, validCount: 1, rejectedCount: 0 },
      }),
    );

    expect(row.textContent).toContain('gravada em outra sessão');
    expect(row.textContent).toContain('1 símbolo: 1 válido, 0 rejeitados');
    expect(row.textContent).not.toContain('com posição');
  });
});
