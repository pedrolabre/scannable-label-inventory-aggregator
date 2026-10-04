// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  boxAt,
  formatTestCentavos,
  lf1Text,
  readingOf,
  sourceOf,
} from '../../test-fixtures/readingFixtures.js';

import { buildInventoryReport } from './inventoryReport.js';
import { MISSING_VALUE, describeGeneratedAt, describeReportDocument } from './reportDocument.js';
import { FONT_SIZES } from './reportLayout.js';
import { ELLIPSIS, FONT_CHARACTERS } from './reportText.js';

/**
 * Sessao inventada com o que muda o documento: acento, emoji no nome da
 * sessao e no texto rejeitado, conflito resolvido nos dois campos opcionais
 * (um deles pela variante sem o campo), aviso de reimpressao, exemplar lido em
 * duas fotos, foto da camera, foto com falha, foto sem simbolo, recusa de
 * campo e escolha que deixou de valer.
 */

const SESSION = { id: 'sessao-pdf', name: 'Inventário corredor 4 🛒' };
const GENERATED_AT = '2026-10-06T20:03:48.765Z';
const OFFSET = -180;

const COFFEE = { systemCode: 'DEMO-001', displayName: 'CAFÉ TORRADO 500G', price: 2490 };
const COFFEE_C1 = lf1Text({ ...COFFEE, ean: '2000000000015', ncm: '09012100' });
const COFFEE_C2 = lf1Text({ ...COFFEE, ean: '2000000000015', ncm: '09012100', copy: 'c2' });
const CORNER = { systemCode: '118789', displayName: 'CANTINHO CAFÉ RUBI', price: 85990 };
const CORNER_FULL = lf1Text({ ...CORNER, ean: '7899075420416', ncm: '94035000' });
const CORNER_BARE = lf1Text({ ...CORNER, copy: 'c2' });
const BAD_FIELD = lf1Text({ systemCode: 'DEMO-020', displayName: 'NOME\u0007RUIM', price: 100 });
const FOREIGN = `https://exemplo.invalido/produto/😀/漢字/${'x'.repeat(200)}`;

const SOURCES = [
  sourceOf('f1', { fileName: 'gondola-1.jpg', processedAt: '2026-10-06T12:00:00.000Z' }),
  sourceOf('f2', {
    fileName: 'image.jpg',
    origin: 'camera',
    processedAt: '2026-10-06T12:01:00.000Z',
  }),
  sourceOf('f3', {
    fileName: 'quebrada.jpg',
    processedAt: '2026-10-06T12:02:00.000Z',
    failureReason: 'corrupted-file',
  }),
  sourceOf('f4', { fileName: 'vazia.jpg', processedAt: '2026-10-06T12:03:00.000Z' }),
];

const READINGS = [
  readingOf('l1', 'f1', COFFEE_C1, boxAt(0, 0, 100)),
  readingOf('l2', 'f1', COFFEE_C1, boxAt(400, 0, 100)),
  readingOf('l3', 'f1', CORNER_BARE, boxAt(0, 400, 100)),
  readingOf('l4', 'f1', FOREIGN, boxAt(400, 400, 100)),
  readingOf('l5', 'f2', COFFEE_C1, boxAt(0, 0, 100)),
  readingOf('l6', 'f2', COFFEE_C2, boxAt(400, 0, 100)),
  readingOf('l7', 'f2', CORNER_FULL, boxAt(0, 400, 100)),
  readingOf('l8', 'f2', BAD_FIELD, boxAt(400, 400, 100)),
];

const RESOLUTIONS = [
  { sessionId: SESSION.id, systemCode: '118789', choices: { ean: '7899075420416', ncm: null } },
  { sessionId: SESSION.id, systemCode: 'DEMO-099', choices: { priceInCentavos: 100 } },
];

function reportOf({
  sources = SOURCES,
  readings = READINGS,
  resolutions = RESOLUTIONS,
  generatedAt = GENERATED_AT,
} = {}) {
  return buildInventoryReport({ session: SESSION, sources, readings, resolutions, generatedAt });
}

function describe_(report = reportOf(), options = {}) {
  return describeReportDocument(report, {
    offsetMinutes: OFFSET,
    formatCentavos: formatTestCentavos,
    ...options,
  });
}

function textOps(description) {
  return description.pages.flatMap((page) => page.ops.filter((op) => op.type === 'text'));
}

function texts(description) {
  return textOps(description).map((op) => op.text);
}

