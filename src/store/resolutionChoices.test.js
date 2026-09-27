// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { qrFixtureReadings } from '../test-fixtures/readingFixtures.js';

import {
  RESOLUTION_ERRORS,
  assertChoiceAvailable,
  assertOpenSession,
  choicesWith,
  choicesWithout,
  createResolutionError,
  removeResolution,
  upsertResolution,
} from './resolutionChoices.js';

const READINGS = [
  ...qrFixtureReadings('qr-4.png', 'foto-4'),
  ...qrFixtureReadings('qr-8.png', 'foto-8'),
];

const resolution = (systemCode, choices) => ({ sessionId: 's-1', systemCode, choices });

describe('createResolutionError', () => {
  it('dá o nome estável e a frase em português', () => {
    expect(createResolutionError(RESOLUTION_ERRORS.SESSION_NOT_OPEN)).toMatchObject({
      name: 'SessionNotOpenError',
      message: 'A sessão desta escolha não está aberta. Abra a sessão e tente de novo.',
    });
    expect(createResolutionError(RESOLUTION_ERRORS.STALE_CONFLICT)).toMatchObject({
      name: 'StaleConflictError',
      message:
        'Esta escolha não corresponde mais às variantes do produto. Confira o conflito e escolha de novo.',
    });
  });
});

describe('assertOpenSession', () => {
  it('aceita só a sessão aberta', () => {
    expect(() => assertOpenSession('s-1', 's-1')).not.toThrow();
    expect(() => assertOpenSession(null, 's-1')).toThrow(
      expect.objectContaining({ name: 'SessionNotOpenError' }),
    );
    expect(() => assertOpenSession('s-2', 's-1')).toThrow(
      expect.objectContaining({ name: 'SessionNotOpenError' }),
    );
  });
});

describe('assertChoiceAvailable', () => {
  it('aceita cada variante do conflito, inclusive a ausente', () => {
    for (const [field, value] of [
      ['ean', '7899075420416'],
      ['ean', null],
      ['ncm', '94035000'],
      ['ncm', null],
    ]) {
      expect(() => assertChoiceAvailable(READINGS, '118789', field, value)).not.toThrow();
    }
  });

  it('recusa campo sem conflito, produto ausente, valor fora das variantes e leitura vazia', () => {
    for (const [readings, systemCode, field, value] of [
      [READINGS, '118789', 'priceInCentavos', 85990],
      [READINGS, 'DEMO-001', 'ean', null],
      [READINGS, '118789', 'ean', ''],
      [READINGS, '118789', 'ncm', '94035001'],
      [[], '118789', 'ean', null],
    ]) {
      expect(() => assertChoiceAvailable(readings, systemCode, field, value)).toThrow(
        expect.objectContaining({ name: 'StaleConflictError' }),
      );
    }
  });
});

describe('choicesWith e choicesWithout', () => {
  const resolutions = [resolution('118789', { ean: null }), resolution('A', { ncm: null })];

  it('soma o campo às escolhas do produto, ou começa do zero', () => {
    expect(choicesWith(resolutions, '118789', 'ncm', '94035000')).toEqual({
      ean: null,
      ncm: '94035000',
    });
    expect(choicesWith(resolutions, '118789', 'ean', '7899075420416')).toEqual({
      ean: '7899075420416',
    });
    expect(choicesWith([], 'B', 'priceInCentavos', 100)).toEqual({ priceInCentavos: 100 });
    expect(resolutions[0].choices).toEqual({ ean: null });
  });

  it('retira o campo, e devolve undefined quando ele não tem escolha', () => {
    const both = [resolution('118789', { ean: null, ncm: null })];

    expect(choicesWithout(both, '118789', 'ean')).toEqual({ ncm: null });
    expect(choicesWithout(resolutions, '118789', 'ean')).toEqual({});
    expect(choicesWithout(resolutions, '118789', 'ncm')).toBeUndefined();
    expect(choicesWithout(resolutions, 'B', 'ean')).toBeUndefined();
    expect(both[0].choices).toEqual({ ean: null, ncm: null });
  });
});

describe('upsertResolution e removeResolution', () => {
  it('troca ou acrescenta na ordem dos códigos, e retira pelo código', () => {
    const a = resolution('A-1', { ean: null });
    const b = resolution('B-2', { ncm: null });
    const newB = resolution('B-2', { ean: null });
    const code10 = resolution('10', { displayName: 'X' });

    expect(upsertResolution([a, b], newB)).toEqual([a, newB]);
    expect(upsertResolution([b], a)).toEqual([a, b]);
    expect(upsertResolution([a], code10)).toEqual([code10, a]);
    expect(removeResolution([a, b], 'A-1')).toEqual([b]);
    expect(removeResolution([a], 'Z')).toEqual([a]);
  });
});
