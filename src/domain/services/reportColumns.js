/**
 * Colunas das tabelas do relatorio em PDF, em milimetro, na largura do
 * conteudo da pagina A4 (180 mm em cada tabela).
 *
 * Cada coluna diz o titulo, a largura e como o valor cabe nela: `text` corta
 * com reticencias, `number` nunca corta e reduz o corpo se preciso, e `wrap`
 * quebra em ate `maxLines` linhas. Numero alinha a direita.
 *
 * O nome e o texto LF1 saem numa linha, cortados: o CSV e o XML levam o texto
 * inteiro. As fotos, o aviso, as variantes, o motivo e o texto rejeitado
 * quebram em duas linhas, porque cortar esconderia a foto ou o motivo.
 */

export const SUMMARY_COLUMNS = Object.freeze([
  { label: 'Código', widthMm: 20, kind: 'text' },
  { label: 'Nome', widthMm: 56, kind: 'text' },
  { label: 'Preço', widthMm: 24, kind: 'number', align: 'right' },
  { label: 'Qtd.', widthMm: 12, kind: 'number', align: 'right' },
  { label: 'Total', widthMm: 26, kind: 'number', align: 'right' },
  { label: 'EAN', widthMm: 26, kind: 'text' },
  { label: 'NCM', widthMm: 16, kind: 'text' },
]);

export const RESOLVED_COLUMNS = Object.freeze([
  { label: 'Código', widthMm: 24, kind: 'text' },
  { label: 'Campo', widthMm: 16, kind: 'text' },
  { label: 'Valor escolhido', widthMm: 50, kind: 'text' },
  { label: 'Variantes (exemplares)', widthMm: 90, kind: 'wrap', maxLines: 2 },
]);

export const COPY_COLUMNS = Object.freeze([
  { label: 'Código', widthMm: 20, kind: 'text' },
  { label: 'Exemplar', widthMm: 16, kind: 'text' },
  { label: 'Leituras', widthMm: 15, kind: 'number', align: 'right' },
  { label: 'Fotos', widthMm: 31, kind: 'wrap', maxLines: 2 },
  { label: 'Aviso', widthMm: 30, kind: 'wrap', maxLines: 2 },
  { label: 'Texto LF1', widthMm: 68, kind: 'text' },
]);

export const REJECTED_COLUMNS = Object.freeze([
  { label: 'Foto', widthMm: 36, kind: 'text' },
  { label: 'Motivo', widthMm: 38, kind: 'text' },
  { label: 'Texto lido', widthMm: 106, kind: 'wrap', maxLines: 2 },
]);

export const SOURCE_COLUMNS = Object.freeze([
  { label: 'Foto', widthMm: 50, kind: 'text' },
  { label: 'Origem', widthMm: 16, kind: 'text' },
  { label: 'Estado', widthMm: 18, kind: 'text' },
  { label: 'Símbolos', widthMm: 16, kind: 'number', align: 'right' },
  { label: 'Válidos', widthMm: 15, kind: 'number', align: 'right' },
  { label: 'Rejeitados', widthMm: 18, kind: 'number', align: 'right' },
  { label: 'Observação', widthMm: 47, kind: 'text' },
]);

export const IGNORED_COLUMNS = Object.freeze([
  { label: 'Código', widthMm: 24, kind: 'text' },
  { label: 'Campo', widthMm: 16, kind: 'text' },
  { label: 'Valor', widthMm: 50, kind: 'text' },
  { label: 'Motivo', widthMm: 90, kind: 'wrap', maxLines: 2 },
]);
