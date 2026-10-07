# StockVision

SPA client-side que lê QR Codes de etiquetas no formato `LF1` a partir de fotos, conta os exemplares e gera o relatório de inventário. Tudo roda no navegador, sem servidor e sem conta. Depois da primeira visita a aplicação funciona sem rede; com rede, o navegador só confere, a cada abertura, se há versão nova no próprio endereço.

## Status

MVP funcional.

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
- Exportação pelo botão `Exportar` do topo, num diálogo, com os arquivos gerados no próprio aparelho: o CSV do resumo por produto, o CSV dos exemplares, o XML do relatório completo e o PDF para leitura, cada um no próprio botão, com o nome `inventario-AAAA-MM-DD-HHMM.<ext>` na data e hora locais da geração (o dos exemplares com `-exemplares` no fim).
- O CSV abre em planilha em português: marca UTF-8, colunas separadas por ponto e vírgula, cabeçalho em português, valores em centavos inteiros e numa coluna em reais, e o texto que a planilha leria como fórmula precedido de apóstrofo. A mesma sessão gera o mesmo arquivo, byte a byte.
- O XML (`versao="1"`) leva, além do que está no CSV, a sessão, os totais, a hora da geração com o fuso do aparelho (`2026-10-06T17:03:48-03:00`), os conflitos resolvidos com o valor escolhido e as variantes, os textos rejeitados inteiros com o motivo, as fotos com o estado e o motivo da falha, e as escolhas gravadas que deixaram de valer. Exemplares aninhados no produto, valores só em centavos inteiros, cada motivo com o código e a frase, valor ausente fora do arquivo, fotos pelo identificador ao lado do nome. Todo texto é escapado, e o caractere que o XML 1.0 não aceita vira `U+FFFD`. A mesma sessão gera o mesmo arquivo, byte a byte.
- O PDF sai em páginas A4 retrato, com a helvetica do próprio leitor de PDF, sem fonte externa: o nome da sessão, a data e a hora da geração com o fuso (`06/10/2026 às 17:03:48 (UTC-03:00)`), os totais, o resumo por produto, os conflitos resolvidos com o valor escolhido e as variantes, os exemplares, os textos rejeitados com o motivo, as fotos com o estado e o motivo da falha, e as escolhas gravadas que deixaram de valer. Valores em reais (`R$ 1.234,56`), valor ausente como travessão com o motivo escrito abaixo da tabela, nome e texto LF1 cortados com reticências na largura da coluna, cabeçalho das tabelas repetido em cada página e rodapé com o nome da sessão e `Página N de M`. Caractere que a fonte não escreve (emoji, ideograma, caractere de controle) sai como `?`, e uma nota no fim diz quantos foram trocados. O motor de PDF entra na página só na primeira exportação em PDF (o arquivo já está no aparelho desde a primeira visita, para o uso sem rede), a tela continua respondendo enquanto as páginas são geradas, e a mesma sessão gera o mesmo arquivo, byte a byte.
- Com conflito aberto a exportação fica bloqueada, com a contagem à vista e o atalho para o primeiro produto em conflito; sessão sem produto gera só o XML e o PDF, e sessão sem foto não gera arquivo; escolha gravada de produto que saiu da sessão aparece como aviso no diálogo.
- Sessões de inventário guardadas no IndexedDB, abertas, criadas, renomeadas e apagadas num diálogo, com o nome padrão de data e hora. Ao recarregar, volta a última sessão aberta no aparelho. As fotos não são guardadas.
- Fotos da sessão listadas com os textos lidos; remover uma foto tira também os textos dela, e os totais se refazem na hora.
- Instalável como aplicativo: no Chrome do computador e do Android, pelo ícone de instalação da barra de endereço ou pelo menu; no iPhone, por `Adicionar à Tela de Início`. Abre em janela própria, com o nome e o ícone do StockVision.
- Funciona sem rede depois da primeira visita: a primeira abertura guarda no aparelho a aplicação inteira, com o leitor de QR Code, o motor de PDF, as fontes e os ícones. Sem rede, a página abre, uma foto nova é lida e o CSV, o XML e o PDF são gerados. Com rede, a cada abertura o navegador confere se há versão nova no próprio endereço.
- Uso completo pelo teclado: atalho `Pular para o conteúdo` no começo da página, contorno visível em todo controle, uma parada de `Tab` na tabela de produtos e em cada campo em conflito, com as setas entre as linhas e entre as variantes, `Home` e `End` nas pontas e `Enter` ou `Espaço` para escolher; diálogos com o foco preso, `Esc` fechando e o foco de volta ao botão que os abriu.
- No celular, uma coluna por vez, escolhida pela barra de vistas do topo, com alvos de toque de 44 px; a partir de 1100 px de largura, as três colunas lado a lado numa janela sem rolagem de página.
- Versão nova aparece numa faixa abaixo do topo, com o botão `Atualizar`; a página nunca recarrega sozinha. Enquanto houver foto da fila ainda não gravada, o botão espera e a faixa diz quantas faltam; foto com erro na fila sai da lista ao atualizar, e a faixa avisa antes.

