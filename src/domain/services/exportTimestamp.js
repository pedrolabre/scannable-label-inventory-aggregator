/**
 * Instante da geracao escrito com a hora local e o deslocamento do fuso:
 * `2026-10-06T17:03:48-03:00`.
 *
 * O relatorio guarda o instante em UTC, como o relogio o entrega. Quem le o
 * arquivo exportado quer a hora que o operador viu no aparelho, sem perder o
 * instante exato: a hora local com o deslocamento diz as duas coisas.
 *
 * A escrita e pura: recebe o instante e o deslocamento em minutos. So
 * `localOffsetMinutes` consulta o fuso do aparelho, e quem chama decide quando;
 * o serializador recebe o numero pronto. Segundos cortados, sem os
 * milissegundos, como os minutos do nome do arquivo: arredondar poderia passar
 * para o minuto seguinte e o arquivo diria uma hora e o nome outra.
 */

/** Maior deslocamento aceito, em minutos: 18 horas, o limite do ISO 8601. */
const MAX_OFFSET_MINUTES = 18 * 60;

const MINUTE_MS = 60 * 1000;

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

function instantOf(generatedAt) {
  const instant = new Date(generatedAt);

  if (Number.isNaN(instant.getTime())) {
    throw new TypeError(`Instante de geração inválido: ${generatedAt}`);
  }

  return instant;
}

/** Deslocamento do fuso do aparelho no instante, em minutos a leste de UTC. */
export function localOffsetMinutes(generatedAt) {
  // `getTimezoneOffset` conta a oeste; `0 - x` evita o -0 de UTC.
  return 0 - instantOf(generatedAt).getTimezoneOffset();
}

function offsetText(offsetMinutes) {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const minutes = Math.abs(offsetMinutes);

  return `${sign}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * `AAAA-MM-DDTHH:MM:SS+HH:MM` (ou `-HH:MM`) do instante ISO 8601 no deslocamento recebido,
 * em minutos a leste de UTC (`-180` para `-03:00`).
 */
export function formatLocalTimestamp(generatedAt, offsetMinutes) {
  const instant = instantOf(generatedAt);

  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > MAX_OFFSET_MINUTES) {
    throw new TypeError(`Deslocamento de fuso inválido: ${offsetMinutes}`);
  }

  const local = new Date(instant.getTime() + offsetMinutes * MINUTE_MS);
  const date = [
    pad(local.getUTCFullYear(), 4),
    pad(local.getUTCMonth() + 1),
    pad(local.getUTCDate()),
  ].join('-');
  const time = [local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds()]
    .map((part) => pad(part))
    .join(':');

  return `${date}T${time}${offsetText(offsetMinutes)}`;
}
