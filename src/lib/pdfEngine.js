/**
 * Unico ponto do projeto que nomeia a biblioteca de PDF.
 *
 * Este modulo e carregado sob demanda por `pdf.js`, entao o empacotador o
 * separa num arquivo proprio: o codigo da biblioteca so desce na primeira
 * exportacao em PDF, e a abertura da pagina nao paga por ele. Trocar a
 * biblioteca um dia mexe so aqui e no adaptador, que conhece o documento pelo
 * nome `PdfDocument`.
 */

import { jsPDF } from 'jspdf';

export { jsPDF as PdfDocument };