## O que o StockVision não faz

- Não lê pela câmera ao vivo: a câmera entra pela foto tirada no aparelho, que segue o mesmo caminho das imagens enviadas.
- Não lê código de barras linear nem outro símbolo além de QR Code; QR Code fora do formato `LF1` aparece entre os rejeitados, com o motivo, e não entra na contagem.
- Não lê texto impresso, lote, validade nem a aparência do produto: só o conteúdo do QR Code conta.
- Não consulta cadastro de produtos, não lê dados do ERP e não edita produto: os dados vêm só do símbolo.
- Não guarda as fotos: ficam o nome, o tamanho, a data, o SHA-256, as dimensões e o que foi lido em cada uma.
- Não tem servidor, conta, login, sincronização entre aparelhos nem uso por várias pessoas: as sessões ficam no navegador do aparelho.
- Não se integra a ERP nem a loja virtual: a saída é o arquivo exportado em CSV, XML ou PDF.
- Não exporta em DOCX nem em XLSX: o CSV abre direto em planilha.
- Não cria nem imprime etiquetas.
- Não trata a foto antes da leitura, como correção de perspectiva ou limiarização: a imagem vai como está para o leitor de QR Code.
- Não copia nem restaura o banco local: o arquivo exportado é o registro durável do inventário.

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
- vite-plugin-pwa 1.3.0 (versão fixa) no service worker, no pré-cache e no manifesto, gerados no build; o registro fica com o código-fonte e a troca de versão espera o operador.
- jsPDF 4.2.1 (versão fixa) no PDF exportado, carregado só na primeira exportação em PDF, com os módulos de captura de tela e de conversão de SVG fora do build.
- zxing-wasm 3 na leitura dos QR Codes, carregado só na primeira foto, com o binário `zxing_reader.wasm` servido pela própria aplicação, em `public/zxing/`.
- bwip-js nas imagens de teste com QR Codes `LF1`, geradas por `npm run fixtures:qr`.
- Ícones da aplicação instalada desenhados por `npm run icons`, com as cores do `tailwind.config.js`, sem biblioteca de imagem.
- Vitest com jsdom, e fake-indexeddb nos testes do banco local.

## Comandos

