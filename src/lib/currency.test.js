// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { formatCentavosAsBRL } from './currency.js';

const INTL_BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

describe('formatCentavosAsBRL', () => {
  it('escreve zero, centavos e milhares no formato brasileiro', () => {
    expect(formatCentavosAsBRL(0)).toBe('R$ 0,00');
    expect(formatCentavosAsBRL(5)).toBe('R$ 0,05');
    expect(formatCentavosAsBRL(99)).toBe('R$ 0,99');
    expect(formatCentavosAsBRL(100)).toBe('R$ 1,00');
    expect(formatCentavosAsBRL(85990)).toBe('R$ 859,90');
    expect(formatCentavosAsBRL(123456)).toBe('R$ 1.234,56');
    expect(formatCentavosAsBRL(123456789)).toBe('R$ 1.234.567,89');
  });

  it('usa o espaço comum depois de R$, nunca o não separável', () => {
    const text = formatCentavosAsBRL(123456);

    expect(text.charAt(2)).toBe(' ');
    expect(text).not.toMatch(/[  ]/);
  });

  it('põe o sinal antes de R$ no valor negativo e trata o zero negativo como zero', () => {
    expect(formatCentavosAsBRL(-100)).toBe('-R$ 1,00');
    expect(formatCentavosAsBRL(-123456)).toBe('-R$ 1.234,56');
    expect(formatCentavosAsBRL(-0)).toBe('R$ 0,00');
  });

  it('devolve null para o valor que não é inteiro', () => {
    for (const value of [
      1.5,
      0.1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '100',
      null,
      undefined,
      10n,
    ]) {
      expect(formatCentavosAsBRL(value)).toBeNull();
    }
  });

  it('escreve os valores grandes a partir dos dígitos do inteiro, sem perder centavo', () => {
    expect(formatCentavosAsBRL(Number.MAX_SAFE_INTEGER)).toBe('R$ 90.071.992.547.409,91');
    expect(formatCentavosAsBRL(9007199254740901)).toBe('R$ 90.071.992.547.409,01');
    expect(formatCentavosAsBRL(1e21)).toBe('R$ 10.000.000.000.000.000.000,00');
  });

  it('coincide com o Intl em pt-BR onde a divisão por cem é exata', () => {
    for (const centavos of [0, 1, 10, 999, 1000, 100000, 2490, 171980, 4583210, 987654321]) {
      const expected = INTL_BRL.format(centavos / 100).replace(/[  ]/g, ' ');

      expect(formatCentavosAsBRL(centavos)).toBe(expected);
    }
  });
});
