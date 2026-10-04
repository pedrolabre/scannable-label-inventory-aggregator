// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildExportFileName } from './exportFileName.js';

/** Fuso fixo, para a hora local do nome nao depender da maquina que roda a suite. */
const previousTimeZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/Sao_Paulo';
});

afterAll(() => {
  if (previousTimeZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = previousTimeZone;
  }
});

describe('nome do arquivo exportado', () => {
  it('usa a data e a hora locais do instante da geração', () => {
    expect(buildExportFileName('2026-10-06T19:03:48.512Z', 'csv')).toBe(
      'inventario-2026-10-06-1603.csv',
    );
  });

  it('fica no dia local quando o instante já virou o dia em UTC', () => {
    expect(buildExportFileName('2026-10-07T02:30:00.000Z', 'csv')).toBe(
      'inventario-2026-10-06-2330.csv',
    );
    expect(buildExportFileName('2026-01-01T03:05:00.000Z', 'xml')).toBe(
      'inventario-2026-01-01-0005.xml',
    );
  });

  it('acrescenta o sufixo do segundo arquivo', () => {
    expect(buildExportFileName('2026-10-06T19:03:00.000Z', 'csv', 'exemplares')).toBe(
      'inventario-2026-10-06-1603-exemplares.csv',
    );
  });

  it('recusa instante inválido', () => {
    expect(() => buildExportFileName('ontem', 'csv')).toThrow(TypeError);
  });
});
