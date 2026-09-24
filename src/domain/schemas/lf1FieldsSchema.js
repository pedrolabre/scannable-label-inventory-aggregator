import { z } from 'zod';

import {
  boundedTextField,
  nonNegativeSafeIntegerField,
  optionalPatternField,
  patternField,
} from './commonFields.js';

export const LF1_DISPLAY_NAME_MAX_LENGTH = 60;

/** Barra vertical e qualquer caractere de controle, inclusive quebra de linha. */
export const LF1_DISPLAY_NAME_FORBIDDEN = /[|\u0000-\u001F\u007F]/;

/**
 * Campos de uma leitura LF1 ja separados por posicao. `ean` e `ncm` ficam
 * ausentes quando a posicao veio vazia; o preco chega como numero inteiro de
 * centavos.
 */
export const Lf1FieldsSchema = z
  .object({
    version: z.literal('LF1', { errorMap: () => ({ message: 'Versão deve ser LF1' }) }),
    systemCode: patternField(
      'Código do sistema',
      /^[0-9A-Za-z-]+$/,
      'Código do sistema aceita apenas letras, números e hífen',
    ),
    displayName: boundedTextField(
      'Nome',
      LF1_DISPLAY_NAME_MAX_LENGTH,
      LF1_DISPLAY_NAME_FORBIDDEN,
      'Nome não pode ter barra vertical (|) nem caractere de controle',
    ),
    priceInCentavos: nonNegativeSafeIntegerField('Preço em centavos'),
    ean: optionalPatternField(
      'Código de barras',
      /^(\d{8}|\d{12,14})$/,
      'Código de barras deve ter 8, 12, 13 ou 14 dígitos',
    ),
    ncm: optionalPatternField('NCM', /^\d{8}$/, 'NCM deve ter 8 dígitos, sem ponto'),
    copy: patternField(
      'Exemplar',
      /^c[1-9]\d*$/,
      'Exemplar deve ser c1, c2, c3 e assim por diante',
    ),
  })
  .strict('Leitura LF1 não aceita campo fora das sete posições');