/** Linhas de tabela que comecam por `first`: os textos na mesma altura da mesma pagina. */
function rowsWith(description, first) {
  return description.pages.flatMap((page) => {
    const ops = page.ops.filter((op) => op.type === 'text');

    return ops
      .filter((op) => op.text === first)
      .map((anchor) => ops.filter((op) => op.yMm === anchor.yMm).map((op) => op.text))
      .filter((row) => row[0] === first);
  });
}

function rowWith(description, first) {
  return rowsWith(description, first)[0] ?? null;
}

describe('describeReportDocument', () => {
  it('descreve o cabeçalho, as propriedades e a data de criação no deslocamento recebido', () => {
    const description = describe_();

    expect(description.title).toBe('Relatório de inventário - Inventário corredor 4 ?');
    expect(description.subject).toBe('Inventário gerado em 06/10/2026 às 17:03:48 (UTC-03:00)');
    expect(description.creationDate).toBe("D:20261006170348-03'00'");
    expect(texts(description).slice(0, 3)).toEqual([
      'Relatório de inventário',
      'Inventário corredor 4 ?',
      'Gerado em 06/10/2026 às 17:03:48 (UTC-03:00)',
    ]);
  });

  it('põe as seções na ordem, com a contagem, e a nota das trocas no fim', () => {
    const headings = textOps(describe_())
      .filter((op) => op.bold && op.fontSizePt === FONT_SIZES.heading)
      .map((op) => op.text);

    expect(headings).toEqual([
      'Totais',
      'Resumo por produto (2)',
      'Conflitos resolvidos (2)',
      'Exemplares (4)',
      'Textos rejeitados (2)',
      'Fotos (4)',
      'Escolhas ignoradas (1)',
      'Observação',
    ]);
  });

  it('escreve os totais com o valor em reais pelo formatador recebido', () => {
    const formatCentavos = vi.fn(formatTestCentavos);
    const description = describe_(reportOf(), { formatCentavos });

    expect(rowWith(description, 'Fotos processadas')).toEqual([
      'Fotos processadas',
      '4',
      'Exemplares',
      '4',
    ]);
    expect(rowWith(description, 'Fotos com falha')).toEqual([
      'Fotos com falha',
      '1',
      'Produtos',
      '2',
    ]);
    expect(rowWith(description, 'Rejeitados')).toEqual([
      'Rejeitados',
      '2',
      'Valor total',
      'R$ 1.769,60',
    ]);
    expect(rowWith(description, 'Avisos de reimpressão')).toEqual([
      'Avisos de reimpressão',
      '1',
      'Conflitos resolvidos',
      '2',
    ]);
    expect(formatCentavos).toHaveBeenCalledWith(176960);
    expect(formatCentavos).toHaveBeenCalledWith(85990);
  });

  it('escreve o resumo com os valores em reais e o campo ausente como travessão', () => {
    const description = describe_();

    expect(rowWith(description, '118789')).toEqual([
      '118789',
      'CANTINHO CAFÉ RUBI',
      'R$ 859,90',
      '2',
      'R$ 1.719,80',
      '7899075420416',
      MISSING_VALUE,
    ]);
    expect(rowWith(description, 'DEMO-001')).toEqual([
      'DEMO-001',
      'CAFÉ TORRADO 500G',
      'R$ 24,90',
      '2',
      'R$ 49,80',
      '2000000000015',
      '09012100',
    ]);
  });

  it('lista os conflitos resolvidos com o valor escolhido e as variantes com os exemplares', () => {
    const description = describe_();
    const rows = description.pages
      .flatMap((page) => page.ops)
      .filter((op) => op.type === 'text' && op.text.includes(' (1) · '))
      .map((op) => op.text);

    expect(rows).toEqual(['7899075420416 (1) · — (1)', '94035000 (1) · — (1)']);
    expect(texts(description)).toContain('EAN');
    expect(texts(description)).toContain('NCM');
  });

  it('lista os exemplares com as fotos, o aviso com a foto e o texto lido', () => {
    const description = describe_();
    const [, coffee] = rowsWith(description, 'DEMO-001');
    const lf1 = coffee[5];

    expect(coffee.slice(0, 5)).toEqual([
      'DEMO-001',
      'c1',
      '3',
      'gondola-1.jpg,',
      'provável reimpressão',
    ]);
    expect(lf1.endsWith(ELLIPSIS)).toBe(true);
    expect(COFFEE_C1.startsWith(lf1.slice(0, -1))).toBe(true);
    // A segunda linha da celula: a outra foto e a foto do aviso.
    expect(texts(description)).toContain('image.jpg');
    expect(texts(description)).toContain('(gondola-1.jpg)');
    expect(rowsWith(description, '118789').at(-1)).toEqual([
      '118789',
      'c2',
      '1',
      'gondola-1.jpg',
      'LF1|118789|CANTINHO CAFÉ RUBI|85990|||c2',
    ]);
  });

  it('lista os rejeitados com o motivo e o texto cortado, com a regra dos caracteres', () => {
    const description = describe_();
    const rejected = texts(description).filter((text) => text.startsWith('https://'));

    expect(texts(description)).toContain('não é LF1');
    expect(texts(description)).toContain('campo inválido: nome');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].startsWith('https://exemplo.invalido/produto/?/??/')).toBe(true);
    expect(texts(description)).toContain('LF1|DEMO-020|NOME?RUIM|100|||c1');
  });

  it('lista as fotos com a origem, o estado, as contagens e a observação', () => {
    const description = describe_();

    expect(rowsWith(description, 'image.jpg').at(-1)).toEqual([
      'image.jpg',
      'câmera',
      'lida',
      '4',
      '3',
      '1',
    ]);
    expect(rowWith(description, 'quebrada.jpg')).toEqual([
      'quebrada.jpg',
      'arquivo',
      'com falha',
      '0',
      '0',
      '0',
      'arquivo corrompido ou incompleto',
    ]);
    expect(rowWith(description, 'vazia.jpg')).toEqual([
      'vazia.jpg',
      'arquivo',
      'lida',
      '0',
      '0',
      '0',
      'nenhum símbolo encontrado',
    ]);
  });

  it('lista as escolhas ignoradas com o valor em reais e o motivo', () => {
    expect(rowWith(describe_(), 'DEMO-099')).toEqual([
      'DEMO-099',
      'preço',
      'R$ 1,00',
      'o produto não aparece mais nas leituras da sessão',
    ]);
  });

  it('conta as trocas de caractere e as escreve na nota do fim', () => {
    const description = describe_();

    // Emoji do nome da sessao (uma vez), emoji e dois ideogramas do texto rejeitado, controle do nome recusado.
    expect(description.replacedCount).toBe(5);
    expect(texts(description)).toContain(
      '5 caracteres fora da fonte do PDF saíram como ?. O CSV e o XML levam o texto original.',
    );
  });

  it('só escreve caracteres que a fonte tem', () => {
    const allowed = new Set(FONT_CHARACTERS);

    for (const text of texts(describe_())) {
      for (const character of text) {
        expect(allowed.has(character)).toBe(true);
      }
    }
  });

  it('dá a mesma descrição com a entrada em outra ordem', () => {
    const reversed = reportOf({
      sources: [...SOURCES].reverse(),
      readings: [...READINGS].reverse(),
      resolutions: [...RESOLUTIONS].reverse(),
    });

    expect(describe_(reversed)).toEqual(describe_());
  });

  it('muda só a hora escrita e a data de criação com outro deslocamento', () => {
    const local = describe_();
    const utc = describe_(reportOf(), { offsetMinutes: 0 });

    expect(utc.creationDate).toBe("D:20261006200348+00'00'");
    expect(utc.subject).toBe('Inventário gerado em 06/10/2026 às 20:03:48 (UTC+00:00)');
    expect(utc.pages.length).toBe(local.pages.length);
    expect(texts(utc).filter((text, index) => text !== texts(local)[index])).toEqual([
      'Gerado em 06/10/2026 às 20:03:48 (UTC+00:00)',
    ]);
  });

  it('recusa o relatório com conflito aberto', () => {
    expect(() => describe_(reportOf({ resolutions: [] }))).toThrow(
      'Relatório com conflito aberto não é exportado',
    );
  });
});

describe('describeGeneratedAt', () => {
  it('escreve a data, a hora e o fuso, e a data de criação no formato do PDF', () => {
    expect(describeGeneratedAt('2026-10-06T20:03:48.999Z', -180)).toEqual({
      text: '06/10/2026 às 17:03:48 (UTC-03:00)',
      creationDate: "D:20261006170348-03'00'",
    });
    expect(describeGeneratedAt('2026-12-31T23:30:00.000Z', 330)).toEqual({
      text: '01/01/2027 às 05:00:00 (UTC+05:30)',
      creationDate: "D:20270101050000+05'30'",
    });
  });
});
