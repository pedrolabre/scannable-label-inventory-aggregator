// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  boxAt,
  lf1Text,
  qrFixtureReadings,
  readingOf,
  sourceOf,
} from '../../test-fixtures/readingFixtures.js';
import { detectConflicts } from './conflictDetection.js';
import { applyResolutions } from './conflictResolution.js';
import { identifyCopies } from './copyIdentity.js';
import { summarizeProducts } from './inventoryAggregation.js';
import {
  CONFLICT_STATUSES,
  REJECTED_TEXT_MAX_LENGTH,
  SOURCE_STATUS_MESSAGES,
  TRUNCATION_MARK,
  conflictRows,
  copyRows,
  fileNameResolver,
  productRows,
  rejectedRows,
  sourceRows,
  truncateText,
} from './reportSections.js';

const graphemeCount = (text) =>
  [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(text)].length;

describe('truncateText', () => {
  it('mantém o texto de até 120 caracteres como veio', () => {
    const text = 'x'.repeat(REJECTED_TEXT_MAX_LENGTH);

    expect(truncateText(text)).toEqual({ displayText: text, truncated: false });
    expect(truncateText('')).toEqual({ displayText: '', truncated: false });
  });

  it('corta o 121º caractere e acrescenta o marcador', () => {
    const text = `${'a'.repeat(119)}bcd`;

    expect(truncateText(text)).toEqual({
      displayText: `${'a'.repeat(119)}b${TRUNCATION_MARK}`,
      truncated: true,
    });
  });

  it('conta a letra acentuada como um caractere, composta ou decomposta', () => {
    const composed = `${'a'.repeat(119)}é${'z'.repeat(5)}`;
    const decomposed = `${'a'.repeat(119)}é${'z'.repeat(5)}`;

    expect(truncateText(composed).displayText).toBe(`${'a'.repeat(119)}é${TRUNCATION_MARK}`);
    expect(truncateText(decomposed).displayText).toBe(
      `${'a'.repeat(119)}é${TRUNCATION_MARK}`,
    );
  });

  it('não separa o acento combinado da letra quando ele cairia depois do corte', () => {
    const text = `${'a'.repeat(119)}ȩ́fim`;
    const { displayText } = truncateText(text);

    expect(displayText).toBe(`${'a'.repeat(119)}ȩ́${TRUNCATION_MARK}`);
    expect(graphemeCount(displayText)).toBe(REJECTED_TEXT_MAX_LENGTH + 1);
  });

  it('mantém inteiro o emoji na fronteira, simples ou composto', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    const simple = `${'a'.repeat(119)}\u{1F600}resto`;
    const joined = `${'a'.repeat(119)}${family}resto`;

    expect(truncateText(simple).displayText).toBe(
      `${'a'.repeat(119)}\u{1F600}${TRUNCATION_MARK}`,
    );
    expect(truncateText(joined).displayText).toBe(`${'a'.repeat(119)}${family}${TRUNCATION_MARK}`);
  });

  it('não corta 120 emojis, que ocupam mais de 120 unidades UTF-16', () => {
    const text = '\u{1F600}'.repeat(REJECTED_TEXT_MAX_LENGTH);

    expect(text.length).toBe(240);
    expect(truncateText(text)).toEqual({ displayText: text, truncated: false });
  });
});

describe('fileNameResolver', () => {
  it('devolve o nome da foto e null para a foto desconhecida', () => {
    const fileNameOf = fileNameResolver([sourceOf('f1', { fileName: 'IMG_0001.jpg' })]);

    expect(fileNameOf('f1')).toBe('IMG_0001.jpg');
    expect(fileNameOf('sumida')).toBeNull();
  });
});

describe('copyRows', () => {
  it('traz código, exemplar, texto, leituras, fotos com o nome e o aviso com o nome', () => {
    const readings = qrFixtureReadings('qr-8.png', 'f2');
    const apple = 'LF1|DEMO-005|MAÇÃ FUJI KG|1099|||c1';
    const { copies } = identifyCopies([...readings, readingOf('x1', 'sumida', apple)]);
    const fileNameOf = fileNameResolver([sourceOf('f2', { fileName: 'IMG_0002.jpg' })]);
    const rows = copyRows(copies, fileNameOf);

    expect(rows.find((row) => row.systemCode === 'DEMO-005')).toEqual({
      systemCode: 'DEMO-005',
      copy: 'c1',
      text: apple,
      readingCount: 3,
      sources: [
        { sourceId: 'f2', fileName: 'IMG_0002.jpg' },
        { sourceId: 'sumida', fileName: null },
      ],
      warnings: [
        {
          code: 'probable-reprint',
          sourceId: 'f2',
          fileName: 'IMG_0002.jpg',
          positionCount: 2,
          message: 'mesmo texto em 2 posições da mesma foto: provável reimpressão',
        },
      ],
    });
    expect(rows.map((row) => row.systemCode)).toEqual(copies.map((copy) => copy.fields.systemCode));
  });
});

