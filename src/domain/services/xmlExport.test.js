// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { boxAt, lf1Text, readingOf, sourceOf } from '../../test-fixtures/readingFixtures.js';

import { buildInventoryReport } from './inventoryReport.js';
import { XML_FORMAT_VERSION, buildInventoryXml } from './xmlExport.js';

/**
 * Sessao inventada com tudo o que muda a forma do arquivo: acento, nome de
 * sessao, de produto e de foto com os cinco caracteres do escape, EAN e NCM
 * ausentes, conflito resolvido nos dois campos opcionais (um deles pela
 * variante sem o campo), aviso de reimpressao, exemplar lido em duas fotos,
 * duas fotos com o mesmo nome de camera, foto com falha, foto sem simbolo,
 * texto rejeitado com caractere de controle, retorno de carro e metade de par
 * substituto, recusa de campo e escolhas que deixaram de valer.
 */

const SESSION = { id: 'sessao-xml', name: 'Inventário & "loja" <centro>' };
const GENERATED_AT = '2026-10-06T20:03:48.765Z';
const OFFSET = -180;

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
const CORNER_NAME = `CANTINHO & "RUBI" <SALA> D'OESTE`;
const CORNER_FULL = lf1Text({
  systemCode: '118789',
  displayName: CORNER_NAME,
  price: 85990,
  ean: '7899075420416',
  ncm: '94035000',
});
const CORNER_BARE = lf1Text({ systemCode: '118789', displayName: CORNER_NAME, price: 85990 });
const BAD_FIELD = lf1Text({ systemCode: 'DEMO-020', displayName: 'NOME\u0007RUIM', price: 100 });
const CONTROL = 'texto\u0001com\u000Bcontrole\r\nlinha \uD800 fim';

const SOURCES = [
  sourceOf('f1', { fileName: 'gondola & "1".jpg', processedAt: '2026-10-06T12:00:00.000Z' }),
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
  readingOf('l1', 'f1', COFFEE, boxAt(0, 0, 100)),
  readingOf('l2', 'f1', COFFEE, boxAt(400, 0, 100)),
  readingOf('l3', 'f1', CORNER_BARE, boxAt(0, 400, 100)),
  readingOf('l4', 'f1', CONTROL, boxAt(400, 400, 100)),
  readingOf('l5', 'f2', COFFEE, boxAt(0, 0, 100)),
  readingOf('l6', 'f2', COFFEE_C2, boxAt(400, 0, 100)),
  readingOf('l7', 'f2', CORNER_FULL, boxAt(0, 400, 100)),
  readingOf('l8', 'f2', BAD_FIELD, boxAt(400, 400, 100)),
];

const RESOLUTIONS = [
  { sessionId: SESSION.id, systemCode: '118789', choices: { ean: '7899075420416', ncm: null } },
  { sessionId: SESSION.id, systemCode: 'DEMO-001', choices: { displayName: 'CAFÉ' } },
  { sessionId: SESSION.id, systemCode: 'DEMO-099', choices: { priceInCentavos: 100 } },
];

function reportOf({
  sources = SOURCES,
  readings = READINGS,
  resolutions = RESOLUTIONS,
  session = SESSION,
} = {}) {
  return buildInventoryReport({
    session,
    sources,
    readings,
    resolutions,
    generatedAt: GENERATED_AT,
  });
}

