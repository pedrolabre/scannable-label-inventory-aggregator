/**
 * Nome dos arquivos exportados: `inventario-AAAA-MM-DD-HHMM.<ext>`, com a data
 * e a hora locais do instante da geracao, e um sufixo opcional para o segundo
 * arquivo da mesma exportacao (`inventario-2026-10-06-1603-exemplares.csv`).
 *
 * O instante chega pronto, em ISO 8601, o mesmo que vai para o relatorio: nada
 * aqui le o relogio, e o nome e o conteudo nunca discordam da data. A hora e a
 * do aparelho, a que o operador ve no proprio relogio.
 */

const FILE_PREFIX = 'inventario';

function twoDigits(value) {
  return String(value).padStart(2, '0');
}

export function buildExportFileName(generatedAt, extension, suffix = null) {
  const instant = new Date(generatedAt);

  if (Number.isNaN(instant.getTime())) {
    throw new TypeError(`Instante de geração inválido: ${generatedAt}`);
  }

  const date = [
    instant.getFullYear(),
    twoDigits(instant.getMonth() + 1),
    twoDigits(instant.getDate()),
  ].join('-');
  const time = `${twoDigits(instant.getHours())}${twoDigits(instant.getMinutes())}`;
  const parts = [FILE_PREFIX, date, time, suffix].filter(Boolean);

  return `${parts.join('-')}.${extension}`;
}
