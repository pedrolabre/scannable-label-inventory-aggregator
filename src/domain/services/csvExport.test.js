// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { boxAt, lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';

import { buildCopiesCsv, buildSummaryCsv, csvCell, csvText, protectFormula } from './csvExport.js';
import { buildInventoryReport } from './inventoryReport.js';

/**
 * Sessao inventada com tudo o que muda a forma do arquivo: acento, nome com
 * aspas e ponto e virgula, codigo e nome que a planilha leria como formula,
 * EAN e NCM ausentes, conflito resolvido nos dois campos opcionais (um deles
 * pela variante sem o campo), aviso de reimpressao, exemplar lido em duas
 * fotos, nome de foto com ponto e virgula e um texto rejeitado, que fica fora
 * dos dois arquivos.
 */

const SESSION = { id: 'sessao-csv', name: 'Inventário de teste' };
const GENERATED_AT = '2026-10-06T19:03:00.000Z';

const COFFEE = lf1Text({
  systemCode: 'DEMO-001',
  displayName: 'CAFÉ TORRADO 500G',
  price: 2490,
  ean: '2000000000015',
  ncm: '09012100',
});
const COFFEE_C2 = lf1Text({
  systemCode: 'DEMO-001',
  displayName: 'CAFÉ TORRADO 500G',
  price: 2490,
  ean: '2000000000015',
  ncm: '09012100',
  copy: 'c2',
});
const CORNER_NAME = 'CANTINHO "RUBI"; SALA';
const CORNER_FULL = lf1Text({
  systemCode: '118789',
  displayName: CORNER_NAME,
  price: 85990,
  ean: '7899075420416',
  ncm: '94035000',
});
const CORNER_BARE = lf1Text({ systemCode: '118789', displayName: CORNER_NAME, price: 85990 });
const FORMULA = lf1Text({ systemCode: '-77', displayName: '=SOMA(1+1)', price: 0 });

const SOURCES = [
  sourceOf('f1', { fileName: 'gondola-1.jpg', processedAt: '2026-10-06T12:00:00.000Z' }),
  sourceOf('f2', { fileName: 'gondola;2.jpg', processedAt: '2026-10-06T12:01:00.000Z' }),
];

const READINGS = [
  readingOf('l1', 'f1', COFFEE, boxAt(0, 0, 100)),
  readingOf('l2', 'f1', COFFEE, boxAt(400, 0, 100)),
  readingOf('l3', 'f1', CORNER_BARE, boxAt(0, 400, 100)),
  readingOf('l4', 'f1', 'https://exemplo.test/qr', boxAt(400, 400, 100)),
  readingOf('l5', 'f2', COFFEE, boxAt(0, 0, 100)),
  readingOf('l6', 'f2', COFFEE_C2, boxAt(400, 0, 100)),
  readingOf('l7', 'f2', CORNER_FULL, boxAt(0, 400, 100)),
  readingOf('l8', 'f2', FORMULA, boxAt(400, 400, 100)),
];

const RESOLUTIONS = [
  { sessionId: SESSION.id, systemCode: '118789', choices: { ean: '7899075420416', ncm: null } },
];

function reportOf({ sources = SOURCES, readings = READINGS, resolutions = RESOLUTIONS } = {}) {
  return buildInventoryReport({
    session: SESSION,
    sources,
    readings,
    resolutions,
    generatedAt: GENERATED_AT,
  });
}

/** Formatador de teste: so marca o valor, para provar que a coluna vem dele. */
const formatCentavos = (centavos) => `R$ ${centavos}`;

const EXPECTED_SUMMARY = [
  '﻿Código;Nome;Preço (centavos);Preço;Quantidade;Total (centavos);Total;EAN;NCM;Resolvido em\r\n',
  "'-77;'=SOMA(1+1);0;R$ 0;1;0;R$ 0;;;\r\n",
  '118789;"CANTINHO ""RUBI""; SALA";85990;R$ 85990;2;171980;R$ 171980;7899075420416;;EAN, NCM\r\n',
  'DEMO-001;CAFÉ TORRADO 500G;2490;R$ 2490;2;4980;R$ 4980;2000000000015;09012100;\r\n',
].join('');

