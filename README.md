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
- Zod 3 na validação dos campos lidos de cada etiqueta e de todo registro gravado no banco local.
- Dexie 4 sobre o IndexedDB, com as sessões, as fotos processadas, as leituras e as resoluções de conflito.
- Zustand 5 no estado das sessões.
- zxing-wasm 3 na leitura dos QR Codes, carregado só na primeira foto, com o binário `zxing_reader.wasm` servido pela própria aplicação, em `public/zxing/`.
- bwip-js nas imagens de teste com QR Codes `LF1`, geradas por `npm run fixtures:qr`.
- Vitest com jsdom, e fake-indexeddb nos testes do banco local.

## Comandos

```bash
npm install      # instala as dependências
npm run dev      # servidor de desenvolvimento
npm test         # suíte de testes
npm run build    # build de produção em dist/
npm run preview  # serve o build local
npm run fixtures:qr  # gera as imagens de teste com QR Codes LF1
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
    zxing/            zxing_reader.wasm, o binário do leitor de QR Code
  scripts/
    generate-qr-fixtures.mjs    gera as imagens de teste com QR Codes LF1
  src/
    main.jsx
    App.jsx
    App.test.jsx
    domain/
      schemas/
        commonFields.js           campos reutilizáveis dos schemas
        lf1FieldsSchema.js        regras de cada campo LF1
        lf1FieldsSchema.test.js
        sessionSchema.js          sessão de inventário e nome padrão
        sessionSchema.test.js
        sourceSchema.js           metadados da foto processada
        sourceSchema.test.js
        readingSchema.js          texto lido e posição do símbolo
        readingSchema.test.js
        resolutionSchema.js       escolha do operador num conflito
        resolutionSchema.test.js
      services/
        lf1Contract.js            leitura do texto LF1 e motivo da recusa
        lf1Contract.test.js
    storage/
      indexed-db.js               banco StockVisionDB, tabelas e índices
      indexed-db.test.js
      sessionRepository.js        sessões e remoção em cascata
      sessionRepository.test.js
      sourceRepository.js         fotos da sessão, sem os bytes da imagem
      sourceRepository.test.js
      readingRepository.js        leituras de cada foto
      readingRepository.test.js
      resolutionRepository.js     resoluções de conflito por produto
      resolutionRepository.test.js
      storageError.js             mensagens das falhas do armazenamento
      storageError.test.js
    store/
      useSessionStore.js          sessões e conteúdo da sessão aberta
      useSessionStore.test.js
    lib/
      app-meta.js                 nome do produto
      cx.js                       junção de classes
      decoderEngine.js            leitor de QR Code, carregado sob demanda
      decoderEngine.test.js
      decoder.js                  texto e posição de cada símbolo da imagem
      decoder.test.js
      decoderError.js             mensagens das falhas da leitura da foto
      decoderError.test.js
      imageLoader.js              pixels da foto, na orientação da câmera
      imageLoader.test.js
      sha256.js                   SHA-256 dos bytes do arquivo
      sha256.test.js
    test-fixtures/
      qrFixtures.js               textos das imagens de teste
      readPngFixture.js           leitura dos PNGs de teste na suíte
      qr-1.png, qr-4.png, qr-8.png
    styles/
      global.css      faces de fonte e variáveis de densidade
```
