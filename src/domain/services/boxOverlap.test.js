// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { boxAt } from '../../test-fixtures/readingFixtures.js';
import { intersectionOverUnion, positionArea, positionPolygon } from './boxOverlap.js';

/** Losango: o quadrado de lado `side` girado 45 graus, com centro em `cx`, `cy`. */
function diamond(cx, cy, side) {
  const half = side / Math.SQRT2;

  return {
    topLeft: { x: cx, y: cy - half },
    topRight: { x: cx + half, y: cy },
    bottomRight: { x: cx, y: cy + half },
    bottomLeft: { x: cx - half, y: cy },
  };
}

function point(x, y) {
  return { x, y };
}

describe('positionArea', () => {
  it('mede a caixa alinhada e a inclinada pelo próprio quadrilátero', () => {
    expect(positionArea(boxAt(10, 20, 30, 40))).toBe(1200);
    expect(positionArea(diamond(50, 50, 10))).toBeCloseTo(100, 9);
  });

  it('dá zero para cantos repetidos ou alinhados', () => {
    const collapsed = {
      topLeft: point(5, 5),
      topRight: point(5, 5),
      bottomRight: point(5, 5),
      bottomLeft: point(5, 5),
    };
    const line = {
      topLeft: point(0, 0),
      topRight: point(10, 0),
      bottomRight: point(20, 0),
      bottomLeft: point(5, 0),
    };

    expect(positionArea(collapsed)).toBe(0);
    expect(positionArea(line)).toBe(0);
  });

  it('desfaz a ordem trocada dos cantos', () => {
    const crossed = {
      topLeft: point(0, 0),
      topRight: point(10, 10),
      bottomRight: point(10, 0),
      bottomLeft: point(0, 10),
    };

    expect(positionArea(crossed)).toBe(100);
    expect(positionPolygon(crossed)).toHaveLength(4);
  });
});

describe('intersectionOverUnion', () => {
  it('dá 1 para caixas iguais', () => {
    expect(intersectionOverUnion(boxAt(0, 0, 100), boxAt(0, 0, 100))).toBe(1);
  });

  it('dá 0 para caixas disjuntas e para caixas que só se tocam', () => {
    expect(intersectionOverUnion(boxAt(0, 0, 100), boxAt(300, 300, 100))).toBe(0);
    expect(intersectionOverUnion(boxAt(0, 0, 100), boxAt(100, 0, 100))).toBe(0);
  });

  it('dá 0,5 para a caixa que cobre metade da outra, e o mesmo nos dois sentidos', () => {
    const whole = boxAt(0, 0, 100, 100);
    const half = boxAt(0, 0, 100, 50);

    expect(intersectionOverUnion(whole, half)).toBe(0.5);
    expect(intersectionOverUnion(half, whole)).toBe(0.5);
  });

  it('dá um terço para duas caixas iguais deslocadas pela metade do lado', () => {
    expect(intersectionOverUnion(boxAt(0, 0, 100), boxAt(50, 0, 100))).toBeCloseTo(1 / 3, 12);
  });

  it('usa o quadrilátero inclinado, e não o retângulo que o envolve', () => {
    const tilted = diamond(50, 50, 100 / Math.SQRT2);
    const envelope = boxAt(0, 0, 100);

    expect(positionArea(tilted)).toBeCloseTo(5000, 9);
    expect(intersectionOverUnion(tilted, envelope)).toBeCloseTo(0.5, 12);
    expect(intersectionOverUnion(tilted, diamond(50, 50, 100 / Math.SQRT2))).toBeCloseTo(1, 12);
  });

  it('separa duas etiquetas inclinadas lado a lado cujos retângulos envolventes se cruzam', () => {
    const first = diamond(50, 50, 60);
    const second = diamond(75, 50, 60);
    const half = 30 * Math.SQRT2;
    const firstEnvelope = boxAt(50 - half, 50 - half, 2 * half);
    const secondEnvelope = boxAt(75 - half, 50 - half, 2 * half);

    expect(intersectionOverUnion(firstEnvelope, secondEnvelope)).toBeGreaterThan(0.5);
    expect(intersectionOverUnion(first, second)).toBeLessThan(0.5);
  });

  it('dá o mesmo valor com os cantos em sentido horário ou anti-horário', () => {
    const clockwise = boxAt(0, 0, 100);
    const counter = {
      topLeft: clockwise.topLeft,
      topRight: clockwise.bottomLeft,
      bottomRight: clockwise.bottomRight,
      bottomLeft: clockwise.topRight,
    };

    expect(intersectionOverUnion(counter, boxAt(50, 0, 100))).toBeCloseTo(1 / 3, 12);
  });

  it('dá 0 para caixa degenerada, sem divisão por zero', () => {
    const collapsed = {
      topLeft: point(5, 5),
      topRight: point(5, 5),
      bottomRight: point(5, 5),
      bottomLeft: point(5, 5),
    };
    const line = {
      topLeft: point(0, 50),
      topRight: point(100, 50),
      bottomRight: point(100, 50),
      bottomLeft: point(0, 50),
    };

    expect(intersectionOverUnion(collapsed, boxAt(0, 0, 100))).toBe(0);
    expect(intersectionOverUnion(boxAt(0, 0, 100), line)).toBe(0);
    expect(intersectionOverUnion(collapsed, collapsed)).toBe(0);
  });
});