const EXPECTED_COPIES = [
  '﻿Código;Exemplar;Leituras;Fotos;Aviso;Texto LF1\r\n',
  `'-77;c1;1;"gondola;2.jpg";;${FORMULA}\r\n`,
  `118789;c1;1;"gondola;2.jpg";;"${CORNER_FULL.replaceAll('"', '""')}"\r\n`,
  `118789;c1;1;gondola-1.jpg;;"${CORNER_BARE.replaceAll('"', '""')}"\r\n`,
  `DEMO-001;c1;3;"gondola-1.jpg, gondola;2.jpg";mesmo texto em 2 posições da mesma foto: provável reimpressão (gondola-1.jpg);${COFFEE}\r\n`,
  `DEMO-001;c2;1;"gondola;2.jpg";;${COFFEE_C2}\r\n`,
].join('');

async function bytesOf(text) {
  return new Uint8Array(await new Blob([text]).arrayBuffer());
}

describe('célula do CSV', () => {
  it('protege o texto que a planilha leria como fórmula', () => {
    expect(['=1+1', '+5', '-77', '@SOMA', '\tA', '\rA'].map(protectFormula)).toEqual([
      "'=1+1",
      "'+5",
      "'-77",
      "'@SOMA",
      "'\tA",
      "'\rA",
    ]);
    expect(protectFormula('CAFÉ =1+1')).toBe('CAFÉ =1+1');
    expect(protectFormula('')).toBe('');
  });

  it('escreve ausente vazio, número como veio e aspas só quando precisa', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(-100)).toBe('-100');
    expect(csvCell('09012100')).toBe('09012100');
    expect(csvCell('A;B')).toBe('"A;B"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell('linha\nnova')).toBe('"linha\nnova"');
    expect(csvCell('=A1;B1')).toBe('"\'=A1;B1"');
    expect(csvCell('\rA')).toBe('"\'\rA"');
    expect(csvCell(' espaço ')).toBe(' espaço ');
  });

  it('monta o arquivo com a marca UTF-8, ponto e vírgula e CRLF depois de cada linha', () => {
    expect(
      csvText([
        ['a', 1],
        ['b', null],
      ]),
    ).toBe('﻿a;1\r\nb;\r\n');
    expect(csvText([])).toBe('﻿');
  });
});

describe('CSV do resumo por produto', () => {
  it('sai byte a byte como esperado', async () => {
    const text = buildSummaryCsv(reportOf(), { formatCentavos });

    expect(text).toBe(EXPECTED_SUMMARY);

    const bytes = await bytesOf(text);

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(EXPECTED_SUMMARY);
  });

  it('é o mesmo com a entrada em outra ordem', () => {
    const shuffled = reportOf({
      sources: [...SOURCES].reverse(),
      readings: [...READINGS].reverse(),
    });

    expect(buildSummaryCsv(shuffled, { formatCentavos })).toBe(EXPECTED_SUMMARY);
  });

  it('usa o formatador recebido e deixa vazio o total sem valor', () => {
    const report = reportOf();
    const huge = {
      ...report,
      products: [
        {
          ...report.products[0],
          priceInCentavos: Number.MAX_SAFE_INTEGER,
          quantity: 2,
          totalInCentavos: null,
          totalOutOfRange: true,
        },
      ],
    };

    expect(buildSummaryCsv(huge, { formatCentavos }).split('\r\n')[1]).toBe(
      `'-77;'=SOMA(1+1);${Number.MAX_SAFE_INTEGER};R$ ${Number.MAX_SAFE_INTEGER};2;;;;;`,
    );
  });

  it('sai só com o cabeçalho na sessão vazia', () => {
    const empty = reportOf({ sources: [], readings: [], resolutions: [] });

    expect(buildSummaryCsv(empty, { formatCentavos })).toBe(
      EXPECTED_SUMMARY.split('\r\n')[0] + '\r\n',
    );
  });
});

describe('CSV dos exemplares', () => {
  it('sai byte a byte como esperado, com o cN, as leituras, as fotos e o aviso', () => {
    expect(buildCopiesCsv(reportOf())).toBe(EXPECTED_COPIES);
  });

  it('é o mesmo com a entrada em outra ordem', () => {
    const shuffled = reportOf({
      sources: [...SOURCES].reverse(),
      readings: [...READINGS].reverse(),
    });

    expect(buildCopiesCsv(shuffled)).toBe(EXPECTED_COPIES);
  });

  it('escreve a foto sem nome por extenso', () => {
    const report = reportOf();
    const unnamed = {
      ...report,
      copies: [{ ...report.copies[0], sources: [{ sourceId: 'x', fileName: null }] }],
    };

    expect(buildCopiesCsv(unnamed).split('\r\n')[1]).toBe(`'-77;c1;1;foto sem nome;;${FORMULA}`);
  });
});
