/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      /**
       * Um ponto de corte so. Abaixo dele a janela mostra uma coluna por vez;
       * a partir dele, as tres lado a lado. Os outros pontos do Tailwind
       * continuam valendo para o conteudo de dentro das colunas, e nenhum
       * deles muda a forma do contorno.
       */
      screens: {
        lg: '1100px',
      },

      /**
       * Unica fonte de cor do produto. Nenhum valor literal acompanha a classe
       * no componente: quando a cor de um papel muda, ela muda aqui e em lugar
       * nenhum mais.
       *
       * O vermelho carrega dois papeis, marca e erro, e o que os separa e o
       * peso, nao o matiz: a marca preenche, o erro usa fundo tenue com borda
       * propria e texto proprio. Nenhum texto de erro cai sobre preenchimento
       * vermelho.
       *
       * Verde e amarelo sao raros por regra. Verde so aparece em confirmacao;
       * amarelo so em aviso. Fora disso os dois nao existem, e e isso que
       * impede a tela de virar semaforo conforme novos estados entrarem.
       *
       * `neutro.papel` existe para uma coisa so: separar a coluna central das
       * duas laterais brancas e alternar as faixas da listagem.
       */
      colors: {
        marca: {
          vermelho: '#C1121F',
          vermelhoEscuro: '#8E0D17',
          vermelhoTenue: '#FDECEE',
          vermelhoBorda: '#F3C2C6',
          vermelhoTexto: '#A01018',
          verde: '#1B7A3E',
          verdeTexto: '#16693A',
          verdeEscuro: '#0F4F2A',
          verdeTenue: '#E9F5EE',
          verdeBorda: '#B9DCC6',
          amarelo: '#E8B004',
          amareloTenue: '#FDF4D9',
          amareloBorda: '#EBD79A',
          amareloTexto: '#7A5A00',
          amareloTextoForte: '#6B4E00',
        },
        neutro: {
          branco: '#FFFFFF',
          papel: '#FAFAFA',
          superficie: '#EFEFEF',
          tinta: '#141414',
          tintaMedia: '#333333',
          tintaFraca: '#5E5E5E',
          divisor: '#E6E6E6',
          borda: '#DCDCDC',
          bordaForte: '#C9C9C9',
          cortina: 'rgba(0, 0, 0, 0.46)',
        },
      },

      /**
       * Canto reto em todo o produto. A chave e unica de proposito: qualquer
       * outra abriria de novo a escolha que esta linha fecha.
       */
      borderRadius: {
        DEFAULT: '0',
      },

      /**
       * Uma face de display para numero, marca e titulo curto; uma face de
       * texto para o resto. Os arquivos sao servidos pela propria aplicacao,
       * porque ela precisa desenhar igual sem rede.
       */
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },

      /**
       * Medidas que definem a densidade da tela. O valor mora em variavel de
       * CSS, e nao aqui, porque ele muda no ponto de corte: a tela larga e
       * operada com mouse e fica compacta, a estreita pode ser tocada e fica
       * com alvo de 44 px. Os valores e a troca estao em `global.css`.
       */
      spacing: {
        controle: 'var(--altura-controle)',
        topo: 'var(--altura-topo)',
        estado: 'var(--altura-estado)',
        recuo: 'var(--recuo)',
      },

      fontSize: {
        sm: ['var(--texto-corpo)', { lineHeight: 'var(--texto-corpo-linha)' }],
        rotulo: ['var(--texto-rotulo)', { lineHeight: '1.35' }],
      },

      /**
       * As tres colunas da tela larga. So a do meio e elastica: e a unica
       * regiao cujo valor cresce com o tamanho do monitor.
       */
      gridTemplateColumns: {
        janela: '240px minmax(0, 1fr) 288px',
      },

      /**
       * A unica elevacao do produto, e ela existe por necessidade: o painel do
       * dialogo precisa se descolar da tela que continua desenhada atras dele.
       */
      boxShadow: {
        modal: '0 24px 64px rgba(0, 0, 0, 0.28)',
      },
    },
  },
  plugins: [],
};
