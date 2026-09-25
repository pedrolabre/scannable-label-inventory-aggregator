/**
 * Textos das imagens de teste com QR Codes LF1. Os dados sao inventados: os
 * codigos DEMO nao existem, os codigos de barras usam a faixa 200-299, reservada
 * para uso interno de loja, e os dois textos com o codigo 118789 sao os
 * exemplos do proprio README.
 *
 * `scripts/generate-qr-fixtures.mjs` desenha cada lista numa imagem, na ordem
 * da lista, da esquerda para a direita e de cima para baixo. A suite compara o
 * que o decodificador devolve com estas mesmas strings, byte a byte.
 */

const COFFEE = 'LF1|DEMO-001|CAFÉ TORRADO EM GRÃOS 500G|2490|2000000000015|09012100|c1';
const APPLE = 'LF1|DEMO-005|MAÇÃ FUJI KG|1099|||c1';

export const QR_FIXTURES = Object.freeze([
  Object.freeze({
    file: 'qr-1.png',
    columns: 1,
    texts: Object.freeze([COFFEE]),
  }),
  Object.freeze({
    file: 'qr-4.png',
    columns: 2,
    texts: Object.freeze([
      'LF1|DEMO-002|AÇÚCAR CRISTAL 1KG|549|2000000000022|17019900|c1',
      'LF1|DEMO-003|FEIJÃO CARIOCA 1KG|899|||c1',
      'LF1|DEMO-004|SABÃO EM PÓ 800G|1275|20000042|34022000|c2',
      'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1',
    ]),
  }),
  Object.freeze({
    file: 'qr-8.png',
    columns: 4,
    // O primeiro e o ultimo texto sao iguais: duas etiquetas fisicas com o
    // mesmo conteudo na mesma foto, como numa reimpressao.
    texts: Object.freeze([
      APPLE,
      'LF1|DEMO-006|PÃO FRANCÊS KG|1690|||c3',
      'LF1|DEMO-007|ÓLEO DE SOJA 900ML|799|2000000000077|15079011|c1',
      'LF1|DEMO-008|LEITE INTEGRAL 1L|529|2000000000084|04012010|c1',
      'LF1|118789|CANTINHO CAFE RUBI|85990|||c1',
      'LF1|DEMO-009|MACARRÃO ESPAGUETE 500G|459|||c1',
      'LF1|DEMO-010|ÁGUA MINERAL 1,5L|299|||c1',
      APPLE,
    ]),
  }),
]);

/** Tamanho de cada modulo do simbolo, em pixels da imagem. */
export const QR_FIXTURE_MODULE_PIXELS = 4;

/** Zona de silencio em volta de cada simbolo, em modulos. */
export const QR_FIXTURE_QUIET_ZONE_MODULES = 4;
