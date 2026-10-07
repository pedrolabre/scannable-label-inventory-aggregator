// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useReactRoot } from '../../test-fixtures/reactRoot.js';

import ModalShell from './ModalShell.jsx';

const view = useReactRoot();

function dialog() {
  return view.container.querySelector('[role="dialog"]');
}

function closeButton() {
  return view.container.querySelector('[aria-label="Fechar"]');
}

/**
 * O dialogo aberto por um gatilho que existe de verdade. Sem ele nao ha como
 * provar a devolucao do foco: o elemento que abriu o dialogo precisa continuar
 * na tela depois que ele fecha.
 */
function WithDialog({ closeOnBackdrop = true, footer = null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Sessões
      </button>

      {open ? (
        <ModalShell
          title="Sessões"
          subtitle="Guardadas neste aparelho."
          closeOnBackdrop={closeOnBackdrop}
          onClose={() => setOpen(false)}
          footer={footer}
        >
          <button type="button">Abrir</button>
          <button type="button">Apagar</button>
        </ModalShell>
      ) : null}
    </>
  );
}

// O gatilho recebe foco antes do clique porque e assim que ele chega no uso
// real. Um `click()` de programa nao move o foco, e sem isso o dialogo
// guardaria o corpo da pagina como elemento a quem devolver o foco.
async function open(props = {}) {
  await view.render(<WithDialog {...props} />);

  const trigger = view.container.querySelector('button');

  await view.focus(trigger);
  await view.click(trigger);

  return trigger;
}

function panelButtons() {
  return [...dialog().querySelectorAll('button')];
}

describe('ModalShell', () => {
  it('se declara como diálogo modal nomeado pelo próprio título', async () => {
    await open();

    const title = dialog().querySelector('h2');

    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(dialog().getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.textContent).toBe('Sessões');
    expect(dialog().className).toContain('shadow-modal');
  });

  it('põe o foco no botão de fechar, com realce visível', async () => {
    await open();

    expect(document.activeElement).toBe(closeButton());
    expect(closeButton().className).toContain('focus-visible:outline-2');
  });

  it('prende o foco: Tab no último volta ao primeiro, Shift+Tab no primeiro vai ao último', async () => {
    await open();

    const buttons = panelButtons();
    const last = buttons[buttons.length - 1];

    await view.focus(last);
    const tab = await view.press('Tab');

    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);

    const shiftTab = await view.press('Tab', { shiftKey: true });

    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('deixa o Tab andar entre os controles do meio', async () => {
    await open();

    const tab = await view.press('Tab');

    expect(tab.defaultPrevented).toBe(false);
  });

  it('traz de volta ao painel o foco que estava fora dele', async () => {
    await open();

    const trigger = view.container.querySelector('button');

    await view.focus(trigger);
    await view.press('Tab');

    expect(document.activeElement).toBe(panelButtons()[0]);
  });

  it('fecha com Esc e devolve o foco ao gatilho', async () => {
    const trigger = await open();

    await view.press('Escape');

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('fecha pelo botão de fechar', async () => {
    await open();
    await view.click(closeButton());

    expect(dialog()).toBeNull();
  });

  it('fecha no clique que nasce na cortina e ignora o que nasce no painel', async () => {
    await open();

    await view.update(() => {
      dialog().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(dialog()).not.toBeNull();

    await view.update(() => {
      dialog().parentElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(dialog()).toBeNull();
  });

  it('ignora o clique na cortina quando closeOnBackdrop é false', async () => {
    await open({ closeOnBackdrop: false });

    await view.update(() => {
      dialog().parentElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(dialog()).not.toBeNull();
  });

  it('deixa o Esc parado por um controle de dentro sem fechar', async () => {
    const onClose = vi.fn();

    await view.render(
      <ModalShell title="Sessões" onClose={onClose}>
        <input aria-label="Nome" onKeyDown={(event) => event.stopPropagation()} />
      </ModalShell>,
    );
    await view.focus(view.container.querySelector('input'));
    await view.press('Escape');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('para antes da borda da janela, deixa o corpo rolar e desenha o rodapé só com ações', async () => {
    await open();

    const body = dialog().children[1];

    expect(dialog().className).toContain('max-h-[calc(100dvh-96px)]');
    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).toContain('min-h-0');
    expect(dialog().querySelector('[data-dialogo-acoes]')).toBeNull();

    await view.press('Escape');
    await open({ footer: <button type="button">Nova sessão</button> });

    expect(dialog().querySelector('[data-dialogo-acoes]')).not.toBeNull();
    expect(dialog().querySelector('header, footer')).toBeNull();
  });

  /**
   * O `jsdom` nao aplica media query. O que se prova e a regra das classes:
   * abaixo do ponto de corte o painel ocupa a janela menos 16 px de cada lado,
   * por cima da medida pedida; a confirmacao curta fica do tamanho do texto.
   */
  it('ocupa a janela menos a margem na tela estreita, salvo a confirmação curta', async () => {
    await view.render(
      <ModalShell title="Sessões" width={640} onClose={vi.fn()}>
        conteúdo
      </ModalShell>,
    );

    expect(dialog().style.width).toBe('640px');
    expect(dialog().className).toContain('max-lg:!w-[calc(100dvw-32px)]');
    expect(dialog().className).toContain('max-lg:!h-[calc(100dvh-32px)]');

    await view.render(
      <ModalShell title="Remover foto" width={480} compact onClose={vi.fn()}>
        conteúdo
      </ModalShell>,
    );

    expect(dialog().className).not.toContain('max-lg:');
  });
});