const EXPECTED = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<inventario versao="1" gerado-em="2026-10-06T17:03:48-03:00">',
  '  <sessao id="sessao-xml" nome="Inventário &amp; &quot;loja&quot; &lt;centro&gt;"/>',
  '  <totais fotos="4" fotos-com-falha="1" exemplares="4" produtos="2" valor-total-centavos="176960" rejeitados="2" avisos="1" conflitos-resolvidos="2" conflitos-abertos="0"/>',
  '  <produtos>',
  '    <produto codigo="118789" quantidade="2" preco-centavos="85990" total-centavos="171980">',
  '      <nome>CANTINHO &amp; &quot;RUBI&quot; &lt;SALA&gt; D&apos;OESTE</nome>',
  '      <ean>7899075420416</ean>',
  '      <resolvidos>',
  '        <resolvido campo="ean" valor="7899075420416">',
  '          <variante valor="7899075420416" exemplares="1"/>',
  '          <variante exemplares="1"/>',
  '        </resolvido>',
  '        <resolvido campo="ncm">',
  '          <variante valor="94035000" exemplares="1"/>',
  '          <variante exemplares="1"/>',
  '        </resolvido>',
  '      </resolvidos>',
  '      <exemplares>',
  '        <exemplar copia="c1" leituras="1">',
  '          <texto>LF1|118789|CANTINHO &amp; &quot;RUBI&quot; &lt;SALA&gt; D&apos;OESTE|85990|7899075420416|94035000|c1</texto>',
  '          <foto id="f2" nome="image.jpg"/>',
  '        </exemplar>',
  '        <exemplar copia="c1" leituras="1">',
  '          <texto>LF1|118789|CANTINHO &amp; &quot;RUBI&quot; &lt;SALA&gt; D&apos;OESTE|85990|||c1</texto>',
  '          <foto id="f1" nome="gondola &amp; &quot;1&quot;.jpg"/>',
  '        </exemplar>',
  '      </exemplares>',
  '    </produto>',
  '    <produto codigo="DEMO-001" quantidade="2" preco-centavos="2490" total-centavos="4980">',
  '      <nome>CAFÉ TORRADO 500G</nome>',
  '      <ean>2000000000015</ean>',
  '      <ncm>09012100</ncm>',
  '      <exemplares>',
  '        <exemplar copia="c1" leituras="3">',
  '          <texto>LF1|DEMO-001|CAFÉ TORRADO 500G|2490|2000000000015|09012100|c1</texto>',
  '          <foto id="f1" nome="gondola &amp; &quot;1&quot;.jpg"/>',
  '          <foto id="f2" nome="image.jpg"/>',
  '          <aviso tipo="probable-reprint" foto-id="f1" foto="gondola &amp; &quot;1&quot;.jpg" posicoes="2">mesmo texto em 2 posições da mesma foto: provável reimpressão</aviso>',
  '        </exemplar>',
  '        <exemplar copia="c2" leituras="1">',
  '          <texto>LF1|DEMO-001|CAFÉ TORRADO 500G|2490|2000000000015|09012100|c2</texto>',
  '          <foto id="f2" nome="image.jpg"/>',
  '        </exemplar>',
  '      </exemplares>',
  '    </produto>',
  '  </produtos>',
  '  <rejeitados>',
  '    <rejeitado foto-id="f1" foto="gondola &amp; &quot;1&quot;.jpg" motivo-codigo="not-lf1" motivo="não é LF1">',
  '      <texto>texto\uFFFDcom\uFFFDcontrole&#13;',
  'linha \uFFFD fim</texto>',
  '    </rejeitado>',
  '    <rejeitado foto-id="f2" foto="image.jpg" motivo-codigo="invalid-field" motivo="campo inválido: nome" campo="nome">',
  '      <texto>LF1|DEMO-020|NOME\uFFFDRUIM|100|||c1</texto>',
  '    </rejeitado>',
  '  </rejeitados>',
  '  <fotos>',
  '    <foto id="f1" nome="gondola &amp; &quot;1&quot;.jpg" origem="file" estado-codigo="read" estado="lida" simbolos="4" validos="3" rejeitados="1"/>',
  '    <foto id="f2" nome="image.jpg" origem="camera" estado-codigo="read" estado="lida" simbolos="4" validos="3" rejeitados="1"/>',
  '    <foto id="f3" nome="quebrada.jpg" origem="file" estado-codigo="failed" estado="com falha" falha-codigo="corrupted-file" falha="arquivo corrompido ou incompleto" simbolos="0" validos="0" rejeitados="0"/>',
  '    <foto id="f4" nome="vazia.jpg" origem="file" estado-codigo="read" estado="lida" simbolos="0" validos="0" rejeitados="0">',
  '      <aviso tipo="no-symbols">nenhum símbolo encontrado</aviso>',
  '    </foto>',
  '  </fotos>',
  '  <escolhas-ignoradas>',
  '    <escolha codigo="DEMO-001" campo="nome" valor="CAFÉ" motivo-codigo="no-conflict" motivo="os exemplares não divergem mais neste campo"/>',
  '    <escolha codigo="DEMO-099" campo="preco-centavos" valor="100" motivo-codigo="no-product" motivo="o produto não aparece mais nas leituras da sessão"/>',
  '  </escolhas-ignoradas>',
  '</inventario>',
  '',
].join('\n');

function parse(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');

  expect(document.getElementsByTagName('parsererror')).toHaveLength(0);

  return document;
}

