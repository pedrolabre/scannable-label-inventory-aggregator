import { parseLf1 } from './lf1Contract.js';

/**
 * Textos lidos de uma foto, separados pelo contrato LF1. O resultado e
 * calculado das leituras gravadas sempre que alguem o exibe; nada dele vai
 * para o banco.
 *
 * Devolve, na ordem em que o leitor entregou os simbolos:
 *
 * - `valid`: `[{ id, text, hasPosition }]`;
 * - `rejected`: `[{ id, text, hasPosition, reason, message }]`, com o codigo
 *   estavel e a frase em portugues da recusa;
 * - `positionCount`: quantos simbolos vieram com a posicao na imagem.
 */
export function classifySourceReadings(readings, sourceId) {
  const valid = [];
  const rejected = [];
  let positionCount = 0;

  for (const reading of readings) {
    if (reading.sourceId !== sourceId) {
      continue;
    }

    const hasPosition = reading.position !== undefined && reading.position !== null;
    const entry = { id: reading.id, text: reading.text, hasPosition };
    const parsed = parseLf1(reading.text);

    if (hasPosition) {
      positionCount += 1;
    }

    if (parsed.ok) {
      valid.push(entry);
    } else {
      rejected.push({ ...entry, reason: parsed.reason, message: parsed.message });
    }
  }

  return { valid, rejected, positionCount };
}
