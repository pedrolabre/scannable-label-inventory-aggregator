// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';

import { formatLocalTimestamp, localOffsetMinutes } from './exportTimestamp.js';

/** Cada teste fixa o proprio fuso; o da maquina volta depois. */
const previousTimeZone = process.env.TZ;

afterEach(() => {
  if (previousTimeZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = previousTimeZone;
  }
});

function inZone(timeZone, generatedAt) {
  process.env.TZ = timeZone;

  return formatLocalTimestamp(generatedAt, localOffsetMinutes(generatedAt));
}

describe('exportTimestamp', () => {
  it('escreve a hora local com o deslocamento, sem os milissegundos', () => {
    expect(formatLocalTimestamp('2026-10-06T20:03:48.765Z', -180)).toBe(
      '2026-10-06T17:03:48-03:00',
    );
    expect(formatLocalTimestamp('2026-10-06T20:03:59.999Z', -180)).toBe(
      '2026-10-06T17:03:59-03:00',
    );
  });

  it('escreve UTC como +00:00, e a virada do dia e do ano pelo deslocamento', () => {
    expect(formatLocalTimestamp('2026-10-06T20:03:48.000Z', 0)).toBe('2026-10-06T20:03:48+00:00');
    expect(formatLocalTimestamp('2027-01-01T01:30:00.000Z', -180)).toBe(
      '2026-12-31T22:30:00-03:00',
    );
    expect(formatLocalTimestamp('2026-12-31T20:00:00.000Z', 345)).toBe('2027-01-01T01:45:00+05:45');
  });

  it('lê o deslocamento do fuso do aparelho no instante', () => {
    expect(inZone('America/Sao_Paulo', '2026-10-06T20:03:48.000Z')).toBe(
      '2026-10-06T17:03:48-03:00',
    );
    expect(inZone('UTC', '2026-10-06T20:03:48.000Z')).toBe('2026-10-06T20:03:48+00:00');
    expect(Object.is(localOffsetMinutes('2026-10-06T20:03:48.000Z'), 0)).toBe(true);
  });

  it('acompanha o fuso de meia hora', () => {
    expect(inZone('Asia/Kolkata', '2026-10-06T20:03:48.000Z')).toBe('2026-10-07T01:33:48+05:30');
    expect(inZone('America/St_Johns', '2026-12-06T20:03:48.000Z')).toBe(
      '2026-12-06T16:33:48-03:30',
    );
  });

  it('acompanha o horário de verão pelo instante, e não pela data de hoje', () => {
    expect(inZone('America/New_York', '2026-10-06T20:03:48.000Z')).toBe(
      '2026-10-06T16:03:48-04:00',
    );
    expect(inZone('America/New_York', '2026-12-06T20:03:48.000Z')).toBe(
      '2026-12-06T15:03:48-05:00',
    );
  });

  it('recusa instante ou deslocamento inválido', () => {
    expect(() => formatLocalTimestamp('ontem', -180)).toThrow('Instante de geração inválido');
    expect(() => localOffsetMinutes('ontem')).toThrow(TypeError);
    expect(() => formatLocalTimestamp('2026-10-06T20:03:48.000Z', -180.5)).toThrow(
      'Deslocamento de fuso inválido',
    );
    expect(() => formatLocalTimestamp('2026-10-06T20:03:48.000Z', 19 * 60)).toThrow(TypeError);
    expect(() => formatLocalTimestamp('2026-10-06T20:03:48.000Z', undefined)).toThrow(TypeError);
  });
});