describe('xmlExport', () => {
  it('escreve a sessão de teste byte a byte', () => {
    const xml = buildInventoryXml(reportOf(), { offsetMinutes: OFFSET });

    expect(XML_FORMAT_VERSION).toBe('1');
    expect(xml).toBe(EXPECTED);
    expect([...new TextEncoder().encode(xml).slice(0, 5)]).toEqual([0x3c, 0x3f, 0x78, 0x6d, 0x6c]);
    expect(xml).not.toContain('\r');
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });

  it('dá a mesma saída com a entrada em outra ordem', () => {
    const reversed = reportOf({
      sources: [...SOURCES].reverse(),
      readings: [...READINGS].reverse(),
      resolutions: [...RESOLUTIONS].reverse(),
    });

    expect(buildInventoryXml(reversed, { offsetMinutes: OFFSET })).toBe(EXPECTED);
  });

  it('é lido de volta por um leitor de XML com os mesmos valores', () => {
    const document = parse(buildInventoryXml(reportOf(), { offsetMinutes: OFFSET }));
    const root = document.documentElement;
    const corner = document.querySelector('produto[codigo="118789"]');
    const rejected = document.querySelectorAll('rejeitado');

    expect(root.nodeName).toBe('inventario');
    expect(root.getAttribute('versao')).toBe('1');
    expect(root.getAttribute('gerado-em')).toBe('2026-10-06T17:03:48-03:00');
    expect(document.querySelector('sessao').getAttribute('nome')).toBe(SESSION.name);
    expect(corner.querySelector('nome').textContent).toBe(CORNER_NAME);
    expect(corner.getAttribute('total-centavos')).toBe('171980');
    expect(corner.querySelector('ncm')).toBeNull();
    expect(corner.querySelector('resolvido[campo="ncm"]').hasAttribute('valor')).toBe(false);
    expect([...corner.querySelectorAll('exemplar texto')].map((node) => node.textContent)).toEqual([
      CORNER_FULL,
      CORNER_BARE,
    ]);
    expect(document.querySelector('produto[codigo="DEMO-001"] foto').getAttribute('nome')).toBe(
      'gondola & "1".jpg',
    );
    expect(rejected[0].querySelector('texto').textContent).toBe(
      'texto\uFFFDcom\uFFFDcontrole\r\nlinha \uFFFD fim',
    );
    expect(rejected[1].getAttribute('campo')).toBe('nome');
    expect(rejected[1].querySelector('texto').textContent).toBe(
      'LF1|DEMO-020|NOME\uFFFDRUIM|100|||c1',
    );
    expect(document.querySelector('foto[id="f3"]').getAttribute('falha-codigo')).toBe(
      'corrupted-file',
    );
    expect(
      [...document.querySelectorAll('escolha')].map((node) => node.getAttribute('motivo-codigo')),
    ).toEqual(['no-conflict', 'no-product']);
  });

  it('marca o valor total e o total do produto que passam do limite de cálculo', () => {
    const huge = lf1Text({
      systemCode: 'X-1',
      displayName: 'CARO',
      price: Number.MAX_SAFE_INTEGER,
    });
    const hugeC2 = lf1Text({
      systemCode: 'X-1',
      displayName: 'CARO',
      price: Number.MAX_SAFE_INTEGER,
      copy: 'c2',
    });
    const xml = buildInventoryXml(
      reportOf({
        sources: [sourceOf('f1')],
        readings: [readingOf('l1', 'f1', huge), readingOf('l2', 'f1', hugeC2)],
        resolutions: [],
      }),
      { offsetMinutes: 0 },
    );
    const document = parse(xml);
    const totals = document.querySelector('totais');
    const product = document.querySelector('produto');

    expect(totals.hasAttribute('valor-total-centavos')).toBe(false);
    expect(totals.getAttribute('valor-total-motivo-codigo')).toBe('out-of-range');
    expect(totals.getAttribute('valor-total-motivo')).toBe('o valor passa do limite de cálculo');
    expect(product.hasAttribute('total-centavos')).toBe(false);
    expect(product.getAttribute('total-motivo-codigo')).toBe('out-of-range');
    expect(product.getAttribute('preco-centavos')).toBe(String(Number.MAX_SAFE_INTEGER));
    expect(document.documentElement.getAttribute('gerado-em')).toBe('2026-10-06T20:03:48+00:00');
  });

  it('escreve a sessão só com fotos com as seções vazias', () => {
    const xml = buildInventoryXml(
      reportOf({
        sources: [sourceOf('f1', { fileName: 'vazia.jpg' })],
        readings: [],
        resolutions: [],
      }),
      { offsetMinutes: OFFSET },
    );

    expect(xml).toContain('  <produtos/>\n  <rejeitados/>\n  <fotos>\n');
    expect(xml).toContain('  <escolhas-ignoradas/>\n</inventario>\n');
    expect(xml).toContain('exemplares="0" produtos="0" valor-total-centavos="0"');
    parse(xml);
  });

  it('recusa o relatório com conflito aberto', () => {
    const report = reportOf({ resolutions: [] });

    expect(report.exportable).toBe(false);
    expect(() => buildInventoryXml(report, { offsetMinutes: OFFSET })).toThrow(
      'Relatório com conflito aberto não é exportado',
    );
  });
});