describe('rejectedRows', () => {
  it('traz a foto, o motivo, o campo e o texto inteiro ao lado do texto cortado', () => {
    const long = `https://exemplo.test/${'a'.repeat(150)}`;
    const badPrice = 'LF1|DEMO-001|CAFÉ|12,90|||c1';
    const { rejected } = identifyCopies([
      readingOf('r1', 'f3', long),
      readingOf('r2', 'f3', badPrice),
    ]);
    const rows = rejectedRows(rejected, fileNameResolver([sourceOf('f3')]));

    expect(rows).toEqual([
      {
        readingId: 'r1',
        sourceId: 'f3',
        fileName: 'f3.jpg',
        reason: 'not-lf1',
        message: 'não é LF1',
        field: null,
        text: long,
        displayText: `${long.slice(0, REJECTED_TEXT_MAX_LENGTH)}${TRUNCATION_MARK}`,
        textTruncated: true,
      },
      {
        readingId: 'r2',
        sourceId: 'f3',
        fileName: 'f3.jpg',
        reason: 'invalid-field',
        message: 'campo inválido: preço em centavos',
        field: 'priceInCentavos',
        text: badPrice,
        displayText: badPrice,
        textTruncated: false,
      },
    ]);
  });
});

describe('productRows e conflictRows', () => {
  const SUGAR = { systemCode: 'DEMO-002', displayName: 'AÇÚCAR', ean: '2000000000022' };
  const readings = [
    readingOf('s1', 'f1', lf1Text({ ...SUGAR, price: 549, copy: 'c1' }), boxAt(0, 0, 100)),
    readingOf('s2', 'f1', lf1Text({ ...SUGAR, price: 599, copy: 'c2' }), boxAt(200, 0, 100)),
    readingOf('s3', 'f1', lf1Text({ ...SUGAR, price: 599, copy: 'c2' }), boxAt(400, 0, 100)),
    readingOf('s4', 'f1', lf1Text({ ...SUGAR, price: 599, ean: '', copy: 'c3' })),
  ];

  function reportParts(resolutions) {
    const { copies } = identifyCopies(readings);
    const conflicts = detectConflicts(copies);
    const { products } = applyResolutions(summarizeProducts(copies), conflicts, resolutions);

    return { copies, conflicts, products };
  }

  it('soma os avisos dos exemplares do produto', () => {
    const { copies, products } = reportParts([]);

    expect(productRows(products, copies)).toEqual([{ ...products[0], warningCount: 1 }]);
  });

  it('marca cada conflito como aberto ou resolvido, com a escolha e as variantes', () => {
    const resolution = {
      sessionId: 'sessao-teste',
      systemCode: 'DEMO-002',
      choices: { ean: null },
    };
    const { conflicts, products } = reportParts([resolution]);

    expect(conflictRows(conflicts, products)).toEqual([
      {
        systemCode: 'DEMO-002',
        field: 'priceInCentavos',
        status: CONFLICT_STATUSES.OPEN,
        chosenValue: null,
        variants: conflicts[0].variants,
      },
      {
        systemCode: 'DEMO-002',
        field: 'ean',
        status: CONFLICT_STATUSES.RESOLVED,
        chosenValue: null,
        variants: conflicts[1].variants,
      },
    ]);
  });
});

describe('sourceRows', () => {
  it('traz situação, motivo da falha, contagens e o aviso da foto sem símbolo', () => {
    const sources = [
      sourceOf('f1', { fileName: 'IMG_0001.jpg', origin: 'camera' }),
      sourceOf('f2', { fileName: 'IMG_0002.HEIC', failureReason: 'unsupported-format' }),
      sourceOf('f3', { fileName: 'IMG_0003.jpg' }),
    ];
    const readings = [
      readingOf('a', 'f1', lf1Text({ systemCode: 'A', displayName: 'A', price: 1 })),
      readingOf('b', 'f1', 'texto qualquer'),
      readingOf('c', 'f1', lf1Text({ systemCode: 'A', displayName: 'A', price: 1 })),
    ];
    const { rejected } = identifyCopies(readings);

    expect(sourceRows(sources, readings, rejected)).toEqual([
      {
        sourceId: 'f1',
        fileName: 'IMG_0001.jpg',
        origin: 'camera',
        status: 'read',
        statusMessage: SOURCE_STATUS_MESSAGES.read,
        failureReason: null,
        failureMessage: null,
        symbolCount: 3,
        validCount: 2,
        rejectedCount: 1,
        warnings: [],
      },
      {
        sourceId: 'f2',
        fileName: 'IMG_0002.HEIC',
        origin: 'file',
        status: 'failed',
        statusMessage: 'com falha',
        failureReason: 'unsupported-format',
        failureMessage: 'formato de imagem não suportado',
        symbolCount: 0,
        validCount: 0,
        rejectedCount: 0,
        warnings: [],
      },
      {
        sourceId: 'f3',
        fileName: 'IMG_0003.jpg',
        origin: 'file',
        status: 'read',
        statusMessage: 'lida',
        failureReason: null,
        failureMessage: null,
        symbolCount: 0,
        validCount: 0,
        rejectedCount: 0,
        warnings: [{ code: 'no-symbols', message: 'nenhum símbolo encontrado' }],
      },
    ]);
  });
});
