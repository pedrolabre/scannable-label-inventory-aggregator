// @vitest-environment node

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ENGINE_WASM_PATH,
  ENGINE_WASM_SHA256,
  READ_OPTIONS,
  locateEngineFile,
} from './decoderEngine.js';
import { sha256Hex } from './sha256.js';

const SERVED_WASM = new URL('../../public/zxing/zxing_reader.wasm', import.meta.url);

describe('decoderEngine', () => {
  it('serve o binário pela própria aplicação', () => {
    expect(ENGINE_WASM_PATH).toBe('/zxing/zxing_reader.wasm');
    expect(locateEngineFile('zxing_reader.wasm', '/prefixo/')).toBe(ENGINE_WASM_PATH);
    expect(locateEngineFile('outro.data', '/base/')).toBe('/base/outro.data');
  });

  it('tem em public/zxing a cópia exata do binário da versão instalada', async () => {
    const served = new Uint8Array(readFileSync(SERVED_WASM));

    expect(ENGINE_WASM_SHA256).toMatch(/^[0-9a-f]{64}$/);
    await expect(sha256Hex(served)).resolves.toBe(ENGINE_WASM_SHA256);
  });

  it('lê só QR Code, com todos os símbolos da imagem', () => {
    expect(READ_OPTIONS.formats).toEqual(['QRCode']);
    expect(READ_OPTIONS.maxNumberOfSymbols).toBe(255);
    expect(Object.isFrozen(READ_OPTIONS)).toBe(true);
  });
});
