// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { QR_FIXTURES } from '../../test-fixtures/qrFixtures.js';
import {
  boxAt,
  lf1Text,
  qrFixtureReadings,
  readingOf,
} from '../../test-fixtures/readingFixtures.js';
import {
  COPY_WARNINGS,
  COPY_WARNING_MESSAGES,
  compareSystemCodes,
  countDistinctPositions,
  identifyCopies,
} from './copyIdentity.js';

const COFFEE = lf1Text({ systemCode: 'DEMO-001', displayName: 'CAFÉ TORRADO 500G', price: 1899 });
const RICE = lf1Text({ systemCode: 'DEMO-002', displayName: 'ARROZ 5KG', price: 2690, copy: 'c2' });

describe('identifyCopies', () => {
  it('conta 1 a mesma etiqueta em duas fotos, com 2 leituras e as duas fotos', () => {
    const { copies, rejected } = identifyCopies([
      readingOf('l1', 'foto-a', COFFEE, boxAt(0, 0, 100)),
      readingOf('l2', 'foto-b', COFFEE, boxAt(400, 0, 100)),
    ]);

    expect(rejected).toEqual([]);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      text: COFFEE,
      readingCount: 2,
      sourceIds: ['foto-a', 'foto-b'],
      warnings: [],
    });
    expect(copies[0].fields).toMatchObject({
      systemCode: 'DEMO-001',
      priceInCentavos: 1899,
      copy: 'c1',
    });
  });

  it('conta 1 o mesmo texto em duas posições distintas da mesma foto, com o aviso da foto', () => {
    const { copies } = identifyCopies([
      readingOf('l1', 'foto-a', COFFEE, boxAt(0, 0, 100)),
      readingOf('l2', 'foto-a', COFFEE, boxAt(300, 0, 100)),
    ]);

    expect(copies).toHaveLength(1);
    expect(copies[0].readingCount).toBe(2);
    expect(copies[0].warnings).toEqual([
      {
        code: 'probable-reprint',
        sourceId: 'foto-a',
        positionCount: 2,
        message: 'mesmo texto em 2 posições da mesma foto: provável reimpressão',
      },
    ]);
  });

  it('não avisa o mesmo texto em caixas sobrepostas, inclusive no limite de 0,5', () => {
    const { copies } = identifyCopies([
      readingOf('l1', 'foto-a', COFFEE, boxAt(0, 0, 100)),
      readingOf('l2', 'foto-a', COFFEE, boxAt(5, 5, 100)),
      readingOf('l3', 'foto-a', COFFEE, boxAt(0, 0, 100, 50)),
    ]);

    expect(copies[0].readingCount).toBe(3);
    expect(copies[0].warnings).toEqual([]);
  });

  it('dá um aviso por foto, com o número de posições de cada uma', () => {
    const { copies } = identifyCopies([
      readingOf('l1', 'foto-b', COFFEE, boxAt(0, 0, 100)),
      readingOf('l2', 'foto-a', COFFEE, boxAt(0, 0, 100)),
      readingOf('l3', 'foto-a', COFFEE, boxAt(200, 0, 100)),
      readingOf('l4', 'foto-a', COFFEE, boxAt(400, 0, 100)),
      readingOf('l5', 'foto-b', COFFEE, boxAt(300, 300, 100)),
      readingOf('l6', 'foto-c', COFFEE, boxAt(0, 0, 100)),
    ]);

    expect(copies[0].sourceIds).toEqual(['foto-b', 'foto-a', 'foto-c']);
    expect(
      copies[0].warnings.map(({ sourceId, positionCount }) => [sourceId, positionCount]),
    ).toEqual([
      ['foto-b', 2],
      ['foto-a', 3],
    ]);
  });

  it('ignora para o aviso a leitura sem posição e a caixa sem área, sem descartar a leitura', () => {
    const collapsed = boxAt(300, 300, 0);
    const { copies } = identifyCopies([
      readingOf('l1', 'foto-a', COFFEE, boxAt(0, 0, 100)),
      readingOf('l2', 'foto-a', COFFEE),
      readingOf('l3', 'foto-a', COFFEE, null),
      readingOf('l4', 'foto-a', COFFEE, collapsed),
    ]);

    expect(copies[0].readingCount).toBe(4);
    expect(copies[0].warnings).toEqual([]);
  });

  it('deixa o texto rejeitado fora da contagem, uma linha por leitura, com a foto e o motivo', () => {
    const noName = 'LF1|DEMO-003||100|||c1';
    const { copies, rejected } = identifyCopies([
      readingOf('l1', 'foto-a', 'https://exemplo.invalido'),
      readingOf('l2', 'foto-a', COFFEE),
      readingOf('l3', 'foto-b', 'https://exemplo.invalido'),
      readingOf('l4', 'foto-b', noName),
      readingOf('l5', 'foto-b', 'LF2|DEMO-004|X|1|||c1'),
      readingOf('l6', 'foto-b', ''),
    ]);

    expect(copies.map((copy) => copy.text)).toEqual([COFFEE]);
    expect(rejected).toEqual([
      {
        readingId: 'l1',
        sourceId: 'foto-a',
        text: 'https://exemplo.invalido',
        reason: 'not-lf1',
        message: 'não é LF1',
      },
      {
        readingId: 'l3',
        sourceId: 'foto-b',
        text: 'https://exemplo.invalido',
        reason: 'not-lf1',
        message: 'não é LF1',
      },
      {
        readingId: 'l4',
        sourceId: 'foto-b',
        text: noName,
        reason: 'invalid-field',
        message: 'campo inválido: nome',
        field: 'displayName',
      },
      {
        readingId: 'l5',
        sourceId: 'foto-b',
        text: 'LF2|DEMO-004|X|1|||c1',
        reason: 'unsupported-version',
        message: 'versão não suportada',
      },
      { readingId: 'l6', sourceId: 'foto-b', text: '', reason: 'not-lf1', message: 'não é LF1' },
    ]);
  });

  it('ordena por código com números comparados como número, depois por exemplar e pelo texto', () => {
    const texts = [
      lf1Text({ systemCode: '10', displayName: 'B', price: 1, copy: 'c1' }),
      lf1Text({ systemCode: '2', displayName: 'A', price: 1, copy: 'c10' }),
      lf1Text({ systemCode: '2', displayName: 'A', price: 1, copy: 'c2' }),
      lf1Text({ systemCode: '2', displayName: 'A', price: 1, ean: '20000042', copy: 'c2' }),
      lf1Text({ systemCode: 'DEMO-10', displayName: 'C', price: 1 }),
      lf1Text({ systemCode: 'DEMO-9', displayName: 'C', price: 1 }),
    ];
    const readings = texts.map((text, index) => readingOf(`l${index}`, 'foto-a', text));

    const forward = identifyCopies(readings).copies.map((copy) => copy.text);
    const backward = identifyCopies([...readings].reverse()).copies.map((copy) => copy.text);

    expect(forward).toEqual([texts[3], texts[2], texts[1], texts[0], texts[5], texts[4]]);
    expect(backward).toEqual(forward);
  });

  it('devolve listas vazias sem leitura', () => {
    expect(identifyCopies([])).toEqual({ copies: [], rejected: [] });
  });
});

