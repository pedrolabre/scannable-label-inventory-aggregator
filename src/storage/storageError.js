/**
 * Traducao das falhas do armazenamento local para um texto que diga ao usuario
 * o que aconteceu e o que fazer.
 *
 * Tres familias de erro chegam ate aqui pelo mesmo `await`: a recusa do schema,
 * quando o registro nao passa na validacao; a recusa de uma regra do proprio
 * armazenamento, como a mesma foto duas vezes na sessao; e a recusa do
 * IndexedDB, que o Dexie repassa mantendo o nome que o navegador deu. Nenhuma
 * pode ser exibida como esta: a do schema e uma lista de problemas, e a do
 * banco vem em ingles.
 *
 * O nome do erro e o unico dado estavel entre navegadores; o texto que o
 * acompanha varia. E por ele que a mensagem e escolhida.
 */

export const STORAGE_RULE_ERRORS = Object.freeze({
  DUPLICATE_SOURCE: 'DuplicateSourceError',
  MISSING_SESSION: 'MissingSessionError',
  MISSING_SOURCE: 'MissingSourceError',
});

const WRITE_FAILURE_MESSAGE =
  'Não foi possível gravar no armazenamento deste dispositivo. Tente de novo.';

const READ_FAILURE_MESSAGE =
  'O armazenamento deste dispositivo não respondeu à leitura. Recarregue a página e tente de novo.';

const MESSAGE_BY_ERROR_NAME = new Map([
  [
    STORAGE_RULE_ERRORS.DUPLICATE_SOURCE,
    'Esta foto já foi lida nesta sessão. Escolha outra foto ou abra outra sessão.',
  ],
  [
    STORAGE_RULE_ERRORS.MISSING_SESSION,
    'A sessão não existe mais neste dispositivo. Escolha outra sessão e tente de novo.',
  ],
  [
    STORAGE_RULE_ERRORS.MISSING_SOURCE,
    'A foto não existe mais nesta sessão. Envie a foto de novo.',
  ],
  [
    'QuotaExceededError',
    'O armazenamento deste dispositivo está cheio. Libere espaço no navegador e tente de novo.',
  ],
  [
    'DatabaseClosedError',
    'A conexão com o armazenamento deste dispositivo foi interrompida. Recarregue a página e tente de novo.',
  ],
  [
    'VersionError',
    'O armazenamento deste dispositivo foi aberto por outra versão da aplicação. Feche as outras abas do StockVision e recarregue a página.',
  ],
  [
    'InvalidStateError',
    'Este navegador está bloqueando o armazenamento local. Verifique as permissões do site e tente de novo.',
  ],
  [
    'MissingAPIError',
    'Este navegador não oferece armazenamento local. Abra o StockVision fora da janela anônima ou em outro navegador.',
  ],
  ['ConstraintError', 'Este registro já está gravado neste dispositivo.'],
  ['AbortError', 'A gravação foi interrompida antes de terminar. Tente de novo.'],
]);

/** Erro de regra do armazenamento, com o nome que escolhe a mensagem. */
export function createStorageRuleError(name) {
  const error = new Error(MESSAGE_BY_ERROR_NAME.get(name) ?? WRITE_FAILURE_MESSAGE);

  error.name = name;

  return error;
}

/** `true` quando o erro, ou o erro do navegador dentro dele, tem este nome. */
export function hasErrorName(error, name) {
  return error?.name === name || error?.inner?.name === name;
}

function validationMessage(error) {
  const first = error.issues?.[0]?.message;

  return first
    ? `O registro não foi gravado: ${first}. Corrija e tente de novo.`
    : 'O registro não passou na validação e não foi gravado. Corrija e tente de novo.';
}

// O Dexie embrulha o erro original do navegador e guarda o de dentro em
// `inner`, entao os dois niveis sao consultados antes de cair no texto geral.
function lookupMessage(error) {
  if (!error) {
    return null;
  }

  if (error.name === 'ZodError') {
    return validationMessage(error);
  }

  return (
    MESSAGE_BY_ERROR_NAME.get(error.name) ?? MESSAGE_BY_ERROR_NAME.get(error.inner?.name) ?? null
  );
}

/**
 * Mensagem para uma gravacao que falhou. A gravacao roda numa transacao, e o
 * banco continua como estava antes da tentativa, entao o texto aponta para uma
 * nova tentativa em vez de avisar sobre perda de dados.
 */
export function describeStorageError(error) {
  return lookupMessage(error) ?? WRITE_FAILURE_MESSAGE;
}

/**
 * Mensagem para uma leitura que falhou. Sem ela a tela mostraria uma sessao
 * vazia, indistinguivel de uma sessao que ainda nao tem nenhuma foto.
 */
export function describeStorageReadError(error) {
  return lookupMessage(error) ?? READ_FAILURE_MESSAGE;
}
