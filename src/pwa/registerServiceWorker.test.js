// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';

import { registrations, resetPwaRegister, updateRequests } from '../test-fixtures/pwaRegister.js';

import { registerServiceWorker } from './registerServiceWorker.js';
import { applyPendingUpdate, getUpdateSnapshot, resetUpdateState } from './updateState.js';

/**
 * O modulo gerado pelo plugin e trocado pelo registro falso no
 * `vitest.config.js`; o que se confere aqui e o que o registro recebe e o que
 * acontece quando ele anuncia a versao nova.
 */

afterEach(() => {
  resetPwaRegister();
  resetUpdateState();
});

describe('registro do service worker', () => {
  it('registra uma vez, logo na carga', () => {
    registerServiceWorker();

    expect(registrations).toHaveLength(1);
    expect(registrations[0].immediate).toBe(true);
  });

  it('não tem ação para o pronto para uso sem rede', () => {
    registerServiceWorker();

    expect(registrations[0].onOfflineReady).toBeUndefined();
  });

  it('transforma a versão nova em aviso, sem pedir a troca', () => {
    registerServiceWorker();
    registrations[0].onNeedRefresh();

    expect(getUpdateSnapshot()).toBe(true);
    expect(updateRequests).toEqual([]);
  });

  it('pede a troca com recarga só quando o aviso é aplicado', () => {
    registerServiceWorker();
    registrations[0].onNeedRefresh();
    applyPendingUpdate();

    expect(updateRequests).toEqual([true]);
  });
});