describe('identifyCopies com as imagens de teste', () => {
  const readings = [
    ...qrFixtureReadings('qr-1.png', 'foto-1'),
    ...qrFixtureReadings('qr-4.png', 'foto-4'),
    ...qrFixtureReadings('qr-8.png', 'foto-8'),
  ];
  const { copies, rejected } = identifyCopies(readings);
  const apple = QR_FIXTURES[2].texts[0];

  it('conta 12 exemplares em 13 leituras, sem rejeitados', () => {
    expect(readings).toHaveLength(13);
    expect(copies).toHaveLength(12);
    expect(rejected).toEqual([]);
  });

  it('avisa a maçã repetida em duas posições da mesma foto', () => {
    const copy = copies.find((entry) => entry.text === apple);

    expect(copy).toMatchObject({ readingCount: 2, sourceIds: ['foto-8'] });
    expect(copy.warnings).toEqual([
      expect.objectContaining({
        code: COPY_WARNINGS.PROBABLE_REPRINT,
        sourceId: 'foto-8',
        positionCount: 2,
      }),
    ]);
    expect(copies.filter((entry) => entry.warnings.length > 0)).toHaveLength(1);
  });

  it('separa os dois exemplares c1 do código 118789, com e sem código de barras e NCM', () => {
    const cantinho = copies.filter((entry) => entry.fields.systemCode === '118789');

    expect(cantinho.map((entry) => [entry.fields.ean, entry.fields.ncm, entry.sourceIds])).toEqual([
      ['7899075420416', '94035000', ['foto-4']],
      [undefined, undefined, ['foto-8']],
    ]);
  });
});

describe('countDistinctPositions', () => {
  it('junta cada caixa à primeira posição com que se sobrepõe, na ordem da leitura', () => {
    expect(countDistinctPositions([])).toBe(0);
    expect(countDistinctPositions([boxAt(0, 0, 100)])).toBe(1);
    expect(
      countDistinctPositions([
        boxAt(0, 0, 100),
        boxAt(10, 0, 100),
        boxAt(200, 0, 100),
        boxAt(205, 0, 100),
      ]),
    ).toBe(2);
  });
});

describe('compareSystemCodes', () => {
  it('ordena os trechos numéricos como número e desempata pela ordem dos caracteres', () => {
    expect(['10', '9', 'A-2', 'A-10', 'a-2'].sort(compareSystemCodes)).toEqual([
      '9',
      '10',
      'a-2',
      'A-2',
      'A-10',
    ]);
  });
});

describe('COPY_WARNING_MESSAGES', () => {
  it('dá a frase em português do código estável', () => {
    expect(COPY_WARNING_MESSAGES[COPY_WARNINGS.PROBABLE_REPRINT]).toBe('provável reimpressão');
  });
});
