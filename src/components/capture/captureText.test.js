// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  MEASUREMENT_COLUMNS,
  countLabel,
  describeMeasurement,
  formatDuration,
  formatMeasurement,
  formatMegapixels,
} from './captureText.js';

function item(overrides) {
  return {
    id: 1,
    fileName: 'foto.jpg',
    origin: 'camera',
    sessionId: 'sessao-1',
    status: 'read',
    message: null,
    sourceId: null,
    summary: null,
    warnings: [],
    failureReason: null,
    measurement: null,
    ...overrides,
  };
}

describe('textos curtos', () => {
  it('escreve contagem, tempo e megapixels em português', () => {
    expect(countLabel(1, 'símbolo', 'símbolos')).toBe('1 símbolo');
    expect(countLabel(0, 'símbolo', 'símbolos')).toBe('0 símbolos');
    expect(formatDuration(1234.4)).toBe('1.234 ms');
    expect(formatMegapixels(4032, 3024)).toBe('12,2');
  });

  it('descreve a medição da foto, com o que o aparelho informou', () => {
    expect(describeMeasurement(null)).toBeNull();
    expect(
      describeMeasurement({
        durationMs: 1840.6,
        steps: { hash: 20, load: 310.2, decode: 1490 },
        heapBytes: 52_428_800,
      }),
    ).toBe('Tempo: 1.841 ms (abrir 310 ms, ler 1.490 ms, memória 50,0 MB)');
    expect(describeMeasurement({ durationMs: 12, steps: null, heapBytes: null })).toBe(
      'Tempo: 12 ms',
    );
  });
});

describe('formatMeasurement', () => {
  it('monta uma linha por foto, em colunas separadas por tabulação', () => {
    const items = [
      item({
        id: 1,
        fileName: 'folha\tinteira.jpg',
        sourceId: 'fonte-1',
        summary: { symbolCount: 12, validCount: 11, rejectedCount: 1 },
        measurement: {
          durationMs: 1840.6,
          steps: { load: 310.2, decode: 1490.1 },
          heapBytes: 52_428_800,
        },
      }),
      item({
        id: 2,
        fileName: 'repetida.jpg',
        origin: 'file',
        status: 'duplicate',
        message: 'Esta foto já foi lida nesta sessão.\nEscolha outra.',
        measurement: { durationMs: 20, steps: { hash: 18, lookup: 2 }, heapBytes: null },
      }),
      item({ id: 3, fileName: 'espera.jpg', status: 'pending' }),
    ];
    const text = formatMeasurement({
      items,
      sources: [{ id: 'fonte-1', width: 4032, height: 3024 }],
      positionCountOf: (entry) => (entry.sourceId === 'fonte-1' ? 12 : null),
      device: 'Mozilla/5.0 (Linux; Android 14)',
      copiedAt: new Date(2026, 8, 29, 14, 5),
    });

    const lines = text.split('\n');

    expect(lines[0]).toBe('Aparelho\tMozilla/5.0 (Linux; Android 14)');
    expect(lines[1]).toBe('Copiado em\t29/09/2026 14:05');
    expect(lines[2]).toBe('');
    expect(lines[3].split('\t')).toEqual([...MEASUREMENT_COLUMNS]);
    expect(lines[4].split('\t')).toEqual([
      '1',
      'folha inteira.jpg',
      'câmera',
      'lida',
      '4032',
      '3024',
      '12,2',
      '12',
      '11',
      '1',
      '12',
      '310',
      '1490',
      '1841',
      '50,0',
      '',
    ]);
    expect(lines[5].split('\t')).toEqual([
      '2',
      'repetida.jpg',
      'arquivo',
      'recusada: foto repetida',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '20',
      '',
      'Esta foto já foi lida nesta sessão. Escolha outra.',
    ]);
    expect(lines[6].split('\t').slice(0, 4)).toEqual(['3', 'espera.jpg', 'câmera', 'na fila']);
    expect(lines).toHaveLength(7);
    expect(lines.every((line) => line.split('\t').length <= MEASUREMENT_COLUMNS.length)).toBe(true);
  });
});
