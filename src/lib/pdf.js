/**
 * Adaptador entre a descricao do documento e a biblioteca de PDF.
 *
 * Aqui e o unico lugar em que a descricao vira chamada de biblioteca. A
 * descricao ja traz tudo decidido: paginas A4 em milimetro, cada texto com o
 * ponto de partida, a linha de base, o corpo, o peso e o cinza, cada traco com
 * as pontas, a espessura e o cinza. O adaptador abre o documento em
 * milimetro, a mesma unidade, e so desenha; nao mede, nao corta e nao pagina.
 *
 * O texto sai na helvetica que a biblioteca ja traz, sem arquivo de fonte e
 * sem rede. A descricao so entrega caracteres que essa fonte escreve.
 *
 * O motor e carregado na primeira chamada, pelo `import()` abaixo, que o
 * empacotador separa num arquivo proprio. Uma carga que falhou e esquecida, e a
 * proxima tenta de novo.
 *
 * A saida e deterministica: a data de criacao vem da descricao, o
 * identificador do arquivo sai do proprio conteudo e nada aqui le o relogio. A
 * mesma descricao da o mesmo arquivo byte a byte.
 *
 * A geracao cede o laco de eventos entre uma pagina e outra, para a tela
 * continuar respondendo num relatorio de muitas paginas.
 */

import { APP_NAME } from './app-meta.js';

const FONT = 'helvetica';

let enginePromise = null;

/** Carrega o motor uma vez para a pagina inteira. */
export function loadPdfEngine() {
  if (enginePromise === null) {
    enginePromise = import('./pdfEngine.js').catch((cause) => {
      enginePromise = null;

      throw cause;
    });
  }

  return enginePromise;
}

function yieldToEventLoop() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Identificador do arquivo derivado do conteudo, por espalhamento simples em
 * quatro passagens. Nao e resumo criptografico e nao precisa ser: conteudos
 * iguais dao o mesmo identificador, e conteudos diferentes, outro.
 */
export function buildFileId(text) {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];

  return seeds
    .map((seed) => {
      let hash = seed;

      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }

      return hash.toString(16).padStart(8, '0');
    })
    .join('')
    .toUpperCase();
}

function drawPage(doc, page) {
  for (const op of page.ops) {
    if (op.type === 'line') {
      doc.setDrawColor(op.gray);
      doc.setLineWidth(op.lineWidthMm);
      doc.line(op.x1Mm, op.y1Mm, op.x2Mm, op.y2Mm);
      continue;
    }

    doc.setFont(FONT, op.bold ? 'bold' : 'normal');
    doc.setFontSize(op.fontSizePt);
    doc.setTextColor(op.gray);
    doc.text(op.text, op.xMm, op.yMm);
  }
}

/**
 * Bytes do PDF da descricao (`describeReportDocument`). `onPage` recebe a
 * pagina concluida e o total.
 */
export async function renderReportDocument(description, { onPage } = {}) {
  const { PdfDocument } = await loadPdfEngine();
  const [first] = description.pages;

  if (!first) {
    throw new TypeError('Documento sem página');
  }

  const doc = new PdfDocument({
    unit: 'mm',
    format: [first.widthMm, first.heightMm],
    orientation: 'portrait',
    compress: true,
    putOnlyUsedFonts: true,
  });

  doc.setCreationDate(description.creationDate);
  doc.setFileId(buildFileId(JSON.stringify(description)));
  doc.setDocumentProperties({
    title: description.title,
    subject: description.subject,
    creator: APP_NAME,
  });

  for (let index = 0; index < description.pages.length; index += 1) {
    const page = description.pages[index];

    if (index > 0) {
      doc.addPage([page.widthMm, page.heightMm], 'portrait');
    }

    drawPage(doc, page);
    onPage?.(index + 1, description.pages.length);

    if (index + 1 < description.pages.length) {
      await yieldToEventLoop();
    }
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
