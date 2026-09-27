// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { classifySourceReadings } from './sourceReadings.js';

const CORNERS = {
  topLeft: { x: 1, y: 1 },
  topRight: { x: 9, y: 1 },
  bottomRight: { x: 9, y: 9 },
  bottomLeft: { x: 1, y: 9 },
};

function reading(id, sourceId, text, { withPosition = true } = {}) {
  const base = { id, sessionId: 'sessao-1', sourceId, text, readAt: '2026-09-29T12:00:00.000Z' };

  return withPosition ? { ...base, position: CORNERS } : base;
}

describe('classifySourceReadings', () => {
  it('separa os textos válidos dos rejeitados, só da foto pedida e na ordem da leitura', () => {
    const readings = [
      reading('l1', 'fonte-a', 'LF1|DEMO-001|CAFÉ TORRADO 500 G|1899|||c1'),
      reading('l2', 'fonte-b', 'LF1|DEMO-002|OUTRA FOTO|100|||c1'),
      reading('l3', 'fonte-a', 'https://exemplo.invalido'),
      reading('l4', 'fonte-a', 'LF1|DEMO-003|MAÇÃ FUJI KG|1099|||c2'),
      reading('l5', 'fonte-a', 'LF2|DEMO-004|X|1|||c1'),
    ];

    const result = classifySourceReadings(readings, 'fonte-a');

    expect(result.valid).toEqual([
      { id: 'l1', text: 'LF1|DEMO-001|CAFÉ TORRADO 500 G|1899|||c1', hasPosition: true },
      { id: 'l4', text: 'LF1|DEMO-003|MAÇÃ FUJI KG|1099|||c2', hasPosition: true },
    ]);
    expect(result.rejected).toEqual([
      {
        id: 'l3',
        text: 'https://exemplo.invalido',
        hasPosition: true,
        reason: 'not-lf1',
        message: 'não é LF1',
      },
      {
        id: 'l5',
        text: 'LF2|DEMO-004|X|1|||c1',
        hasPosition: true,
        reason: 'unsupported-version',
        message: 'versão não suportada',
      },
    ]);
    expect(result.positionCount).toBe(4);
  });

  it('dá a frase com o rótulo do campo recusado e conta as leituras sem posição', () => {
    const readings = [
      reading('l1', 'fonte-a', 'LF1|DEMO-001||1899|||c1', { withPosition: false }),
      reading('l2', 'fonte-a', 'LF1|DEMO-001', { withPosition: false }),
      reading('l3', 'fonte-a', ''),
    ];

    const result = classifySourceReadings(readings, 'fonte-a');

    expect(result.valid).toEqual([]);
    expect(result.rejected.map(({ message, hasPosition }) => [message, hasPosition])).toEqual([
      ['campo inválido: nome', false],
      ['posições inválidas', false],
      ['não é LF1', true],
    ]);
    expect(result.positionCount).toBe(1);
  });

  it('devolve listas vazias para a foto sem leitura', () => {
    expect(classifySourceReadings([], 'fonte-a')).toEqual({
      valid: [],
      rejected: [],
      positionCount: 0,
    });
  });
});
