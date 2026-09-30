// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import StatusBar from './StatusBar.jsx';

const view = useReactRoot();

function item(name) {
  return view.container.querySelector(`[data-status="${name}"]`);
}

function valueOf(name) {
  return item(name).querySelector('dd').textContent;
}

function labelOf(name) {
  return item(name).querySelector('dt').textContent;
}

const TOTALS = {
  copyCount: 13,
  productCount: 4,
  totalValueInCentavos: 123456,
  totalValueIssue: null,
  openConflictCount: 2,
};

describe('StatusBar', () => {
  it('mostra fotos, exemplares, produtos, valor total em reais e conflitos abertos', async () => {
    await view.render(<StatusBar sourceCount={3} totals={TOTALS} />);

    const footer = view.container.querySelector('footer');

    expect(footer.getAttribute('aria-label')).toBe('Resumo da sessão');
    expect(footer.className).toContain('h-estado');
    expect(valueOf('fotos')).toBe('3');
    expect(labelOf('fotos')).toBe('fotos');
    expect(valueOf('exemplares')).toBe('13');
    expect(valueOf('produtos')).toBe('4');
    expect(valueOf('valor')).toBe('R$ 1.234,56');
    expect(labelOf('valor')).toBe('valor total');
    expect(valueOf('conflitos')).toBe('2');
    expect(labelOf('conflitos')).toBe('conflitos abertos');
  });

  it('usa o singular quando a contagem é um', async () => {
    await view.render(
      <StatusBar
        sourceCount={1}
        totals={{ ...TOTALS, copyCount: 1, productCount: 1, openConflictCount: 1 }}
      />,
    );

    expect(labelOf('fotos')).toBe('foto');
    expect(labelOf('exemplares')).toBe('exemplar');
    expect(labelOf('produtos')).toBe('produto');
    expect(labelOf('conflitos')).toBe('conflito aberto');
  });

  it('encurta só a vista do rótulo de conflitos na tela estreita', async () => {
    await view.render(<StatusBar sourceCount={0} totals={TOTALS} />);

    const suffix = item('conflitos').querySelector('dt span');

    expect(suffix.textContent).toBe(' abertos');
    expect(suffix.className).toBe('max-lg:sr-only');
  });

  it('mostra zero sem sessão aberta', async () => {
    await view.render(<StatusBar />);

    expect(['fotos', 'exemplares', 'produtos', 'conflitos'].map(valueOf)).toEqual([
      '0',
      '0',
      '0',
      '0',
    ]);
    expect(valueOf('valor')).toBe('R$ 0,00');
  });

  it('tira o número do valor total quando o relatório não o fecha, com o motivo lido', async () => {
    const issue = { code: 'open-price-conflict', message: 'há produto com preço em conflito aberto' };

    await view.render(
      <StatusBar
        sourceCount={2}
        totals={{ ...TOTALS, totalValueInCentavos: null, totalValueIssue: issue }}
      />,
    );

    expect(valueOf('valor')).toBe('—');
    expect(labelOf('valor')).toBe('valor total, indisponível: há produto com preço em conflito aberto');
    expect(item('valor').querySelector('.sr-only').textContent).toContain(issue.message);
    expect(item('valor').title).toBe(
      'Valor total indisponível: há produto com preço em conflito aberto',
    );
  });

  it('só informa: nenhum controle na faixa', async () => {
    await view.render(<StatusBar sourceCount={3} totals={TOTALS} />);

    expect(view.container.querySelectorAll('button, a, input')).toHaveLength(0);
  });
});
