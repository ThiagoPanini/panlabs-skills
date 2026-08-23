# A camada visual

Tema, fundo, fluxo, e a cópia que sai de casa.

## O tema é um vocabulário FECHADO

O contrato é [`../tema/esquema.json`](../tema/esquema.json), e cada token carrega
a medição que o justifica. Leia o arquivo.

O que importa saber antes de abrir: **a camada normativa da AWS é indizível**.
Não existe token que nomeie cor de grupo, cor de categoria, traço de grupo ou
tamanho de ícone. Não é regra de runtime — é **ausência de palavra**, o mesmo
movimento da fronteira de coordenadas: regra que depende de disciplina se perde
na terceira sessão; ausência de palavra, não.

> **A régua para abrir uma palavra nova:** só quando o token comprovadamente não
> consegue inventar canal de significado novo.

Quatro temas, todos versionados em [`../tema/`](../tema/):

| `--tema` | |
|---|---|
| `claro` | o default |
| `escuro` | não é invenção da casa — a AWS publica **dois** decks |
| `corporativo` | sóbrio, e ainda em branco puro (ver abaixo) |
| `armadilha` | dizível e **errado** de propósito: existe para o portão de contraste ter corpo de prova |

## A margem estética da casa NÃO está no fundo

Isto é régua, não gosto, e é a pergunta que mais aparece.

A paleta AWS é calibrada para **branco puro**: `#ED7100` alcança só 3:1 contra
`#FFFFFF`, e **não há faixa no meio** — a partir de um off-white qualquer a paleta
já não passa. O motivo é estrutural: o glifo é branco sobre o quadrado da
categoria, então *"cor contra branco"* e *"contraste do glifo"* são a **mesma
conta**, e a paleta foi calibrada para o glifo caber, não para a página.

Medindo as nove cores de grupo contra fundo escuro, **oito passam e só `#232F3E`
desaba** — e a lista da medição é exatamente a lista do deck escuro da AWS. Por
isso o escuro existe e o off-white não.

Se pedirem "o cinza institucional da empresa" no fundo: o tema `armadilha` é
literalmente esse pedido, e o portão o reprova. Gere com `--forcar` para mostrar o
estrago, não para entregar.

## O portão de contraste reprova, e não é o mesmo do laudo

| | quando | o que faz |
|---|---|---|
| **portão de contraste** (tema) | sempre, em `gerar` | **reprova** — `--forcar` gera assim mesmo |
| **portão geométrico** (laudo) | opt-in, `--portao` | ver [`laudo.md`](laudo.md) |

Ele reprova porque **rótulo que some não dá erro em lugar nenhum**: o arquivo
abre, o PNG sai, e o diagrama passa a omitir informação em silêncio. Roda sobre o
**plano** — o tema é hipótese, e o plano é onde ela vira número — e sobre **todas
as páginas**, não só a consolidada.

Ele separa **traço** de **área**: traço reprova, área avisa. O quadrado do ícone é
área sólida identificada pelo glifo de dentro, não um traço fino.

E ele **não substitui a camada indizível**: trocar a cor dos grupos por um azul
corporativo *passa* no contraste e mesmo assim apaga a legenda por cor.
**Contraste é acessibilidade, não veracidade.**

## O tema não é downstream do layout

Dezessete tokens são pintura pura e não movem coordenada; **dez são métrica e
movem** — corpo do rótulo, densidade da grade, qualificador em duas linhas. Texto
reserva espaço, e espaço é geometria. Por isso o tema entra em `resolver`, **antes**
do layout. A partição está travada por teste.

Consequência prática: trocar o tema **muda a geometria**. Não espere diff limpo
entre dois temas.

`folga.densidade` multiplica só as **folgas**, nunca as **calhas**. Folga é
respiro; calha é reserva de rótulo, derivada da métrica de fonte. Encolher calha
não aperta o desenho — derruba texto em cima de borda.

## Fundo, fluxo e o que sobrevive à exportação

**Sempre emita `background`.** É a única alavanca determinística de fundo, e o
motor já cuida disso. Sem ela o SVG exportado **muda de cor conforme o tema do
sistema de quem abre**. O dark mode do app é filtro CSS e não altera o arquivo.

| `--fluxo` | PNG | SVG / HTML |
|---|---|---|
| `solido` | ✅ | ✅ |
| `tracejado` | ✅ | ✅ |
| `animado` | ❌ **vira tracejado estático, sem erro nenhum** | ✅ |

`animado` degrada calado: o PNG do animado difere do tracejado só na fase do
tracejado — é um quadro congelado. Se pedirem fluxo animado, **exporte em SVG** e
avise. A CLI também avisa.

