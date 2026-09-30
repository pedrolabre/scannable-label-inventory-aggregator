// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { withoutSource } from './sourceRemoval.js';

const sources = [{ id: 'f1' }, { id: 'f2' }];
const readings = [
  { id: 'l1', sourceId: 'f1' },
  { id: 'l2', sourceId: 'f2' },
  { id: 'l3', sourceId: 'f1' },
];

describe('withoutSource', () => {
  it('tira a foto e as leituras dela, mantendo a ordem do resto', () => {
    expect(withoutSource({ sources, readings }, 'f1')).toEqual({
      sources: [{ id: 'f2' }],
      readings: [{ id: 'l2', sourceId: 'f2' }],
    });
  });

  it('devolve listas novas, sem mexer nas recebidas', () => {
    const result = withoutSource({ sources, readings }, 'f2');

    expect(result.sources).not.toBe(sources);
    expect(sources).toHaveLength(2);
    expect(readings).toHaveLength(3);
  });

  it('deixa tudo como está quando a foto não está na lista', () => {
    expect(withoutSource({ sources, readings }, 'f9')).toEqual({ sources, readings });
  });
});
