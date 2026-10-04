// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { downloadBlob } from './download.js';

/**
 * O documento e a fabrica de enderecos entram falsos: o que se prova e a
 * sequencia (criar o endereco, clicar, tirar a ancora e liberar o endereco), e
 * nao a capacidade do navegador de salvar arquivo.
 */
function fakes() {
  const anchor = { click: vi.fn(), remove: vi.fn() };
  const appended = [];

  const documentRef = {
    createElement: vi.fn(() => anchor),
    body: { appendChild: vi.fn((node) => appended.push(node)) },
  };

  const urlRef = {
    createObjectURL: vi.fn(() => 'blob:inventario'),
    revokeObjectURL: vi.fn(),
  };

  return { anchor, appended, documentRef, urlRef };
}

describe('disparo do download', () => {
  it('clica numa âncora com o nome do arquivo e depois a remove', () => {
    const { anchor, appended, documentRef, urlRef } = fakes();
    const blob = { size: 10 };

    downloadBlob(blob, 'inventario-2026-10-06-1603.csv', { documentRef, urlRef });

    expect(urlRef.createObjectURL).toHaveBeenCalledWith(blob);
    expect(documentRef.createElement).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('blob:inventario');
    expect(anchor.download).toBe('inventario-2026-10-06-1603.csv');
    expect(anchor.rel).toBe('noopener');
    expect(appended).toEqual([anchor]);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
  });

  it('libera o endereço temporário depois do clique', () => {
    const { anchor, documentRef, urlRef } = fakes();

    downloadBlob({ size: 10 }, 'inventario.csv', { documentRef, urlRef });

    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:inventario');
    expect(urlRef.revokeObjectURL.mock.invocationCallOrder[0]).toBeGreaterThan(
      anchor.click.mock.invocationCallOrder[0],
    );
  });

  it('libera o endereço mesmo quando o clique falha', () => {
    const { anchor, documentRef, urlRef } = fakes();

    anchor.click.mockImplementation(() => {
      throw new Error('clique recusado');
    });

    expect(() => downloadBlob({ size: 10 }, 'inventario.csv', { documentRef, urlRef })).toThrow(
      'clique recusado',
    );
    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:inventario');
  });
});
