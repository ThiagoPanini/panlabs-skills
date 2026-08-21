# q11 · Motor de geração — IR › layout › mxGraph XML

Protótipo do ticket
[Motor de geração: IR → layout → mxGraph XML](https://github.com/ThiagoPanini/panlabs-skills/issues/11).
É a decisão central do mapa: tudo depois dela é variação.

> **Onde isto vai morar dentro da skill ainda não está decidido** — a estrutura
> das `references/` é névoa no mapa. A proposta é `skills/panlabs-aws-diagrams/motor/`,
> irmão de `catalog/`. Mover é `git mv` mais uma linha em `resolver.cjs`
> (`CAMINHO_CATALOGO`); nada mais depende do caminho.

## A ideia em uma frase

> **O agente escreve o QUE existe. O motor calcula ONDE fica.**

E a fronteira não é disciplina, é gramática: **o esquema do modelo não tem
nenhuma propriedade que nomeie posição, tamanho, distância ou direção.** Não
existe onde escrever uma coordenada. `tools/check-fronteira.cjs` verifica isso
mecanicamente — e foi validado por experimento de controle (corrompendo o
esquema e o modelo, ele acusa as três violações e sai 1).

## Rodar

```bash
./tests/rodar.sh                                  # a suite inteira
node motor/gerar.cjs modelo/pedidos-serverless.json --saida saida/x.drawio
node motor/gerar.cjs modelo/pedidos-serverless.json --explicar   # trilha do catálogo
```

## O que tem aqui

| | |
|---|---|
| `motor/esquema.json` | **O IR.** JSON Schema draft-07, tudo `additionalProperties:false`. |
| `motor/validar.cjs` | Três camadas: esquema › referências › domínio. Validador de subconjunto escrito à mão — sem `ajv`. |
| `motor/resolver.cjs` | Nó do modelo → style do catálogo (#17). Único lugar que decide tamanho. |
| `motor/derivar.cjs` | O que o motor descobre sozinho: árvore, gatilho de AZ (#19), faixas derivadas, pai da aresta. |
| `motor/dispor.cjs` | Layout. Dois caminhos: `elkjs` puro, ou grade de AZ com o `elkjs` dentro da célula. |
| `motor/alinhar.cjs` | O passe que tira o "quase" — encaixa faixas quase alinhadas, e desfaz se sobrepuser. |
| `motor/planejar.cjs` | Layout bruto → **plano** de células. A costura do motor. |
| `motor/emitir.cjs` | Plano → mxGraph XML, receita do #2 §8. Mais o parser que confere boa-formação. |
| `motor/gerar.cjs` | O pipeline e a CLI. |
| `motor/vendor/` | `elkjs` 0.12.0 embarcado — 1,6 MB (470 KB gzip). É o preço da premissa 7. |
| `modelo/*.json` | Dois modelos de exemplo, mesmo vocabulário, caminhos de layout diferentes. |
| `saida/*.drawio` · `*.png` | O que o motor produziu, e o render como prova. |
| `saida/antes-rotulo-fora-do-elk.png` | O mesmo modelo **sem** entregar o rótulo da aresta ao ELK — as três colisões `A3.2`, para comparar com `pedidos-serverless.png`. |
| `saida/pedidos-tracejado.png` · `pedidos-animado.svg` | As variantes de fluxo. A animada é SVG por necessidade, não por escolha. |
| `tools/check-*.cjs` | Fronteira · validação · determinismo · round-trip. |

## O pipeline

```
carregar › VALIDAR › resolver › derivar › dispor › planejar › emitir › conferir
           ^^^^^^^                        ^^^^^^
           o agente para aqui             aqui nasce o primeiro número
```

`conferir` não é zelo: o #19 descobriu que **XML inválido faz o draw.io
renderizar truncado e sair com código 0**. O renderizador não reclama, então
quem reclama é o gerador.

## Os dois caminhos de layout, e quem escolhe

Não é opção do agente — cai do modelo, pela regra do #19:

```
faixas de AZ = ≥2 AZs distintas E algum PAPEL de subnet presente em ≥2 AZs
               (papel escopado por VPC)
```

| | `pedidos-serverless` | `web-multi-az` |
|---|---|---|
| gatilho | `false` — 1 AZ só | `true` — 3 papéis em 2 AZs |
| caminho | **ELK manda em tudo** | **o motor manda na grade** |
| o que o ELK faz | hierarquia inteira, 1 passada, roteamento ortogonal | só o conteúdo dentro de cada célula |
| arestas | roteadas e rotuladas | nenhuma — ver abaixo |

**As faixas de AZ não estão em nenhum dos dois modelos.** O motor derivou que a
arquitetura afirma redundância zonal e desenhou as colunas. É a decisão do #19
virando código em vez de script avulso.

O caminho da grade **não desenha arestas** — e isso não é lacuna preenchida com
desculpa: o [#6](https://github.com/ThiagoPanini/panlabs-skills/issues/6) mediu
que o diagrama multi-conta carro-chefe da AWS tem **zero conectores**, e o eixo
de faixa vs. eixo de fluxo é exatamente o que o
[#21](https://github.com/ThiagoPanini/panlabs-skills/issues/21) está decidindo.
O motor expressa os dois; a política é de lá.

## A armadilha mais cara: opção de layout não desce para container

Vale destacar antes de tudo, porque invalida a intuição que a documentação passa.

Com `hierarchyHandling: INCLUDE_CHILDREN` parece que o grafo inteiro é layoutado
numa passada e que as opções da raiz valem para tudo. **Não valem.** Opção de
espaçamento é lida **por container**; setar só na raiz não dá erro nem aviso —
dá configuração **inerte**, e o que vale lá dentro é o default do ELK.

Medido: com as opções só na raiz, `spacing.nodeNode` em 38, 50 ou 90 produz
**exatamente a mesma geometria** — vão de 20 px, o default. Repetido por
container, o vão obedece. Idem `nodePlacement.strategy`, inerte na raiz e
decisiva quando repetida.

O sintoma foi um rótulo encostando no ícone vizinho. A causa era que o motor
inteiro estava pedindo espaçamento que nunca foi aplicado. Quem acrescentar uma
opção de espaçamento tem de acrescentar em `ESPACAMENTO`, nunca só em
`OPCOES_RAIZ`.

## Alinhamento: por que existe um passe do motor

Um desalinhamento de 13 px entre dois nós ligados por uma aresta não lê como
escolha — lê como erro. Ou os dois estão na mesma faixa, ou estão claramente em
faixas diferentes.

**Não há alavanca no ELK que resolva isso.** Medidos e inertes no `elkjs`
0.12.0: `priority.straightness` (por aresta), `elk.margins` (por nó),
`nodePlacement.favorStraightEdges`. As variantes de
`nodePlacement.bk.fixedAlignment` funcionam mas escolhem **outro** vizinho para
alinhar; nenhuma zera a diferença.

Como o motor já é dono de 100% da geometria (#2 §8 — é por isso que
`childLayout` é proibido), o encaixe mora em `motor/alinhar.cjs` e é
conservador: só mexe em desalinhamento ≤ 30 px, move a **coluna inteira** para
não comer o vão do vizinho, e **desfaz** se o resultado sobrepõe qualquer coisa.

## Como a aresta indica o caminho

`--fluxo solido | tracejado | animado`. A diferença entre as duas últimas é do
**renderizador**, não de gosto:

| | PNG | SVG / HTML |
|---|---|---|
| `tracejado` | ✅ | ✅ |
| `animado` (`flowAnimation=1`) | ❌ **vira tracejado estático, sem erro** | ✅ |

O #4 mediu e este protótipo confirmou com os próprios arquivos: o PNG do
`animado` difere do `tracejado` **só na fase do tracejado** — é um quadro
congelado. Por isso a suite exporta a variante animada para **SVG** e checa que
o `@keyframes ge-flow-animation` está lá; gerar PNG dela seria prova falsa. A
CLI avisa quando alguém pede `animado`.

## O que este protótipo descobriu

**1 · `BAND_LANE` não pode ser constante.** O #19 calibrou 24 px contra um
estilo de faixa escrito à mão. O estilo real do Auto Scaling group no catálogo
é `groupCenter` com `spacingTop=25` — o rótulo nasce 25 px abaixo do topo, para
caber o ícone. Com calha de 24 o rótulo da faixa caía na linha de título da
subnet cruzada. A calha agora é **lida do estilo**: quem sabe onde o rótulo vai
parar é a forma, não uma constante nossa.

**2 · A ordem das linhas não podia herdar a ordem do arquivo.** Era a
[incerteza 4 do #7](https://github.com/ThiagoPanini/panlabs-skills/issues/7),
deixada explicitamente em aberto lá — e ela se confirmou: embaralhar `nos`
mudava a geometria em 2 de 3 sementes, **no caminho da grade** (o caminho ELK
passou intacto). Importa porque quem escreve o modelo é um agente, e nenhum LLM
emite a mesma lista na mesma ordem duas vezes; sem ordem derivada, regerar o
mesmo diagrama produz um diff inteiro. Agora a ordem cai de exposição + rótulo.

**3 · Rótulo de aresta tem de ir para o ELK.** Sem entregar o texto, o ELK
aproxima os nós até o vão ficar menor que o rótulo, e ele cai em cima do ícone
vizinho — `A3.2` da rubrica (#8), a falha que ela prevê para gerador
automático. Entregue o rótulo, o vão passa a ser calculado para caber nele. O
primeiro render tinha três colisões; o segundo, zero. O antes está guardado em
`saida/antes-rotulo-fora-do-elk.png` — não é reconstituição, é o mesmo motor
com a entrega do rótulo desligada.

**4 · A caixa do layout é a caixa do ÍCONE.** O reflexo é inflar a altura para
caber o rótulo — e é errado: o ELK roteia até o **centro** da caixa, e caixa
inflada para baixo tem centro abaixo do ícone, então a seta sairia de dentro do
texto. A caixa é o ícone (âncora exata) e o espaço do rótulo é comprado em
`spacing` e em `padding.bottom`.

**5 · O modelo sobrevive ao codec do app.** O #2 provou por leitura de código
que atributo de `<object>` faz round-trip, e listou como **incerteza 7(a)** o
que não pôde testar: um round-trip de gravação de verdade. O binário headless
fecha isso — `drawio -x -f xml` faz o app decodificar e re-serializar, e o
modelo (dossiê opaco incluído) volta idêntico. **O `.drawio` é o seu próprio
formato de persistência**; não há um segundo arquivo para dessincronizar.

## O que ficou aberto, de propósito

- **Ordem das camadas privadas.** O desempate é alfabético e isso é
  *placeholder*: acerta "App subnet" antes de "Data subnet" por coincidência, e
  erraria "Web subnet" depois de "Data subnet". Ordenar camadas privadas por
  significado exige um fato que o IR ainda não tem — é decisão, não bug.
- **O rótulo do VPC sai cinza `#AAB7B8`.** É uma das 5 divergências de
  `fontColor` que o #17 deixou de propósito para a camada de estilo (#13). O
  motor é fiel ao catálogo; o render mostra o custo, que é o insumo que o #13
  precisa.
- **O caminho da grade recusa o que não sabe desenhar.** Conta, região, grupo
  de segurança e folha fora de subnet fazem o motor **falhar com a lista**, em
  vez de omitir em silêncio — omissão calada é o que a rubrica chama de A4.2.
- **Aresta pode passar por baixo do rótulo de um nó.** O ELK reserva para
  rótulo de aresta (porque eu entrego) mas não para rótulo de nó (porque a
  caixa é o ícone). O `transbordo` compra o vão entre camadas; uma aresta
  roteada dentro desse vão ainda pode raspar o texto. É trabalho do validador
  geométrico (#18) pegar.
