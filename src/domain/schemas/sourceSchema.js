import { z } from 'zod';

import {
  FEMININE,
  isoDateTimeField,
  limitedTextField,
  nonNegativeSafeIntegerField,
  patternField,
  positiveSafeIntegerField,
  uuidField,
} from './commonFields.js';

export const SOURCE_FILE_NAME_MAX_LENGTH = 255;

export const SOURCE_ORIGINS = Object.freeze({
  CAMERA: 'camera',
  FILE: 'file',
});

export const SOURCE_STATUSES = Object.freeze({
  READ: 'read',
  FAILED: 'failed',
});

/**
 * Motivo de uma foto que o navegador nao conseguiu abrir. O codigo e estavel,
 * para gravar e filtrar; a frase em portugues e a que aparece na tela.
 */
export const SOURCE_FAILURE_REASONS = Object.freeze({
  UNSUPPORTED_FORMAT: 'unsupported-format',
  CORRUPTED_FILE: 'corrupted-file',
});

export const SOURCE_FAILURE_MESSAGES = Object.freeze({
  [SOURCE_FAILURE_REASONS.UNSUPPORTED_FORMAT]: 'formato de imagem não suportado',
  [SOURCE_FAILURE_REASONS.CORRUPTED_FILE]: 'arquivo corrompido ou incompleto',
});

const EXTRA_KEY_MESSAGE = 'Fonte não aceita campo fora do registro';

/**
 * Metadados de uma foto processada. Os bytes da imagem nunca entram: o registro
 * guarda so o que identifica o arquivo e o resultado do processamento.
 * `lastModified` e o numero em milissegundos que o navegador entrega no arquivo.
 */
const sourceFields = {
  id: uuidField('Identificador da fonte'),
  sessionId: uuidField('Identificador da sessão'),
  fileName: limitedTextField('Nome do arquivo', SOURCE_FILE_NAME_MAX_LENGTH),
  byteSize: nonNegativeSafeIntegerField('Tamanho do arquivo'),
  lastModified: nonNegativeSafeIntegerField('Horário de modificação do arquivo'),
  sha256: patternField(
    'SHA-256',
    /^[0-9a-f]{64}$/,
    'SHA-256 deve ter 64 caracteres hexadecimais minúsculos',
  ),
  origin: z.enum([SOURCE_ORIGINS.CAMERA, SOURCE_ORIGINS.FILE], {
    message: 'Origem da fonte deve ser camera ou file',
  }),
  processedAt: isoDateTimeField('Data do processamento', FEMININE),
};

/** Foto aberta e decodificada, com zero ou mais leituras. */
const ReadSourceSchema = z
  .object({
    ...sourceFields,
    status: z.literal(SOURCE_STATUSES.READ),
    width: positiveSafeIntegerField('Largura da imagem', FEMININE),
    height: positiveSafeIntegerField('Altura da imagem', FEMININE),
  })
  .strict(EXTRA_KEY_MESSAGE);

/** Foto que o navegador nao abriu: sem dimensoes, com o motivo. */
const FailedSourceSchema = z
  .object({
    ...sourceFields,
    status: z.literal(SOURCE_STATUSES.FAILED),
    failureReason: z.enum(
      [SOURCE_FAILURE_REASONS.UNSUPPORTED_FORMAT, SOURCE_FAILURE_REASONS.CORRUPTED_FILE],
      { message: 'Motivo da falha deve ser unsupported-format ou corrupted-file' },
    ),
  })
  .strict(EXTRA_KEY_MESSAGE);

export const SourceSchema = z.discriminatedUnion('status', [ReadSourceSchema, FailedSourceSchema], {
  errorMap: () => ({ message: 'Situação da fonte deve ser read ou failed' }),
});
