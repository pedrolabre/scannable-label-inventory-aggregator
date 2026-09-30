// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { useSessionStore } from '../store/useSessionStore.js';
import { lf1Text, readingOf, sourceOf } from '../test-fixtures/readingFixtures.js';
import { useReactRoot } from '../test-fixtures/reactRoot.js';

import useInventoryReport from './useInventoryReport.js';

const initialSession = useSessionStore.getState();
const view = useReactRoot({
  cleanup: () => useSessionStore.setState(initialSession, true),
});

const GENERATED_AT = '2026-10-02T13:00:00.000Z';
const SESSION = { id: 'sessao-teste', name: 'Inventário 02/10/2026' };

const reports = [];

function Probe({ generatedAt = GENERATED_AT }) {
  reports.push(useInventoryReport(generatedAt));

  return null;
}

function latest() {
  return reports.at(-1);
}

function text(code, price, copy) {
  return lf1Text({ systemCode: code, displayName: `PRODUTO ${code}`, price, copy });
}

describe('useInventoryReport', () => {
  it('devolve null sem sessão aberta', async () => {
    reports.length = 0;

    await view.render(<Probe />);

    expect(latest()).toBeNull();
  });

  it('monta o relatório da sessão aberta com o instante recebido', async () => {
    useSessionStore.setState({
      sessions: [SESSION],
      currentSessionId: SESSION.id,
      sources: [sourceOf('f1')],
      readings: [
        readingOf('l1', 'f1', text('A-1', 1000, 'c1')),
        readingOf('l2', 'f1', text('A-1', 1000, 'c2')),
        readingOf('l3', 'f1', text('B-2', 250, 'c1')),
      ],
      resolutions: [],
    });
    reports.length = 0;

    await view.render(<Probe />);

    expect(latest().header).toMatchObject({
      sessionId: SESSION.id,
      sessionName: SESSION.name,
      generatedAt: GENERATED_AT,
      sourceCount: 1,
    });
    expect(latest().totals).toMatchObject({
      copyCount: 3,
      productCount: 2,
      totalValueInCentavos: 2250,
      openConflictCount: 0,
    });
  });

  it('refaz a conta só quando o conteúdo da sessão muda', async () => {
    useSessionStore.setState({
      sessions: [SESSION],
      currentSessionId: SESSION.id,
      sources: [sourceOf('f1')],
      readings: [readingOf('l1', 'f1', text('A-1', 1000, 'c1'))],
      resolutions: [],
    });
    reports.length = 0;

    await view.render(<Probe />);
    await view.render(<Probe />);

    expect(reports).toHaveLength(2);
    expect(reports[1]).toBe(reports[0]);

    await view.update(() => {
      useSessionStore.setState({
        readings: [
          readingOf('l1', 'f1', text('A-1', 1000, 'c1')),
          readingOf('l2', 'f1', text('A-1', 1200, 'c2')),
        ],
      });
    });

    expect(latest()).not.toBe(reports[0]);
    expect(latest().totals.openConflictCount).toBe(1);
    expect(latest().totals.totalValueInCentavos).toBeNull();
    expect(latest().header.generatedAt).toBe(GENERATED_AT);
  });
});
