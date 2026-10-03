// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import IgnoredChoiceNote from './IgnoredChoiceNote.jsx';

const view = useReactRoot();

const CHOICE = {
  systemCode: 'A-1',
  field: 'displayName',
  value: '<i>CAFÉ</i>',
  reason: 'no-conflict',
  message: 'os exemplares não divergem mais neste campo',
};

describe('IgnoredChoiceNote', () => {
  it('diz o valor gravado e o motivo, com o campo quando pedido, em amarelo', async () => {
    await view.render(<IgnoredChoiceNote choice={CHOICE} withTitle />);

    const note = view.container.querySelector('[data-escolha-ignorada]');

    expect(note.dataset.escolhaIgnorada).toBe('no-conflict');
    expect(note.textContent).toBe(
      'Nome: A escolha gravada (<i>CAFÉ</i>) foi ignorada: os exemplares não divergem mais neste campo.',
    );
    expect(note.querySelector('i')).toBeNull();
    expect(note.className).toContain('border-marca-amareloTexto');
    expect(note.querySelector('button')).toBeNull();
  });

  it('descarta pelo botão nomeado pelo campo, ocupado sem perder o foco', async () => {
    const onDiscard = vi.fn();

    await view.render(<IgnoredChoiceNote choice={CHOICE} onDiscard={onDiscard} isBusy />);

    const button = view.container.querySelector('[data-descartar]');

    expect(button.textContent).toBe('Descartar escolha');
    expect(button.getAttribute('aria-label')).toBe('Descartar escolha do nome');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.disabled).toBe(false);

    await view.click(button);

    expect(onDiscard).toHaveBeenCalledTimes(1);

    await view.render(<IgnoredChoiceNote choice={CHOICE} onDiscard={onDiscard} isDisabled />);

    expect(view.container.querySelector('[data-descartar]').disabled).toBe(true);
  });
});
