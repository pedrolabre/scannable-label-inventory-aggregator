// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import SessionSourceRow from './SessionSourceRow.jsx';

const view = useReactRoot();

const CORNERS = {
  topLeft: { x: 1, y: 1 },
  topRight: { x: 9, y: 1 },
  bottomRight: { x: 9, y: 9 },
  bottomLeft: { x: 1, y: 9 },
};

const READ_SOURCE = {
  id: 'fonte-1',
  sessionId: 'sessao-1',
  fileName: 'gondola-3.jpg',
  status: 'read',
  width: 4032,
  height: 3024,
};

function reading(id, text, sourceId = 'fonte-1', position = CORNERS) {
  return {
    id,
    sessionId: 'sessao-1',
    sourceId,
    text,
    position,
    readAt: '2026-10-02T12:00:00.000Z',
  };
}

async function renderRow(source, readings = [], props = {}) {
  await view.render(
    <ul>
      <SessionSourceRow
        source={source}
        readings={readings}
        canRemove
        onRemove={vi.fn()}
        {...props}
      />
    </ul>,
  );

  return view.container.querySelector('li');
}

describe('SessionSourceRow', () => {
  it('lista os textos válidos e os rejeitados com o motivo, com tamanho e contagem da foto gravada', async () => {
    const row = await renderRow(READ_SOURCE, [
      reading('l1', 'LF1|DEMO-005|MAÇÃ FUJI KG|1099|||c1'),
      reading('l2', 'LF2|DEMO-004|X|1|||c1'),
      reading('l3', 'LF1|DEMO-001||1899|||c1', 'fonte-1', null),
      reading('l9', 'LF1|OUTRA|FOTO|1|||c1', 'fonte-2'),
    ]);
    const lists = [...row.querySelectorAll('ul')];

    expect(row.textContent).toContain('gondola-3.jpg');
    expect(row.textContent).toContain('lida');
    expect(row.textContent).toContain('4032 × 3024 px (12,2 MP)');
    expect(row.textContent).toContain('3 símbolos: 1 válido, 2 rejeitados; 2 com posição');
    expect([...lists[0].children].map((li) => li.textContent)).toEqual([
      'LF1|DEMO-005|MAÇÃ FUJI KG|1099|||c1',
    ]);
    expect([...lists[1].children].map((li) => li.textContent)).toEqual([
      'LF2|DEMO-004|X|1|||c1 — versão não suportada',
      'LF1|DEMO-001||1899|||c1 — campo inválido: nome',
    ]);
  });

  it('avisa a foto gravada sem nenhum símbolo', async () => {
    const row = await renderRow(READ_SOURCE, []);

    expect(row.textContent).toContain('nenhum símbolo encontrado');
    expect(row.textContent).toContain('0 símbolos');
    expect(row.querySelectorAll('ul')).toHaveLength(0);
  });

  it('mostra a foto que o navegador não abriu, com o motivo e sem tamanho', async () => {
    const row = await renderRow({
      id: 'fonte-2',
      sessionId: 'sessao-1',
      fileName: 'foto.heic',
      status: 'failed',
      failureReason: 'unsupported-format',
    });

    expect(row.textContent).toContain('falhou');
    expect(row.textContent).toContain('formato de imagem não suportado');
    expect(row.textContent).not.toContain('símbolo');
  });

  it('exibe texto com marcação como texto, sem criar elemento', async () => {
    const markup = '<img src=x onerror="alert(1)"><b>LF1</b>';
    const row = await renderRow({ ...READ_SOURCE, fileName: '<i>foto</i>' }, [
      reading('l1', markup),
      reading('l2', ''),
    ]);

    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('b')).toBeNull();
    expect(row.querySelector('i')).toBeNull();
    expect(row.textContent).toContain(`${markup} — não é LF1`);
    expect(row.textContent).toContain('(texto vazio) — não é LF1');
  });

  it('tem o remover nomeado pela foto, com o tom de perigo, desligado quando pedido', async () => {
    const onRemove = vi.fn();
    let row = await renderRow(READ_SOURCE, [], { onRemove });
    let remove = row.querySelector('[data-remover]');

    expect(remove.getAttribute('aria-label')).toBe('Remover gondola-3.jpg');
    expect(remove.className).toContain('text-marca-vermelhoTexto');
    expect(remove.className).toContain('h-controle');

    await view.click(remove);

    expect(onRemove).toHaveBeenCalledTimes(1);

    row = await renderRow(READ_SOURCE, [], { onRemove, canRemove: false });
    remove = row.querySelector('[data-remover]');

    expect(remove.disabled).toBe(true);
  });
});
