# StockVision

SPA client-side que lê QR Codes de etiquetas no formato `LF1` a partir de fotos, conta os exemplares e gera o relatório de inventário. Tudo roda no navegador: sem servidor, sem conta, sem rede depois da primeira visita.

## Status

Em desenvolvimento inicial.

## Funcionamento

- Entrada por foto da câmera ou por envio de várias imagens de uma vez.
- Vários QR Codes decodificados por foto, no próprio aparelho.
- Cada exemplar é identificado pelo texto inteiro do símbolo: o mesmo texto lido em mais de uma foto conta uma vez.
- Resumo por produto com quantidade e total, e lista de exemplares com as fotos de origem.
- Divergência de nome, preço, EAN ou NCM no mesmo código é resolvida na tela antes da exportação.
- Símbolos fora do formato ficam numa lista de rejeitados, com o motivo.
- Exportação em CSV, XML e PDF.
- Sessões de inventário guardadas no IndexedDB. As fotos não são guardadas.
- PWA instalável e utilizável offline.

## Formato `LF1`

Texto posicional, campos separados por barra vertical, ordem fixa:

| Posição | Campo | Regra |
| --- | --- | --- |
| 0 | versão | `LF1` |
| 1 | código do sistema | obrigatório, letras, números e hífen |
| 2 | nome | obrigatório, até 60 caracteres |
| 3 | preço em centavos | obrigatório, inteiro |
| 4 | código de barras | opcional, 8, 12, 13 ou 14 dígitos |
| 5 | NCM | opcional, 8 dígitos |
| 6 | exemplar | `c1`, `c2`, ... |

```text
LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1
LF1|118789|CANTINHO CAFE RUBI|85990|||c1
```

- Campo opcional ausente mantém a posição, vazio.
- Não há escape: barra vertical e quebra de linha não ocorrem dentro de campo.
- Texto com acento é lido pela declaração de UTF-8 do próprio QR Code.
- Texto com número de posições diferente de 7, versão diferente de `LF1` ou campo fora da regra é rejeitado.

## Stack

- React 19 e Vite 6, em JavaScript.
- Tailwind CSS 3, com as cores, o canto reto e a densidade da tela definidos em `tailwind.config.js` e `src/styles/global.css`.
- IBM Plex Sans e Space Grotesk servidas pela própria aplicação, em `public/fonts/`.
- Vitest com jsdom.

## Comandos

```bash
npm install      # instala as dependências
npm run dev      # servidor de desenvolvimento
npm test         # suíte de testes
npm run build    # build de produção em dist/
npm run preview  # serve o build local
```

## Estrutura do Projeto

```text
scannable-label-inventory-aggregator/
  index.html
  package.json
  package-lock.json
  postcss.config.js
  tailwind.config.js
  vite.config.js
  vitest.config.js
  README.md
  public/
    fonts/            IBM Plex Sans e Space Grotesk, latin e latin-ext
  src/
    main.jsx
    App.jsx
    App.test.jsx
    lib/
      app-meta.js     nome do produto
      cx.js           junção de classes
    styles/
      global.css      faces de fonte e variáveis de densidade
```
