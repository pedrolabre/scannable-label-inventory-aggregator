/**
 * Medicao de cada foto da fila: quanto tempo cada passo levou e quanta memoria
 * a pagina usava ao fim. Serve para comparar aparelhos e enquadramentos com o
 * mesmo codigo que roda na loja, sem ferramenta de desenvolvimento aberta.
 *
 * Tudo fica na memoria da pagina, junto da foto na fila; nada e gravado.
 */

/** Passo do processamento e a funcao que o executa. */
export const TIMED_STEPS = Object.freeze({
  hash: 'hash',
  lookup: 'findDuplicate',
  load: 'loadImage',
  decode: 'decode',
  save: 'save',
});

/** Relogio de alta resolucao, em milissegundos. */
export function measureNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Memoria em uso pelo JavaScript da pagina, em bytes, quando o navegador a
 * informa (so os baseados no Chromium). `null` nos outros.
 */
export function readUsedHeapBytes(performance = globalThis.performance) {
  const used = performance?.memory?.usedJSHeapSize;

  return Number.isFinite(used) ? used : null;
}

/**
 * Envolve as funcoes do processamento para medir cada passo. Devolve as
 * funcoes envolvidas e o objeto `timings`, preenchido com o tempo de cada passo
 * que chegou a rodar, inclusive o que falhou.
 */
export function timeProcessingDeps(deps, now = measureNow) {
  const timings = {};
  const timed = { ...deps };

  for (const [step, name] of Object.entries(TIMED_STEPS)) {
    const run = deps[name];

    if (typeof run !== 'function') {
      continue;
    }

    timed[name] = async (...args) => {
      const startedAt = now();

      try {
        return await run(...args);
      } finally {
        timings[step] = now() - startedAt;
      }
    };
  }

  return { deps: timed, timings };
}