```bash
npm ci           # instala as dependências na versão do package-lock.json
npm run dev      # servidor de desenvolvimento
npm test         # suíte de testes
npm run build    # build de produção em dist/
npm run preview  # serve o build local
npm run fixtures:qr  # gera as imagens de teste com QR Codes LF1
npm run icons        # desenha os ícones da aplicação instalada em public/icons/
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
    icons/            icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png e apple-touch-icon-180.png
    zxing/            zxing_reader.wasm, o binário do leitor de QR Code
  scripts/
    generate-qr-fixtures.mjs    gera as imagens de teste com QR Codes LF1
    generate-icons.mjs          desenha os ícones da aplicação instalada
  src/
    main.jsx
    App.jsx
    App.test.jsx
    AppProducts.test.jsx          coluna Produtos dentro da tela inteira
    AppDetail.test.jsx            coluna Detalhe e diálogo de rejeitados dentro da tela inteira, com o banco real
    AppExport.test.jsx            exportação dentro da tela inteira, com o banco real e o download interceptado
    components/
      AppShell.jsx                contorno de janela única: três colunas na tela larga, uma por vez na estreita, e a faixa do aviso abaixo do topo
      AppShell.test.jsx
      AppHeader.jsx               nome do produto, botão Exportar e barra de vistas da tela estreita
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
        ProductSummaryTable.jsx   tabela do resumo por produto, a partir de 640 px, com as setas entre as linhas
        ProductSummaryTable.test.jsx
        ProductRow.jsx            linha do produto, com o nome que seleciona
        ProductCards.jsx          cartões do resumo por produto, abaixo de 640 px, com as setas entre os cartões
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
        ConflictField.jsx         variantes de um campo com os exemplares de cada uma, com as setas entre elas
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
      pwa/
        UpdateNotice.jsx          faixa da versão nova, com o Atualizar que espera a fila
        UpdateNotice.test.jsx
      export/
        ExportDialog.jsx          diálogo de exportação: bloqueio, avisos e as seções CSV, XML e PDF, com o andamento do PDF
        ExportDialog.test.jsx
        FileRow.jsx               linha de arquivo do diálogo, com o botão de baixar
        FileRow.test.jsx
        useReportExport.js        sequência da exportação, uma por vez, com o instante no nome do arquivo e o fuso no XML e no PDF
        useReportExport.test.jsx
        useReportExport.engine.test.jsx  falha na carga do motor de PDF
        exportText.js             frases do bloqueio, do aviso e da confirmação
        exportText.test.js
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
        useRovingFocus.js         uma parada de Tab por lista, com as setas, Home e End entre os itens
        useRovingFocus.test.jsx
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
        csvExport.js              resumo por produto e exemplares em CSV para planilha em português
        csvExport.test.js
        xmlExport.js              relatório inteiro em XML, com a versão da estrutura
        xmlExport.test.js
        xmlWriter.js              escrita do XML: declaração, indentação, escape e caracteres fora do XML 1.0
        xmlWriter.test.js
        exportFileName.js         nome do arquivo exportado com a data e a hora locais
        exportFileName.test.js
        exportTimestamp.js        hora da geração com o deslocamento do fuso
        exportTimestamp.test.js
        reportDocument.js         relatório em páginas A4 para o PDF, com as seções, os valores em reais e a data de criação
        reportDocument.test.js
        reportDocument.pages.test.js
        reportColumns.js          colunas das tabelas do PDF, em milímetro
        reportColumns.test.js
        reportLayout.js           paginação: cursor, títulos, tabelas com o cabeçalho repetido e rodapé
        reportLayout.test.js
        reportText.js             caracteres e larguras da helvetica, corte com reticências e quebra em linhas
        reportText.test.js
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
      download.js                 download do arquivo gerado na página
      download.test.js
      pdfEngine.js                biblioteca de PDF, carregada sob demanda
      pdf.js                      escrita do PDF a partir da descrição das páginas, cedendo a tela entre elas
      pdf.test.js
    pwa/
      manifest.js                 nome, descrição, cores e ícones da aplicação instalada, lidos pelo build
      manifest.test.js
      documentMeta.test.js        título, descrição, ícones e metas do index.html
      icons.test.js               ícones publicados iguais ao desenho do script
      registerServiceWorker.js    registro do service worker e anúncio da versão nova
      registerServiceWorker.test.js
      updateState.js              versão nova esperando o operador, fora do React
      updateState.test.js
    test-fixtures/
      qrFixtures.js               textos das imagens de teste
      readPngFixture.js           leitura dos PNGs de teste na suíte
      reactRoot.js                montagem dos componentes na suíte
      readingFixtures.js          leituras, fontes e linhas de produto sintéticas para os testes
      pdfBytes.js                 leitura dos bytes do PDF gerado, só para os testes
      pwaRegister.js              registro falso do service worker, só para os testes
      qr-1.png, qr-4.png, qr-8.png
    styles/
      global.css      faces de fonte e variáveis de densidade
```
