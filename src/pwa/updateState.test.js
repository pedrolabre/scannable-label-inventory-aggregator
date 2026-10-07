// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  announceUpdate,
  applyPendingUpdate,
  getUpdateSnapshot,
  resetUpdateState,
  subscribeToUpdate,
} from './updateState.js';

afterEach(() => {
  resetUpdateState();
});

describe('versão nova esperando', () => {
  it('começa sem versão nova', () => {
    expect(getUpdateSnapshot()).toBe(false);
  });

  it('fica esperando depois do anúncio, sem aplicar nada sozinha', () => {
    const apply = vi.fn();

    announceUpdate(apply);

    expect(getUpdateSnapshot()).toBe(true);
    expect(apply).not.toHaveBeenCalled();
  });

  it('recusa anúncio sem a ação que aplica a versão', () => {
    expect(() => announceUpdate(null)).toThrow(TypeError);
    expect(getUpdateSnapshot()).toBe(false);
  });
});

describe('assinantes', () => {
  it('são avisados no anúncio e na aplicação', () => {
    const listener = vi.fn();

    subscribeToUpdate(listener);
    announceUpdate(() => {});
    applyPendingUpdate();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('deixam de ser avisados depois de cancelar a assinatura', () => {
    const listener = vi.fn();

    subscribeToUpdate(listener)();
    announceUpdate(() => {});

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('aplicação', () => {
  it('chama a ação uma vez e deixa de haver versão esperando', () => {
    const apply = vi.fn();

    announceUpdate(apply);

    expect(applyPendingUpdate()).toBe(true);
    expect(applyPendingUpdate()).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(getUpdateSnapshot()).toBe(false);
  });

  it('devolve false quando não há versão esperando', () => {
    expect(applyPendingUpdate()).toBe(false);
  });

  it('usa a ação do anúncio mais recente', () => {
    const older = vi.fn();
    const newer = vi.fn();

    announceUpdate(older);
    announceUpdate(newer);
    applyPendingUpdate();

    expect(older).not.toHaveBeenCalled();
    expect(newer).toHaveBeenCalledTimes(1);
  });
});