`--fluxo` é override de invocação sobre o token do tema: a mesma arquitetura com o
mesmo tema pode querer marcar o caminho quente numa entrega e não na outra.

## Três armadilhas de estilo, todas medidas

- **`sketch=1` quebra os stencils AWS4.** O canvas de esboço intercepta as
  primitivas do stencil e jitteria o glifo. `glass` e `rounded` são no-op
  silencioso em AWS4.
- **`strokeColor` pinta o GLIFO, não a borda**, nos shapes AWS4. Omitir produz
  glifo preto sobre quadrado colorido.
- **Não existe shape de legenda** no draw.io. Os templates AWS oficiais usam
  título `text;fontSize=30;fontStyle=1` mais legenda numerada com círculos. É o
  padrão a copiar quando a dívida de legenda for paga.

## Só o que está assado na célula viaja

Tema não é camada declarativa que o arquivo carrega. `defaultVertexStyle` é config
do app e **o tema do editor de quem abre sobrescreve**; o atributo `style` do
modelo só carrega o *nome* de uma folha embutida. O tema é resolvido em tempo de
geração e **assado célula a célula** — e guardar o *nome* do tema no arquivo
repetiria exatamente o erro diagnosticado.

## A cópia que circula

```bash
node sessao/publicar.cjs saida/<caso>.drawio --saida saida/<caso>.publicado.drawio
```

O arquivo de trabalho carrega a deliberação em texto legível por qualquer um em
*Extras › Editar diagrama*: candidatas descartadas com o motivo do descarte,
achados que o time recusou com a justificativa, a fala que a pessoa deu na
reunião, o nome de quem aprovou.

> **Sai o que é sobre PESSOAS e sobre CAMINHOS NÃO TOMADOS. Fica o que é sobre a
> arquitetura desenhada.**

| | na cópia |
|---|---|
| `nos` `arestas` `faixas` `notas` | **fica** — é o desenho em texto; quem vê a imagem já sabe |
| `dossie.eixos` | **fica** — descreve a arquitetura escolhida, que está desenhada |
| candidata escolhida | fica o nome e a tupla; **sai** o argumento (`porque`, `paga`, `erradaSe`, `escolhaSe`) |
| candidatas descartadas | **sai** — *"por que não a B"* é conversa da casa |
| `achados[]` regra, alvo, estado | fica — o **que** foi encontrado é técnico |
| `achados[].nota` | **sai** — é onde mora *"o time aceitou por orçamento"* |
| `estacionamento` | **sai inteiro** — é fala de pessoa, com aspas |
| `fatos[].de` | **sai** a citação; o `fato` fica, é premissa da arquitetura |
| `acordo.por` · `acordo.recorte` | **sai** — nome de pessoa, e a deliberação da fase 1 |
| `acordo.impressao` `em` `vista` | fica — provam **que** e **quando**, sem dizer por quem nem o quê |

**A cópia se declara.** O selo dela diz `publicado@1` e **que ela não retoma** —
senão chegaria numa sessão seguinte como um arquivo de trabalho com o dossiê
mutilado, e a skill diria *"candidatas descartadas: nenhuma"*, que é falso.

Por que um **verbo** e não uma opção de geração: mandar o arquivo para alguém é
um ato, e atos têm hora. Uma opção de geração obrigaria a decidir a privacidade no
momento errado — quando o desenho nasce, não quando ele sai.

> Não é anonimização nem criptografia. Um rótulo de nó pode dizer *"dados de
> cartão do cliente X"* e isso continua no desenho, porque **é** o desenho. A
> régua é uma só: **o que o leitor do PNG já vê pode ficar; o que só existia na
> conversa, não.**

## Onde o modelo mora dentro do arquivo

Embutido, **uma cópia por página**. Não em sidecar: dois arquivos dessincronizam —
o usuário arrasta o `.drawio` para o chat e o par se desfaz na primeira vez.

Uma cópia por página custa bytes e compra uma coisa concreta: **apagar uma página
é a operação mais banal do mundo**, e com uma cópia só ela apaga a sessão inteira
junto. Vale mais desde que a vista técnica multi-conta virou 1+N páginas, porque
a página que se apaga é uma vista de detalhe.

> ⚠️ **Teto registrado, com caminho de saída.** Num arquivo de 5 páginas o selo é
> **65%** dos bytes, e a fração escala com N. A decisão continua certa pelo motivo
> dela; se um dia importar, a saída **não é sidecar** — é hash da sessão nas
> páginas que não são a primeira, para que apagar a primeira vire detectável em
> vez de silencioso.

O selo **não tem relógio**. Regerar o mesmo modelo tem de dar o mesmo arquivo byte
a byte, e um timestamp de geração quebraria isso em toda execução. Data no selo é
data de **domínio** — quando o humano aprovou —, e vem do dossiê.
