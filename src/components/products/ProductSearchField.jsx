import { useRef } from 'react';
import { Search, X } from 'lucide-react';

import Field, { TextInput } from '../ui/Field.jsx';
import IconButton from '../ui/IconButton.jsx';

export const SEARCH_FIELD_ID = 'busca-produto';

/**
 * Campo de busca do resumo por produto. A contagem do resultado ocupa a area
 * de apoio do rotulo, ao lado do titulo do campo, e entra na descricao do
 * campo para quem usa leitor de tela.
 *
 * O botao de limpar fica ao lado do campo, e nao dentro dele, para ter o lado
 * do controle da tela: 44 px onde ela pode ser tocada. Ele so existe enquanto
 * ha texto; depois de limpar, o foco volta ao campo. `Esc` dentro do campo
 * tambem limpa.
 */
export default function ProductSearchField({ value, onChange, hint }) {
  const inputRef = useRef(null);

  function clear() {
    onChange('');
    inputRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && value !== '') {
      event.preventDefault();
      event.stopPropagation();
      onChange('');
    }
  }

  return (
    <Field id={SEARCH_FIELD_ID} label="Buscar produto" hint={hint}>
      {(control) => (
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutro-tintaFraca"
              aria-hidden="true"
            />
            <TextInput
              {...control}
              ref={inputRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Código, nome ou código de barras"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="pl-9"
            />
          </div>

          {value !== '' ? (
            <IconButton label="Limpar busca" onClick={clear}>
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
      )}
    </Field>
  );
}
