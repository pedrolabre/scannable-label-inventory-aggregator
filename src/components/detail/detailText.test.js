// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  createStorageRuleError,
  describeStorageError,
  STORAGE_RULE_ERRORS,
} from '../../storage/storageError.js';
import { createResolutionError, RESOLUTION_ERRORS } from '../../store/resolutionChoices.js';

import {
  choiceErrorText,
  conflictReason,
  fieldTitle,
  fileNameText,
  ignoredChoiceText,
  issuesLabel,
  readingCountText,
  variantCopiesText,
  variantValueText,
} from './detailText.js';

describe('detailText', () => {
  it('nomeia o campo no começo da linha', () => {
    expect(['displayName', 'priceInCentavos', 'ean', 'ncm'].map(fieldTitle)).toEqual([
      'Nome',
      'Preço',
      'EAN',
      'NCM',
    ]);
  });

  it('mostra o valor da variante com o preço em reais e o campo ausente por escrito', () => {
    expect(variantValueText('priceInCentavos', 85990)).toBe('R$ 859,90');
    expect(variantValueText('displayName', '<b>CAFÉ</b>')).toBe('<b>CAFÉ</b>');
    expect(variantValueText('ean', '7899075420416')).toBe('7899075420416');
    expect(variantValueText('ean', null)).toBe('sem EAN');
    expect(variantValueText('ncm', null)).toBe('sem NCM');
  });

  it('conta exemplares e leituras e diz quais cN carregam a variante', () => {
    expect(variantCopiesText(1, ['c1'])).toBe('1 exemplar: c1');
    expect(variantCopiesText(2, ['c1', 'c3'])).toBe('2 exemplares: c1, c3');
    expect(variantCopiesText(2, [])).toBe('2 exemplares');
    expect(readingCountText(1)).toBe('1 leitura');
    expect(readingCountText(3)).toBe('3 leituras');
  });

  it('descreve o campo em conflito e a escolha ignorada com o valor e o motivo', () => {
    expect(conflictReason('ean')).toBe('EAN em conflito');
    expect(
      ignoredChoiceText({
        field: 'priceInCentavos',
        value: 999,
        message: 'o valor escolhido não está mais entre as variantes',
      }),
    ).toBe(
      'A escolha gravada (R$ 9,99) foi ignorada: o valor escolhido não está mais entre as variantes.',
    );
    expect(
      ignoredChoiceText({
        field: 'ncm',
        value: null,
        message: 'os exemplares não divergem mais neste campo',
      }),
    ).toBe(
      'A escolha gravada (sem NCM) foi ignorada: os exemplares não divergem mais neste campo.',
    );
  });

  it('usa a frase da recusa do store e a descrição da falha do banco', () => {
    expect(choiceErrorText(createResolutionError(RESOLUTION_ERRORS.STALE_CONFLICT))).toBe(
      'Esta escolha não corresponde mais às variantes do produto. Confira o conflito e escolha de novo.',
    );
    const missing = createStorageRuleError(STORAGE_RULE_ERRORS.MISSING_SESSION);
    const unknown = new Error('qualquer');

    expect(choiceErrorText(missing)).toBe(describeStorageError(missing));
    expect(choiceErrorText(unknown)).toBe(describeStorageError(unknown));
    expect(choiceErrorText(unknown)).not.toBe('qualquer');
  });

  it('monta o rótulo do gatilho com as contagens, ou nada sem o que mostrar', () => {
    expect(issuesLabel(2, 1)).toBe('Rejeitados (2) e falhas (1)');
    expect(issuesLabel(2, 0)).toBe('Rejeitados (2)');
    expect(issuesLabel(0, 1)).toBe('Fotos com falha (1)');
    expect(issuesLabel(0, 0)).toBeNull();
  });

  it('dá nome à foto sem nome', () => {
    expect(fileNameText('a.jpg')).toBe('a.jpg');
    expect(fileNameText('')).toBe('foto sem nome');
    expect(fileNameText(null)).toBe('foto sem nome');
  });
});
