# StockVision

SPA client-side que lê QR Codes de etiquetas no formato `LF1` a partir de fotos, conta os exemplares e gera o relatório de inventário. Tudo roda no navegador: sem servidor, sem conta, sem rede depois da primeira visita.

## Status

Em desenvolvimento inicial.

## Funcionamento

- Entrada por foto da câmera ou por envio de várias imagens de uma vez.
- Vários QR Codes decodificados por foto, no próprio aparelho.
- Cada exemplar é identificado pelo texto inteiro do símbolo: o mesmo texto lido em mais de uma foto conta uma vez.
- Resumo por produto com código, nome, preço, quantidade e total, com a marca de conflito aberto, de conflito resolvido e de aviso de reimpressão, e lista de exemplares com as fotos de origem.
- Busca no resumo por código, nome ou código de barras, sem diferença de maiúsculas e acentos (`CAFE` encontra `Café`), com a contagem do resultado.
- Produto escolhido na tabela aparece na coluna Detalhe, com quantidade, preço, total, EAN e NCM; no celular, a escolha abre a vista Detalhe.
- Exemplares do produto no Detalhe com o número de leituras, as fotos de origem, o aviso de reimpressão e o texto lido.
- Divergência de nome, preço, EAN ou NCM no mesmo código é resolvida no Detalhe, campo a campo, antes da exportação: cada variante mostra quantos exemplares a carregam e quais, a escolha fica gravada na sessão e pode ser desfeita, e a quantidade não muda.
- Escolha gravada que deixou de valer aparece no Detalhe com o motivo; a do campo que deixou de divergir pode ser descartada.
- Textos fora do formato e fotos que não abrem ficam num diálogo aberto pela coluna Entrada, com a foto e o motivo; o texto rejeitado aparece cortado em 120 caracteres.
- Exportação em CSV, XML e PDF.
- Sessões de inventário guardadas no IndexedDB, abertas, criadas, renomeadas e apagadas num diálogo, com o nome padrão de data e hora. Ao recarregar, volta a última sessão aberta no aparelho. As fotos não são guardadas.
- Fotos da sessão listadas com os textos lidos; remover uma foto tira também os textos dela, e os totais se refazem na hora.
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
- lucide-react nos ícones da interface, importados um a um.
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
    AppProducts.test.jsx          coluna Produtos dentro da tela inteira
    AppDetail.test.jsx            coluna Detalhe e diálogo de rejeitados dentro da tela inteira, com o banco real
    components/
      AppShell.jsx                contorno de janela única: três colunas na tela larga, uma por vez na estreita
      AppShell.test.jsx
      AppHeader.jsx               nome do produto e barra de vistas da tela estreita
      AppHeader.test.jsx
      useInventoryReport.js       relatório da sessão aberta, derivado do store
      useInventoryReport.test.jsx
      layout/
        ShellColumn.jsx           coluna com título ou faixa própria e corpo que rola
        ShellColumn.test.jsx
        StatusBar.jsx             fotos, exemplares, produtos, valor total e conflitos abertos
        StatusBar.test.jsx
      capture/
        CaptureColumn.jsx         coluna Entrada: sessão, fotos, lote, rejeitados e falhas e fotos da sessão
        CaptureColumn.test.jsx
        CaptureButtons.jsx        Fotografar, Enviar fotos e orientação de enquadramento
        CaptureButtons.test.jsx
        SourceQueue.jsx           andamento, erro atual e fotos do lote ainda fora da sessão
        SourceQueue.test.jsx
        SourceRow.jsx             situação e frase de cada foto do lote
        SourceRow.test.jsx
        SessionSources.jsx        fotos gravadas na sessão aberta e remoção com confirmação
        SessionSources.test.jsx
        SessionSourceRow.jsx      situação, tamanho e textos lidos de cada foto gravada
        SessionSourceRow.test.jsx
        sourceDisplay.jsx         etiqueta de situação, contagens e lista de textos das fotos, com o rejeitado cortado
        MeasurementDetails.jsx    tempo de cada foto e cópia da medição, recolhidos
        MeasurementDetails.test.jsx
        useImageIntake.js         entrega das fotos escolhidas à fila
        useImageIntake.test.jsx
        captureText.js            contagens, tempos e medição em colunas
        captureText.test.js
      products/
        ProductsColumn.jsx        coluna Produtos: busca, contagem e resumo por produto
        ProductsColumn.test.jsx
        ProductSearchField.jsx    campo de busca com a contagem e o limpar
        ProductSearchField.test.jsx
        ProductSummaryTable.jsx   tabela do resumo por produto, a partir de 640 px
        ProductSummaryTable.test.jsx
        ProductRow.jsx            linha do produto, com o nome que seleciona
        ProductCards.jsx          cartões do resumo por produto, abaixo de 640 px
        ProductCards.test.jsx
        productDisplay.jsx        nome, valores em R$, valor ausente com o motivo e etiquetas
        productDisplay.test.jsx
      detail/
        DetailColumn.jsx          coluna Detalhe: dados, conflitos e exemplares do produto escolhido
        DetailColumn.test.jsx
        ProductFacts.jsx          quantidade, preço, total, EAN e NCM do produto
        ProductFacts.test.jsx
        ConflictResolver.jsx      conflitos do produto, escolha, desfazer e descarte, uma gravação por vez
        ConflictResolver.test.jsx
        ConflictField.jsx         variantes de um campo com os exemplares de cada uma
        ConflictField.test.jsx
        IgnoredChoiceNote.jsx     escolha gravada que deixou de valer, com o motivo
        IgnoredChoiceNote.test.jsx
        CopyList.jsx              exemplares com leituras, fotos, aviso e texto lido
        CopyList.test.jsx
        SourceRefs.jsx            fotos de origem de um exemplar
        SourceRefs.test.jsx
        WarningList.jsx           avisos de reimpressão de um exemplar
        WarningList.test.jsx
        RejectedDialog.jsx        textos rejeitados e fotos com falha, com o motivo
        RejectedDialog.test.jsx
        productDetail.js          recorte do relatório para o produto escolhido
        productDetail.test.js
        detailText.js             textos da coluna e do diálogo
        detailText.test.js
      sessions/
        SessionPicker.jsx         sessão aberta e botão Sessões no topo da Entrada
        SessionPicker.test.jsx
        SessionDialog.jsx         abrir, criar, renomear e apagar sessões, com a confirmação
        SessionDialog.test.jsx
        SessionRow.jsx            linha da sessão, com o renomear na própria linha
        SessionRow.test.jsx
        sessionText.js            data da alteração, conferência e contador do nome
        sessionText.test.js
      ui/
        Button.jsx                botão nas variantes principal, apoio e perigo
        Button.test.jsx
        IconButton.jsx            botão só com ícone, nomeado pelo rótulo
        IconButton.test.jsx
        ModalShell.jsx            diálogo com foco preso, Esc e foco devolvido ao gatilho
        ModalShell.test.jsx
        ConfirmModal.jsx          pergunta antes de remover dados
        ConfirmModal.test.jsx
        Field.jsx                 rótulo, campo de texto, dica e erro
        Field.test.jsx
        InlineAlert.jsx           aviso de erro junto da ação
        InlineAlert.test.jsx
        SegmentedControl.jsx      escolha única entre poucas opções, com as setas
        SegmentedControl.test.jsx
        focusClasses.js           realce de foco compartilhado
    domain/
      schemas/
        commonFields.js           campos reutilizáveis dos schemas
        lf1FieldsSchema.js        regras de cada campo LF1
        lf1FieldsSchema.test.js
        sessionSchema.js          sessão de inventário e nome padrão com data e hora
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
        sourceProcessing.js       processamento de uma foto, do arquivo à fonte gravada
        sourceProcessing.test.js
        sourceReadings.js         textos de uma foto separados em válidos e rejeitados
        sourceReadings.test.js
        copyIdentity.js           exemplares pelo texto inteiro, com leituras, fotos e aviso de reimpressão
        copyIdentity.test.js
        boxOverlap.js             sobreposição das caixas de dois símbolos da mesma foto
        boxOverlap.test.js
        inventoryAggregation.js   resumo por produto com quantidade e total em centavos
        inventoryAggregation.test.js
        conflictDetection.js      variantes de nome, preço, EAN e NCM por produto, com os exemplares de cada uma
        conflictDetection.test.js
        conflictResolution.js     escolhas do operador aplicadas ao resumo e contagem dos conflitos
        conflictResolution.test.js
        inventoryReport.js        relatório da sessão: cabeçalho, totais, conflitos e indicador de exportação
        inventoryReport.test.js
        inventoryReport.cases.test.js
        reportSections.js         linhas das seções do relatório e corte do texto rejeitado
        reportSections.test.js
        productSearch.js          busca no resumo sem diferença de maiúsculas e acentos
        productSearch.test.js
    storage/
      indexed-db.js               banco StockVisionDB, tabelas e índices
      indexed-db.test.js
      sessionRepository.js        sessões e remoção em cascata
      sessionRepository.test.js
      sourceRepository.js         fotos da sessão, sem os bytes da imagem, e remoção com as leituras
      sourceRepository.test.js
      readingRepository.js        leituras de cada foto
      readingRepository.test.js
      resolutionRepository.js     resoluções de conflito por produto
      resolutionRepository.test.js
      lastSessionStorage.js       última sessão aberta no aparelho, no localStorage
      lastSessionStorage.test.js
      storageError.js             mensagens das falhas do armazenamento
      storageError.test.js
    store/
      useSessionStore.js          sessões, conteúdo da sessão aberta, remoção de foto e escolhas nos conflitos
      useSessionStore.test.js
      useSessionStore.resolution.test.js
      useSessionStore.source.test.js
      sourceRemoval.js            foto e leituras dela retiradas do conteúdo em memória
      sourceRemoval.test.js
      sessionIntegration.test.js  sessões e remoção de foto com o banco real
      resolutionChoices.js        conferência, soma e retirada das escolhas do operador
      resolutionChoices.test.js
      resolutionIntegration.test.js  escolha gravada e relida com o banco real
      useCaptureStore.js          fila das fotos, uma por vez, e erro atual
      useCaptureStore.test.js
      captureItem.js              situação, frases e andamento de cada foto da fila
      captureItem.test.js
      captureTiming.js            tempo de cada passo e memória por foto
      captureTiming.test.js
      useCaptureStore.timing.test.js
      captureIntegration.test.js  fila com o banco e o leitor reais
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
      currency.js                 valor em centavos escrito como R$ 1.234,56
      currency.test.js
    test-fixtures/
      qrFixtures.js               textos das imagens de teste
      readPngFixture.js           leitura dos PNGs de teste na suíte
      reactRoot.js                montagem dos componentes na suíte
      readingFixtures.js          leituras, fontes e linhas de produto sintéticas para os testes
      qr-1.png, qr-4.png, qr-8.png
    styles/
      global.css      faces de fonte e variáveis de densidade
```
