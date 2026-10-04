// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  ELLIPSIS,
  FONT_CHARACTERS,
  MM_PER_POINT,
  REPLACEMENT_MARK,
  fitText,
  fittingFontSize,
  glyphWidth,
  textWidthMm,
  toFontText,
  wrapText,
} from './reportText.js';

/** Largura em milimetros de uma soma de unidades da fonte, no corpo em ponto. */
function mm(units, fontSizePt) {
  return (units / 1000) * fontSizePt * MM_PER_POINT;
}

describe('FONT_CHARACTERS e glyphWidth', () => {
  it('cobre o ASCII visível, o Latin-1 visível e os 27 sinais do WinAnsi', () => {
    expect(FONT_CHARACTERS).toHaveLength(95 + 96 + 27);

    for (const character of 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç€…—–·×“”‘’™') {
      expect(FONT_CHARACTERS).toContain(character);
    }

    for (const character of ['\u0007', '\u0085', '\uFFFD', '漢', '😀']) {
      expect(FONT_CHARACTERS).not.toContain(character);
    }
  });

  it('traz as larguras publicadas da helvetica e da helvetica negrito', () => {
    expect(glyphWidth(' ')).toBe(278);
    expect(glyphWidth('A')).toBe(667);
    expect(glyphWidth('A', true)).toBe(722);
    expect(glyphWidth('0')).toBe(556);
    expect(glyphWidth('@')).toBe(1015);
    expect(glyphWidth('@', true)).toBe(975);
    expect(glyphWidth('ç')).toBe(500);
    expect(glyphWidth('ç', true)).toBe(556);
    expect(glyphWidth(ELLIPSIS)).toBe(1000);
    expect(glyphWidth('—')).toBe(1000);
    expect(glyphWidth('€')).toBe(556);
  });
});

describe('toFontText', () => {
  it('mantém o texto que a fonte escreve, com os acentos do português', () => {
    expect(toFontText('AÇÚCAR CRISTAL 1KG – R$ 5,49 …')).toEqual({
      text: 'AÇÚCAR CRISTAL 1KG – R$ 5,49 …',
      replaced: 0,
    });
  });

  it('junta letra e acento combinado na letra acentuada antes de conferir', () => {
    expect(toFontText('cafe\u0301 a\u0303o')).toEqual({ text: 'café ão', replaced: 0 });
  });

  it('troca por ? cada caractere percebido que a fonte não escreve, e conta', () => {
    expect(toFontText('a😀b')).toEqual({ text: 'a?b', replaced: 1 });
    expect(toFontText('漢字')).toEqual({ text: '??', replaced: 2 });
    expect(toFontText('x\uFFFDy\u0007z')).toEqual({ text: 'x?y?z', replaced: 2 });
    expect(toFontText('linha\nlinha')).toEqual({ text: 'linha?linha', replaced: 1 });
    expect(toFontText('\u{1F468}\u200D\u{1F469}\u200D\u{1F467} fim')).toEqual({
      text: '? fim',
      replaced: 1,
    });
  });

  it('guarda a parte que a fonte escreve no caractere com acento sem forma composta', () => {
    expect(toFontText('q\u0301')).toEqual({ text: `q${REPLACEMENT_MARK}`, replaced: 1 });
  });

  it('trata ausente como texto vazio e número como texto', () => {
    expect(toFontText(null)).toEqual({ text: '', replaced: 0 });
    expect(toFontText(42)).toEqual({ text: '42', replaced: 0 });
  });
});

describe('textWidthMm', () => {
  it('soma as larguras dos caracteres no corpo pedido, sem ajuste entre pares', () => {
    // R 722, $ 556, espaco 278, 1 556, ponto 278, 2 556, 3 556, 4 556, virgula 278, 5 556, 6 556.
    expect(textWidthMm('R$ 1.234,56', 8)).toBeCloseTo(mm(5448, 8), 10);
    expect(textWidthMm('AV', 10)).toBeCloseTo(mm(667 + 667, 10), 10);
    expect(textWidthMm('Total', 8, true)).toBeCloseTo(mm(611 + 611 + 333 + 556 + 278, 8), 10);
    expect(textWidthMm('', 8)).toBe(0);
  });
});

describe('fitText', () => {
  it('devolve o texto inteiro quando ele cabe', () => {
    expect(fitText('CAFÉ', 20, 8)).toBe('CAFÉ');
  });

  it('corta com reticências no maior começo que cabe, sem espaço antes delas', () => {
    const text = 'MACARRÃO ESPAGUETE 500G';
    const fitted = fitText(text, 20, 8);

    expect(fitted.endsWith(ELLIPSIS)).toBe(true);
    expect(textWidthMm(fitted, 8)).toBeLessThanOrEqual(20);
    expect(text.startsWith(fitted.slice(0, -1))).toBe(true);
    expect(fitted.slice(0, -1).endsWith(' ')).toBe(false);
    expect(
      textWidthMm(`${text.slice(0, fitted.length + 1).trimEnd()}${ELLIPSIS}`, 8),
    ).toBeGreaterThan(20);
  });

  it('mede o negrito com as larguras do negrito', () => {
    const text = 'Rejeitados na foto';
    const width = textWidthMm(text, 8);

    expect(fitText(text, width, 8)).toBe(text);
    expect(fitText(text, width, 8, true)).not.toBe(text);
  });

  it('devolve vazio quando nem as reticências cabem', () => {
    expect(fitText('ABC', 1, 8)).toBe('');
  });
});

describe('fittingFontSize', () => {
  it('mantém o corpo quando o valor cabe e reduz em décimos quando não cabe', () => {
    expect(fittingFontSize('R$ 5,49', 20, 8)).toBe(8);

    const value = 'R$ 90.071.992.547.409,91';
    const size = fittingFontSize(value, 21, 8);

    expect(size).toBeLessThan(8);
    expect(Math.round(size * 10)).toBe(size * 10);
    expect(textWidthMm(value, size)).toBeLessThanOrEqual(21);
    expect(textWidthMm(value, size + 0.1)).toBeGreaterThan(21);
  });
});

describe('wrapText', () => {
  it('quebra no último espaço que cabe, com cada linha na largura', () => {
    const text = 'campo inválido: nome com mais palavras do que cabem numa linha só';
    const lines = wrapText(text, 40, 8);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(text);
    lines.forEach((line) => expect(textWidthMm(line, 8)).toBeLessThanOrEqual(40));
  });

  it('parte a palavra maior que a largura entre caracteres', () => {
    const text = `https://exemplo.invalido/${'x'.repeat(80)}`;
    const lines = wrapText(text, 30, 8);

    expect(lines.join('')).toBe(text);
    lines.forEach((line) => expect(textWidthMm(line, 8)).toBeLessThanOrEqual(30));
  });

  it('corta a última linha com reticências quando passa do limite de linhas', () => {
    const text = 'um dois três quatro cinco seis sete oito nove dez onze doze treze catorze';
    const lines = wrapText(text, 25, 8, false, 2);

    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith(ELLIPSIS)).toBe(true);
    expect(textWidthMm(lines[1], 8)).toBeLessThanOrEqual(25);
    expect(text.startsWith(`${lines[0]} ${lines[1].slice(0, -1)}`)).toBe(true);
  });

  it('dá uma linha para o texto que cabe e uma linha vazia para o texto vazio', () => {
    expect(wrapText('curto', 40, 8, false, 2)).toEqual(['curto']);
    expect(wrapText('', 40, 8)).toEqual(['']);
  });
});
