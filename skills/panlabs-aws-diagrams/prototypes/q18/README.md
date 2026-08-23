# q18 · Validador geométrico — as 62 checagens viram código

Protótipo do ticket
[Validador geométrico: as 62 checagens viram código](https://github.com/ThiagoPanini/panlabs-skills/issues/18).
Consome o **plano** do [#11](https://github.com/ThiagoPanini/panlabs-skills/issues/11) e a
**rubrica** do [#8](https://github.com/ThiagoPanini/panlabs-skills/issues/8).

> **Protótipo descartável.** Nada aqui vira produção; o que sobrevive é a *decisão*,
> escrita na resolução do ticket. Estes arquivos ficam como fonte primária.

## A ideia em uma frase

> **A4.2 e A5.5 não são checagens de estética. São checagens de veracidade.**

Um nó desenhado dentro de uma VPC da qual não é membro, ou uma aresta cortando uma rede
alheia, não produzem um diagrama feio — produzem um diagrama que **comunica uma fronteira de
rede que não existe**. Isso muda o que a ferramenta é: não é um linter que sugere, é uma
guarda que reprova. Das 62, três carregam essa marca (`semantica` no índice): **A4.2, A4.4 e
A5.5**, mais a `F1` que o protótipo descobriu.

## Rodar

```bash
./tests/rodar.sh                                          # as cinco camadas, sem dependência
node tools/check-geometria.cjs --exemplos                 # laudo dos diagramas do #11
node tools/check-geometria.cjs --exemplos --tudo          # inclusive o que passou
node tools/check-geometria.cjs modelo.json --json         # laudo em JSON
node tools/check-geometria.cjs modelo.json --estrito      # aviso também reprova
```

## O que tem aqui

| | |
|---|---|
| `validador/indice.cjs` | **A tabela das 62.** Id, família, severidade máxima, insumo, limiar e fonte. É o contrato com a rubrica. |
| `validador/limiares.json` | Os números, separados em `normativos` (WCAG, percentis GD 2025) e `calibraveis` (os "default de engenharia" do U8). |
| `validador/cena.cjs` | Plano → cena: coordenada absoluta, estilo parseado, árvore, **fundo efetivo**, e a distinção grupo × faixa. |
| `validador/geometria.cjs` | Interseção, contenção, folga, travessia, cruzamento, ângulo, Hausdorff. Zero dependência. |
| `validador/cor.cjs` | Contraste WCAG, CIEDE2000, simulação de dicromacia. Conferido contra valor publicado. |
| `validador/familias/a1..a8` | As oito famílias, na ordem de prioridade da rubrica. |
| `validador/familias/extras.cjs` | `F1` — o achado do protótipo contra a rubrica. Fora das 62, de propósito. |
| `validador/validar-geometria.cjs` | A fachada. Função pura: `validarGeometria(plano) → laudo`. |
| `validador/portao.cjs` | A decisão 2 em código: transforma laudo em barreira, em quatro níveis. |
| `casos/quebrados.cjs` | 16 diagramas quebrados de propósito, mais o controle positivo. |
| `tools/check-geometria.cjs` | CLI, com código de saída para pendurar em portão. |

## As cinco decisões que o ticket pediu

### 1 · Severidade — quais das 62 são `fail`, `warn`, ou métrica reportada

**A rubrica já decidiu, checagem por checagem, e o índice só consolida.** Não havia o que
inventar: das 62, **40 são `fail` e 22 são `warn`**. Sete escalonam com a medida (A2.1 avisa
com 7–8 entradas de legenda e reprova acima de 8) e trazem `escalona: true` — quem decide o
caso concreto é a checagem, não a tabela.

**Métrica reportada não é uma terceira severidade, é um campo.** Toda checagem devolve
`medida`, inclusive quando passa. B9 da rubrica proíbe combinar as dez métricas de Mooney num
score único — "reporte cada métrica separadamente" — e um validador que só fala quando reprova
não tem o que mostrar no dia em que alguém perguntar se melhorou.

**Tolerância zero em A4.2 e A5.5: confirmada, e estendida a A4.4.** As três afirmam topologia.
A4.2 vê o nó dentro do grupo errado; A4.4 vê a árvore desenhada divergir da declarada — é a
mesma mentira pelo outro lado. As três são `fail` sem limiar configurável.

Além do par `fail`/`warn`, o estado do resultado tem cinco valores, e os dois últimos existem
porque **silêncio é o modo de falhar de um validador**: `ok`, `aviso`, `falha`, `inaplicavel`
(não havia o que medir neste diagrama) e `pulada` (não é do validador). Uma checagem que não
roda e não diz nada é indistinguível de uma que rodou e aprovou.

### 2 · Posicionamento — dentro do motor, depois dele, ou os dois

**Portão depois de `planejar`, antes de `emitir`. Sem laço de correção.**

É o único ponto do pipeline onde a geometria já existe e o XML ainda não. `validarGeometria` é
pura e não escreve nada; quem transforma laudo em barreira é `validador/portao.cjs`, separado
porque julgar e bloquear são políticas diferentes — um relatório de revisão quer o laudo
inteiro, um pipeline de publicação quer parar.

São quatro níveis: `nenhum`, **`veracidade`** (o default recomendado), `falha` e `estrito`.
`veracidade` é o único que separa as duas coisas que o #18 insiste em não confundir — um
diagrama **incompleto** ainda é verdadeiro e pode ir para a parede; um que **mente** sobre a
fronteira de rede, não. Nenhum nível engole laudo incompleto: se uma checagem que devia rodar
não rodou, o verde não quer dizer nada.

O enxerto no motor são duas linhas em `gerar.cjs`, entre `planejar` e `emitir`:

```js
const { portao } = require('../../q18/validador/portao.cjs');
relatorio.geometria = portao(plano, { nivel: 'veracidade' });
```

Não fica aplicado no q11 — o motor é protótipo de outro ticket, e mexer nele daqui misturaria
as fronteiras. `tests/check-portao.cjs` roda o enxerto ponta a ponta e prova as duas metades:
barra o plano que mente, e depois de passar, `emitir` produz o XML **byte a byte igual** — o
portão é puro e não tocou no plano.

O laço de correção foi considerado e recusado, por um argumento e um precedente:

- **O argumento.** Um laço comandado pelo validador é um segundo otimizador competindo com o
  ELK, sem gradiente e sem função objetivo. As 62 não formam um alvo minimizável — B9 proíbe
  o score único, e sem escalar não há o que descer. Um laço desses ou não converge, ou
  converge para o que a última checagem por acaso empurrou.
- **O precedente.** O motor **já corrige, e no lugar certo**: `alinhar.cjs` faz
  `temSobreposicao` → `refitar` → `rerrotear` e desfaz a passada quando ela piora. Funciona
  porque acontece dentro do passo que tem os parâmetros na mão.

Então: **quem corrige é `dispor`/`alinhar`, com o conhecimento local; quem julga é o
validador, sem poder de escrita.** Se uma checagem reprovar sistematicamente, o conserto é
ensinar a alavanca ao passo que a tem — não dar poder de layout a quem só sabe medir.

### 3 · Configurabilidade — quais limiares viram config, e onde ela mora

`limiares.json`, em dois grupos, separados pela única coisa que muda o que se pode fazer com
eles: **se existe medição por trás.**

- **`normativos` (25).** WCAG 2.2, os percentis de especialista da Tabela 2 de Mooney et al.,
  o teto de Moody. Cada um carrega a `fonte` ao lado. Mexer num deles não é configurar, é
  discordar da fonte — e quem mexer troca a citação junto.
- **`calibraveis` (27).** Começam pelos **oito** que o U8 da rubrica enumera e manda expor:
  A3.9, A4.7, A5.3, A5.7, A6.4, A7.4, **A8.3 e A8.4**. As duas últimas só aparecem no U8 — a
  marcação in loco no corpo das checagens esquece ambas, e o U8 é a lista completa.

Cada calibrável carrega **`porque: null`**. O campo vazio é o pedido de medição, visível para
quem for calibrar: um número sem base experimental hard-coded no meio de um `if` é
indistinguível de um número medido, e a diferença é justamente o que a rubrica se deu ao
trabalho de registrar.

### 4 · Fundo efetivo para o contraste WCAG

**A pilha de grupos composta em ordem z, não o fundo da página.** Mora em
`cena.fundoEfetivoEm(ponto, ateZ)`.

A conta: varrer as caixas em ordem de documento (que é a ordem z), ficar com as que contêm o
ponto **e têm preenchimento**, e compor de trás para frente com a opacidade de cada uma.

Duas consequências que só aparecem medindo:

- **`fillColor=none` não entra na pilha.** É como as faixas e a AZ se desenham — elas cruzam
  sem trocar o fundo de quem está embaixo, que é exatamente o que prometem visualmente.
- **Rótulo com halo usa o halo.** `labelBackgroundColor` é o fundo real daquele texto, e o
  motor o usa de propósito nas faixas, porque o rótulo delas nasce por cima de bordas alheias.

Sem isso, o rótulo de um EC2 dentro de subnet dentro de VPC dentro da nuvem seria medido
contra o branco do canvas — um contraste que não existe em lugar nenhum do desenho. Medindo
certo, os fundos efetivos que aparecem no `web-multi-az` são `#f2f6e8` e `#e6f6f7`, não
`#FFFFFF`.

### 5 · A divisão validador × render, sem sobreposição

**É uma partição do índice pelo campo `insumo`, e `check-indice.cjs` a trava:** todo id cai em
exatamente um dos dois lados, e quem cai no render escreve o motivo em `porqueRender`.

- **Validador — 60 das 62.** Camada obrigatória e portátil. Roda em qualquer máquina, sem
  draw.io, sem rasterizar. É o que a skill publicada leva junto.
- **Render — 2: A2.9 e A8.4.** Juiz oportunista.
  - **A2.9** (rótulo em ≤2 linhas) depende da métrica da fonte real. O motor já estima, e o
    comentário do `resolver.cjs` registra que a estimativa subdimensionou ~25% na primeira
    versão. Validar contra a própria estimativa seria o gerador conferindo o próprio palpite.
  - **A8.4** (cobertura de tinta) precisa de pixel não-fundo. Não há aproximação honesta a
    partir do plano: somar áreas de caixa contaria o vão dentro de um grupo como tinta, e um
    grupo grande e vazio ficaria "denso".

A linha que separa os dois, em uma frase: **o validador pergunta se o plano é internamente
consistente e verdadeiro; o render pergunta se o pixel cumpriu o que o plano prometeu.**

É por isso que A3.2/A3.3/A3.4 ficam com o validador mesmo dependendo de caixa de rótulo: elas
conferem a **reserva** que o motor fez (o `resolver.cjs` reserva a faixa do rótulo porque o
mxGraph não reserva, e nunca confere se a reserva bastou). Se o texto real estourar a reserva,
quem acusa é o render — B7.

## O que o protótipo descobriu, além do que foi pedido

### A rubrica modela uma árvore de contenção só; este motor desenha duas coisas

`resolver.cjs` é explícito: **"Uma faixa existe para CRUZAR outras caixas."** Uma faixa de AZ
atravessa subnets; um Auto Scaling group abraça EC2 de duas AZs.

Aplicar A4.2 e A4.3 sobre faixas reprova o desenho correto — e reprova pelo motivo de maior
gravidade do validador inteiro. Na primeira rodada, antes da distinção existir, o
`web-multi-az` acusava A4.2 nas três faixas: o validador chamando de mentira a decisão central
do gerador.

A saída não foi abrir exceção, foi reconhecer que as duas caixas afirmam coisas diferentes:

| | afirma | sobreposição é |
|---|---|---|
| **grupo** | contenção — "este nó está dentro desta VPC" | mentira sobre a fronteira de rede |
| **faixa** | atributo compartilhado — "estes dois estão nesta AZ" | o ponto: uma classe corta a árvore por definição |

Então A4.2/A4.3/A5.5 valem sobre **grupos**, e as faixas ganham a checagem que de fato lhes
cabe — **`F1`: a faixa abraça exatamente os membros que declara**, nem um a menos nem um a
mais. Mesma pergunta semântica de A4.2, feita contra a lista de membros em vez da relação de
pai; mesma tolerância zero.

**`F1` fica fora das 62 de propósito.** O índice é o contrato com a rubrica; inflá-lo com
achados nossos apagaria a fronteira entre "o que a pesquisa mandou medir" e "o que a gente
descobriu medindo". Se o #18 virar produção, o caminho é levar `F1` de volta à rubrica como
A4.8 — não deixá-lo em `extras` para sempre.

### Achados reais nos diagramas bons do #11

Nenhum é falha semântica — os dois exemplos passam nas quatro checagens de veracidade. Mas:

| | achado |
|---|---|
| **A3.7** | **`web-multi-az` estoura o próprio canvas.** O desenho ocupa 725×842 e a página é 542×904. O subtítulo é dimensionado pelo texto e o caminho da grade calcula a largura só a partir da nuvem — o caminho do ELK usa `max(saida.width + 2·OFF_X, 900)` e não tem o problema. É defeito do motor, não do validador. |
| **A7.1** | Títulos de grupo abaixo de 4,5:1: `#00A4A6` sobre branco dá **3,06:1**, `#AAB7B8` dá **2,06:1**. São cores do catálogo oficial — a AWS não desenha para a WCAG. |
| **A7.2** | O laranja de EC2 (`#ED7100`) sobre a subnet clara (`#e6f6f7`) dá **2,71:1**, abaixo dos 3:1 do SC 1.4.11. |
| **A1.2/A1.3** | O motor não emite legenda. 21 e 24 valores de canal visual ficam sem chave. |
| **A2.7** | Todas as arestas são sólidas, e o modelo declara `protocolo` https e sql — um traço, dois significados. |
| **A2.1** | 10 e 9 tipos de símbolo, acima do teto de 8 de Moody. |

### Dois erros que a revisão pegou no próprio validador

Estão aqui porque são o tipo de defeito que a suíte não pegaria sozinha — os dois devolviam
número plausível, e o relatório ficava verde por não ter achado nada.

- **O fundo efetivo excluía o preenchimento do próprio elemento.** `fundoEfetivoEm(ponto, e.z)`
  cortava em `e.z`, mas o rótulo de um grupo é desenhado DENTRO da caixa dele — o preenchimento
  do próprio grupo é o fundo daquele texto. O erro tem direção perigosa: um título `#00A4A6`
  sobre subnet `#E6F6F7` dava 3,06:1 em vez de 2,75:1 (otimista, mas ainda reprovava), enquanto
  **texto escuro sobre grupo escuro — `#232F3E` sobre `#232F3D`, 1,00:1 na tela — era medido
  contra a página e passava com 13,57:1.** Falso negativo na única família normativa, e
  exatamente a decisão 4. O caso virou fixture de regressão.
- **A6.3 comparava razões sem orientação.** `Asp` é `min/max` por definição de Mooney, mas a
  segunda metade da checagem compara o desenho com o canvas — e ali um desenho deitado numa
  página em pé, com a mesma razão, dava diferença zero e passava. É precisamente o caso das
  "faixas vazias grandes" que o limiar persegue.

Mais três, menores: A7.5 era `conforme(id, [])` com lista vazia — uma checagem `fail` que não
sabia reprovar, ocupando linha no relatório e devolvendo verde; A5.1 dividia a contagem crua de
cruzamentos por um `c_max` medido em PARES; e um byte NUL literal em `a5-arestas.cjs` fazia
`file` classificar o módulo como `data`, o que faz `grep -r` pular o arquivo inteiro em
silêncio — num repo cujo wayfinding é `grep`.

### Duas armadilhas que a implementação encontrou do jeito caro

- **A ponta da aresta não está no plano.** O plano guarda só as *dobras*; as pontas o mxGraph
  projeta no perímetro em tempo de render. A cena reconstrói — e isso muda o que A3.6 e A6.1
  podem AFIRMAR. Sem âncora declarada, a ponta está no perímetro por construção, e duas
  arestas indo para o mesmo lado saem no mesmo ângulo por artefato da reconstrução, não por
  defeito do desenho (o mxGraph as desencosta com `jettySize=auto`). As duas checagens
  reportam quantas ficaram por construção em vez de fingir que conferiram.
- **A granularidade de "tipo" em A2.6 quebra nos dois sentidos.** Grosso demais (o `tipo` do
  modelo) põe todo `servico` num balde e reprova a paleta oficial da AWS, em que cada serviço
  tem a sua cor. Fino demais pelo lugar errado (o stencil) junta subnet pública e privada, que
  compartilham `group_security_group` e são tipos diferentes de propósito. A chave certa está
  no modelo: `tipo` mais os campos que o especializam (`servico`, `acesso`).

## Como a suíte prova que o validador mede

Quatro camadas, e a ordem tem motivo — o índice primeiro, porque se ele derivou da rubrica
todo o resto mede uma lista que já não é a das 62; as primitivas em seguida, porque uma conta
de geometria ou de cor errada não estoura, devolve um número plausível e deixa as checagens
verdes por não terem achado nada.

- **`check-indice`** — as 62 ids da rubrica, escritas à mão, contra o índice. Não derivadas
  dele, senão seria o índice conferindo a si mesmo.
- **`check-primitivas`** — 56 asserções contra **valor publicado**: os pares canônicos da WCAG
  e os 15 pares do conjunto de teste de Sharma, Wu & Dalal (2005) para o ΔE00. Quatro deles
  existem só para pegar a descontinuidade da média de matiz: entre `b=0,0010` e `b=0,0011` o
  resultado salta de 7,1792 para 7,2195, e uma implementação que devolva o mesmo nos quatro
  está com o ramo errado.
- **`check-quebrados`** — o controle negativo, na convenção que o `check-fronteira.cjs` do #11
  estabeleceu: 16 diagramas quebrados de propósito, cada um declarando a checagem que tem de
  acusar; mais o **controle positivo**, com o mesmo vocabulário e geometria correta, que prova
  que os 15 falham pelo defeito e não pelo jeito de construir o plano.
- **`check-portao`** — o portão ponta a ponta: barra o que mente, deixa passar o que não
  mente, e `emitir` roda depois produzindo XML idêntico.
- **`check-bons`** — os exemplos do #11. Falha semântica trava a suíte; incompletude
  (sem legenda, sem metadados, contraste do catálogo) é reportada e **não** trava — travar
  transformaria achado do #18 em regressão do #11.

**Em que eixo a separação acontece, e onde não acontece.** O ticket pede "mostrar que separa os
dois". No eixo do relatório inteiro **não separa**, e vale dizer: os exemplos do #11 carregam 6
falhas cada um, todas reais. "Tem falha" não distingue um diagrama bom de um quebrado — os dois
têm. O que distingue é a **veracidade**: 4/4 dos diagramas que mentem são barrados no nível
`veracidade`, 2/2 dos do #11 passam. É essa a separação que o validador entrega, e é por isso
que `veracidade` é o nível default do portão.

## Onde isto encosta em outros tickets

- **[#11](https://github.com/ThiagoPanini/panlabs-skills/issues/11)** — consome o `plano`.
  O ponto de enxerto do portão é `gerar.cjs`, entre `planejar` e `emitir`.
- **[#8](https://github.com/ThiagoPanini/panlabs-skills/issues/8)** — a rubrica. `F1` é a
  proposta de A4.8; os oito calibráveis do U8 estão expostos como o U8 pede.
- **[#19](https://github.com/ThiagoPanini/panlabs-skills/issues/19) /
  [#21](https://github.com/ThiagoPanini/panlabs-skills/issues/21)** — a distinção grupo × faixa
  é a mesma que está sendo decidida ali sobre o eixo da AZ. `F1` dá o critério mecânico:
  qualquer que seja o eixo, a faixa tem de abraçar exatamente seus membros.
- **B7 / render** — as duas checagens de `insumo: 'render'` são o contrato do juiz oportunista,
  com o motivo escrito em cada uma.
