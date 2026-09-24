import { z } from 'zod';

import { FEMININE, finiteNumberField, isoDateTimeField, uuidField } from './commonFields.js';

const pointSchema = (label) =>
  z
    .object(
      {
        x: finiteNumberField(`${label}: x`),
        y: finiteNumberField(`${label}: y`),
      },
      {
        required_error: `${label} obrigatório`,
        invalid_type_error: `${label} deve ter x e y`,
      },
    )
    .strict(`${label} aceita só x e y`);

/**
 * Os quatro cantos do simbolo na imagem, em pixels, na ordem em que o
 * decodificador os entrega. Um quadrilatero, e nao uma caixa alinhada, porque a
 * etiqueta fotografada de lado aparece inclinada.
 */
export const PositionSchema = z
  .object(
    {
      topLeft: pointSchema('Canto superior esquerdo'),
      topRight: pointSchema('Canto superior direito'),
      bottomRight: pointSchema('Canto inferior direito'),
      bottomLeft: pointSchema('Canto inferior esquerdo'),
    },
    { invalid_type_error: 'Posição deve ter os quatro cantos' },
  )
  .strict('Posição aceita só os quatro cantos');

/**
 * Um simbolo decodificado. O registro guarda o texto exatamente como veio do
 * decodificador, inclusive vazio ou fora do formato LF1, e nada derivado dele:
 * campos, validade e motivo de recusa sao calculados do texto sempre que
 * necessario.
 */
export const ReadingSchema = z
  .object({
    id: uuidField('Identificador da leitura'),
    sessionId: uuidField('Identificador da sessão'),
    sourceId: uuidField('Identificador da fonte'),
    text: z.string({
      required_error: 'Texto lido obrigatório',
      invalid_type_error: 'Texto lido deve ser texto',
    }),
    position: PositionSchema.optional(),
    readAt: isoDateTimeField('Data da leitura', FEMININE),
  })
  .strict('Leitura não aceita campo fora do registro');
