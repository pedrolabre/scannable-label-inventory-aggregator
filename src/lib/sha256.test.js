// @vitest-environment node

import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFixtureBytes } from '../test-fixtures/readPngFixture.js';

import { sha256Hex } from './sha256.js';

const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sha256Hex', () => {
  it('confere os vetores conhecidos do texto vazio e de abc', async () => {
    const encoder = new TextEncoder();

    await expect(sha256Hex(new Uint8Array(0))).resolves.toBe(EMPTY);
    await expect(sha256Hex(encoder.encode('abc'))).resolves.toBe(ABC);
  });

  it('aceita Blob, File e ArrayBuffer com o mesmo resultado', async () => {
    const bytes = new TextEncoder().encode('abc');

    await expect(sha256Hex(new Blob([bytes]))).resolves.toBe(ABC);
    await expect(sha256Hex(new File([bytes], 'foto.jpg'))).resolves.toBe(ABC);
    await expect(sha256Hex(bytes.buffer)).resolves.toBe(ABC);
  });

  it('resume os bytes de uma imagem de teste em 64 hexadecimais minúsculos', async () => {
    const bytes = readFixtureBytes('qr-4.png');
    const digest = await sha256Hex(new Blob([bytes], { type: 'image/png' }));

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(createHash('sha256').update(bytes).digest('hex'));
  });

  it('recusa entrada que não tem bytes', async () => {
    await expect(sha256Hex('abc')).rejects.toBeInstanceOf(TypeError);
    await expect(sha256Hex(null)).rejects.toBeInstanceOf(TypeError);
  });

  it('explica o que fazer quando a página não é segura', async () => {
    vi.stubGlobal('crypto', {});

    await expect(sha256Hex(new Uint8Array(0))).rejects.toThrow(/https/);
  });
});
