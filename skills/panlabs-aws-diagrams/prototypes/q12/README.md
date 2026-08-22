# q12 · Agrupamento aninhado e multi-account no motor

Protótipo do ticket
[Agrupamento aninhado e multi-account no motor](https://github.com/ThiagoPanini/panlabs-skills/issues/12).

> **Este protótipo não forka o motor — ele estende o do
> [#11](https://github.com/ThiagoPanini/panlabs-skills/issues/11), em
> `../q11/motor/`.** Duplicar 2.300 linhas para acrescentar um caminho de layout
> tornaria o diff ilegível e criaria duas verdades. O que está aqui é o que o
> #12 acrescentou: modelos, checagens, provas renderizadas e as decisões. A
> suite do #11 roda como primeira camada da suite daqui: se ela quebrar, o que
> este ticket acrescentou desfez o que aquele provou.

## A resposta em uma frase

> **A conta é container. A OU é dimensão — igual à AZ.**
> E a travessia entre contas não é um problema de roteamento: é uma escolha
> entre seis mecanismos, e o primeiro deles é não desenhar.

## Rodar

```bash
./tests/rodar.sh                                          # a suite inteira (inclui a do #11)
node ../q11/motor/gerar.cjs modelo/plataforma-3-contas.json --saida saida/x.drawio
node tools/check-gatilhos.cjs                             # só as decisões, sem pixel
```

## O que tem aqui

| | |
|---|---|
| `modelo/plataforma-3-contas.json` | O cenário que o ticket pediu — rede/TGW, workload/ECS atrás de ALB, dados/S3+Glue+EventBridge cross-account. Cai no modo **integração**. |
| `modelo/landing-zone-6-contas.json` | O conjunto canônico do AWS SRA, 6 contas em 3 OUs. Cai no modo **inventário**. |
| `modelo/hub-tgw-3-contas.json` | Mesma origem, **mesmo vínculo** para duas contas → nível **4**, barramento. |
| `modelo/logs-centralizados-3-contas.json` | Fan-in de duas contas no mesmo destino → nível **3**, aresta agregada. Traz também o habilitador de permissão (`E9`). |
| `modelo/web-fluxo-3-az.json` | Multi-AZ **com passo numerado** — o que faz a grade do #19 transpor, pagando a dívida do #11. |
| `saida/antes-elk-sem-politica.png` | O mesmo cenário de 3 contas **sem nenhuma política de conta** — só o ELK. É o "antes", e não é reconstituição. |
| `saida/plataforma.png` | 4 páginas: consolidada + 1 por conta. |
| `saida/landing-zone.png` | 7 páginas, rótulos de OU sem caixa, travessias suprimidas. |
| `saida/hub-tgw.png` | O barramento do AMS MALZ reproduzido: 1 linha, 1 tronco, N stubs. |
| `saida/logs-centralizados.png` | A aresta agregada entrando de fora, com o texto carregando a cardinalidade. |
| `saida/web-fluxo.png` | A grade transposta: fluxo na horizontal, AZ em raia. |
| `tools/check-gatilhos.cjs` | 19 casos. As decisões isoladas dos pixels. |
| `tools/check-travessia.cjs` | As mesmas decisões conferidas **no arquivo emitido**, com experimento de controle. |
| `tools/render*.sh`, `limpar-render.sh` | A higiene de render que este protótipo teve de aprender — ver "A armadilha mais cara". |
| `tools/bissecar-modelo.cjs` | Bisseção no MODELO (não no XML) quando um arquivo não renderiza. Bissecar o XML produz pai órfão, que renderiza por acidente e mente sobre a causa. |

---

## As cinco perguntas do ticket

### 1 · Como o IR expressa contas: grupos de primeira classe ou só mais um nível de container?

**Mais um nível de container — e isso não é escolha, é o que a AWS publica.**

O deck oficial tem uma lista **fechada** de 13 group icons, e `AWS account`
está nela ([#6](https://github.com/ThiagoPanini/panlabs-skills/issues/6) `G1`,
`G4`): retângulo sólido magenta `#E7157B`, aba de ícone no canto superior
esquerdo. O IR do #11 já tinha `tipo: "conta"`. Nada a inventar.

O que faltava era a **OU** — e o mesmo levantamento diz que `Organization` e
`Organizational unit` **não são groups**. Existem só como resource icons. Em
diagrama de arquitetura a OU é um par ícone+rótulo flutuando acima do primeiro
membro, **sem caixa** (`G2`), e o agrupamento é feito por adjacência mais o
contraste de gap 1:4 (`S2`/`S3`).

Então:

```
conta:  { tipo: 'conta', conta: '111111111111', ou: 'Infrastructure' }
                                                 └──── dimensão ────┘
subnet: { tipo: 'subnet', vpc: 'prod', az: 'us-east-1a' }
                                        └── dimensão ──┘
```

**A OU está para a conta como a AZ está para a subnet.** As duas são dimensões
que o motor decide sozinho se viram desenho, pela mesma forma de gatilho, e as
duas usam o **mesmo construtor de banda derivada** do #19.

### 2 · A conta é container ou também é faixa? O construtor de banda do #19 se reusa?

**A conta é container; a OU é a faixa. E sim, reusa — com um campo a mais.**

O construtor do #19 é `unionRect` sobre os membros, agnóstico de eixo. O que o
#12 acrescentou é o que se faz com a união:

| | AZ (#19) | Auto Scaling group (#19) | **OU (#12)** |
|---|---|---|---|
| construtor | união dos membros | união dos membros | união dos membros |
| `render` | `caixa` | `caixa` | **`rotulo`** |
| desenho | retângulo tracejado | retângulo tracejado | **rótulo, sem retângulo** |
| por quê | shape oficial existe | shape oficial existe | **shape oficial NÃO existe** |

Um construtor, três faixas, dois renders. A união continua sendo calculada no
caso da OU — é ela que diz onde o rótulo é ancorado e quais contas formam a
coluna.

**O gatilho de OU, irmão exato do gatilho de AZ:**

```
desenhar_ou = alguma OU com ≥2 contas   E   alguma conta FORA dessa OU
```

As duas cláusulas ecoam as duas do #19 (`≥2 zonas` **E** `papel repetido entre
elas`), e cada uma mata um caso que apareceu nos testes:

- **sem a 1ª** — duas OUs de uma conta cada ganhariam dois rótulos que não
  agrupam nada; o nome da conta já separa as duas.
- **sem a 2ª** — um diagrama inteiro dentro de uma OU só ganharia um rótulo
  constante, que é subtítulo, não agrupamento. *Faixa sem contraste não é faixa.*

A conta **sem** OU não vira uma OU anônima, mas conta como contraste: é a
Management, que o `P2` põe no topo e fora de qualquer OU, e é contra ela que
"OU – Security" significa alguma coisa.

### 3 · Disposição: lado a lado, empilhadas, ou agrupadas por OU — e o que o layout escolhe automaticamente?

**Depende do modo, e o modo é derivado.** O `§6.7` do #6 é explícito: a vista de
**integração** obedece a regras *diferentes* da vista de **inventário**, e um
gerador precisa saber em qual está — porque as duas se contradizem no ponto
central (uma suprime a travessia, a outra existe para desenhá-la).

```
modo = integracao   se  2 ≤ contas ≤ 4  E  1 ≤ travessias ≤ 7
       inventario   caso contrário
```

Os dois limites são medidos, não escolhidos: `X1` (a vista de integração do
corpus tem sempre 2–4 contas) e as vistas por-conta oficiais do SRA, que
carregam de 2 a 7 conectores. Acima disso não há exemplo oficial nenhum.

| | **integração** | **inventário** |
|---|---|---|
| disposição | uma fileira, calha larga (`X1`, `X2`) | uma **coluna por OU**, contas empilhadas (a disposição do SRA, medida em §2.2) |
| ordem | **varredura** minimizando cruzamento | ordem canônica `P1` |
| travessia | desenhada | **suprimida** (`E1`) |
| ênfase de hub | sim (`X6`) | não — a aresta que justificaria a ênfase não está desenhada |

**A ordem das contas sai por varredura, não por heurística** — a lição do #21,
que mediu que "põe o alvo da convergência no meio" apenas *troca* um cruzamento
por outro. Com `X1` limitando a 4 contas são no máximo 24 permutações. O custo
tem dois termos e a ordem entre eles importa:

- **pulo** (peso 10) — travessia entre contas não vizinhas, que atravessa a
  caixa de uma terceira. É `A5.5` da rubrica ([#8](https://github.com/ThiagoPanini/panlabs-skills/issues/8)).
- **contramão** (peso 1) — travessia contra o eixo. `X5` diz que esquerda→direita
  segue o fluxo primário; ir contra não mente, só lê pior.

**O desempate é inversões contra `P1`, e isso não é detalhe.** No modelo de três
contas, duas permutações empatam em custo 1 — as duas que põem o workload no
meio — e a diferença entre elas é ler `Network | Workload | Data` ou
`Data | Workload | Network`. "A primeira que a enumeração achar" é determinística
e arbitrária; contar inversões contra a ordem de leitura da AWS é determinística
e **significativa**.

### 4 · Roteamento da travessia: canaleta dedicada? `jumpStyle`? barramento central?

**`jumpStyle` na fronteira: não, e isso é medição.** `E8`: *"a borda da conta é
atravessada sem cerimônia — não existe convenção AWS de porta, gateway, losango
ou marcador de travessia"*. O que marca a travessia é **onde o habilitador de
permissão está** (`E9`), não a linha. Por isso o IR ganhou `habilita`, e o
habilitador é desenhado como **nó anexado com seta curta apontando para dentro**
de quem ele autoriza — nunca rótulo de aresta. Está visível na Log Archive do
`landing-zone.png`.

As outras duas são degraus de uma escada, e a escada é a hierarquia de fallback
de 6 níveis do `§6.4`, aplicada na ordem, parando na primeira que serve:

```
1. não desenhe                     vista consolidada (E1)   ← implementado
2. callout numerado, sem linha     relação narrável (E2)    ← fora da escolha automática, de propósito
3. aresta agregada + rótulo        fan-in N→1 (E3)          ← implementado
4. canaleta / barramento           N irmãs, MESMO vínculo (E4) ← implementado
5. hub central + raios             N→M com entidade central
6. aresta direta, nó na calha      2 contas (E10)           ← implementado
```

Os quatro implementados têm modelo próprio, e é assim que se sabe que estão
implementados de verdade: `logs-centralizados` (3), `hub-tgw` (4),
`plataforma-3-contas` (6) e `landing-zone` (1). Os dois primeiros existem porque
a revisão do próprio diff achou **bugs latentes** neles — o barramento era
desenhado fora da caixa `AWS Cloud` e o rótulo da agregada transbordava por cima
do ícone de destino, porque as reservas de espaço só cobriam o nível 6. Código
que nenhum modelo exercita é código que não foi escrito.

O **nível 2 fica fora da escolha automática de propósito**: "narrável" não é um
fato do modelo, é um julgamento sobre a prosa que acompanha a figura, e o IR não
tem — nem deveria ter — onde afirmá-lo.

> #### O achado que os testes forçaram: mesma origem não basta
>
> A leitura ingênua de `E4` é "mesma origem alcançando ≥2 contas irmãs → barramento".
> O modelo de três contas quebrou isso na primeira rodada: o ECS fala com o
> Transit Gateway (atracamento de VPC) **e** com o event bus (PutEvents). Mesma
> origem, duas contas de destino — e um barramento ali **mente**.
>
> `E4` sai do AMS MALZ, onde a barra carrega **um vínculo só** ("estas contas
> pertencem a esta OU"), e 1 linha + N stubs é fiel porque o vínculo é
> literalmente o mesmo. Desenhar uma barra ligando atracamento e PutEvents
> afirmaria que as duas contas recebem a mesma coisa. `E3` tem o mesmo problema
> pelo outro lado: colapsar um fan-in em uma aresta rotulada só é honesto se o
> texto valer para todas as origens.
>
> **Condição acrescentada: o barramento e a agregação exigem que as travessias
> sejam a MESMA RELAÇÃO** — mesmo par (rótulo, protocolo). Dois casos de
> `check-gatilhos.cjs` fixam isso nas duas direções.

**E a canaleta apareceu por um segundo motivo, que a pesquisa não previa.**
`X3` descreve a canaleta como faixa paralela à fileira, deslocada para **fora**
dela, para o caso "N irmãs recebem o mesmo vínculo". Acontece que o mesmo
mecanismo resolve outra coisa: **a travessia que não cabe no eixo**. No segundo
render, `ECS → Transit Gateway` (que vai *para trás* na fileira) saiu em linha
reta, cortou a VPC de aplicação inteira e largou o rótulo em cima do ícone do
ALB — `A3.2` e `A5.5` de uma vez. Tirar a linha de dentro das caixas é o ponto
dos dois casos, então a canaleta serve aos dois:

- **canaleta de baixo** — travessia entre contas que não são vizinhas-adiante;
- **canaleta de cima** — o que entra de fora (o ator, a internet) e teria de
  furar conta alheia para chegar.

Duas faixas, uma de cada lado da fileira, ambas **dentro** da caixa `AWS Cloud`
(desenhar uma ligação entre contas AWS fora dela é uma mentira pequena, mas é
mentira). E a saída do nó é sempre **horizontal, pelo lado limpo** — nunca
vertical: o caminho curto descia por dentro das caixas irmãs.

`check-travessia.cjs` confere isso no arquivo emitido, e traz **experimento de
controle**: a mesma rotina recebe a rota ingênua e tem de acusar. Uma checagem
geométrica que só sabe passar pode estar medindo a coisa errada e concordando
consigo mesma.

### 5 · Quando o diagrama satura e precisa quebrar em múltiplas páginas?

**A quebra não é gatilho de saturação — é estrutural, e acontece sempre.**

O `D2` é explícito e a estrutura do PPTX oficial do SRA prova: slide 3 é a
consolidada (6 contas, **zero** conectores) e os slides 7–12 são uma conta cada,
com 2 a 7 conectores intra-conta. **As duas coisas são publicadas ao mesmo
tempo.** O corte não acontece "quando fica cheio demais".

O motor emite um `.drawio` com **1 + N páginas**: a consolidada e uma vista de
detalhe por conta. O `<diagram>` repetido é aba de página no app — o formato já
suportava, ninguém tinha usado.

O que a saturação decide é outra coisa: **qual modo**. `D1` mediu que o que
estoura a página não é a contagem de contas, é a de **arestas** — e é por isso
que o limite de travessias (≤7) está no gatilho de modo, não num "se não couber,
quebre".

> **A vista de detalhe é a melhor prova de que a fronteira do motor está no
> lugar:** ela é *o mesmo motor rodando num submodelo*. `paginasDeDetalhe` não
> sabe desenhar nada — recorta semântica e chama o pipeline de novo. As
> travessias viram **texto** na vista de detalhe, que é o mecanismo do `E3`
> ("o texto substitui a cardinalidade"), não uma simplificação nossa.

---

## A dívida herdada do #11: a grade transposta

O #11 fechou antes do [#21](https://github.com/ThiagoPanini/panlabs-skills/issues/21)
e deixou a grade de AZ no eixo antigo — AZ em colunas, a orientação do #19. O
comentário de abertura deste ticket herdou a dívida com a sequência certa:
decidir a conta primeiro, transpor depois, para não refazer duas vezes.

**Ao pagar, a dívida acabou sendo menor do que a manchete do #21 sugere** — e a
razão está no próprio #21, uma linha abaixo da manchete:

> Quando as **duas** dimensões estão presentes, a ordenada fica com a horizontal
> e a paralela vira raia. Passo numerado é ordenado; réplica zonal é
> intercambiável. **Sem fluxo numerado, a AZ pode ficar com a coluna, como no deck.**

Então não era "transponha tudo": era **"o motor tem de saber os dois eixos, e a
escolha entre eles é regra"**.

```
eixo = 'raia'    (fluxo na horizontal, AZ empilhada)   há passo numerado
       'coluna'  (AZ em coluna, como o deck e o #19)   não há
```

`web-multi-az.json` (#11) não tem aresta nenhuma → continua em coluna, geometria
**byte a byte idêntica**. `web-fluxo-3-az.json` (aqui) tem passo numerado → sai
transposto. O mesmo motor, os dois desenhos, nenhuma opção de agente.

A grade agora é escrita em coordenadas abstratas — `principal` (os papéis de
subnet, o eixo do fluxo) e `transversal` (as zonas) — e só no fim mapeada para
(x, y). **Transpor é trocar o mapeamento**, não reescrever a grade. As VPCs
empilham ao longo do principal, porque a faixa de zona atravessa todas elas e
corre nessa direção.

### O que a transposição cobrou

**1 · A quinta calha do #21, e ela é um máximo de somas.**

> A calha só empilha se as bandas se sobrepõem no eixo transversal; lado a lado
> dividem.

A regra do #19 cobrava a calha na primeira linha que a faixa toca e ficava no
**máximo** entre as faixas daquela linha — certo para faixas lado a lado, errado
para faixas que se sobrepõem, porque essas precisam de espaço uma *depois* da
outra. Vira: para cada posição transversal, some as calhas das faixas que
começam naquela linha **e** cobrem aquela posição; a calha da linha é o maior
desses totais. **Lado a lado, cada posição só vê uma faixa e a soma degenera no
máximo de antes** — a regra velha é o caso particular desta, que é por que
trocar uma pela outra não moveu nenhum desenho existente.

**2 · Uma sexta calha, que é nova.** Com a AZ em coluna, o rótulo de todas as
zonas cabe numa tira só acima da grade (`AZ_LANE`). Transposta, **cada raia
precisa da própria tira**, porque há uma banda por linha. A reserva deixa de ser
global e passa a viver no vão entre as raias.

**3 · A calha da faixa é cobrada no eixo mapeado em Y, não no principal.** O
rótulo da faixa é desenhado no topo dela — em −Y, sempre. Com a AZ em coluna,
Y é o principal; transposta, Y é o transversal. Ignorar isso foi visível no
primeiro render: o Auto Scaling group subiu o próprio rótulo para dentro da
faixa de título da VPC, e o gap entre as colunas de papel ganhou 49 px que
ninguém pediu. Depois disso, o rótulo do ASG e o da raia ainda caíam na **mesma
linha** — e a correção é a mesma regra do item 1, aplicada entre uma banda
*derivada* e uma banda de *membros*: elas se sobrepõem, então empilham.

**4 · O gap principal passa a caber o rótulo da aresta.** Com a AZ em coluna, o
principal é o Y e 14 px bastam para separar caixas. Transposta, o principal é o
X e é exatamente ali que o rótulo do passo numerado é desenhado. É o mesmo
achado do #11 no caminho do ELK ("entregue o rótulo ao layout"), só que aqui não
há ELK para entregar: quem reserva é a grade.

**5 · A grade passou a desenhar aresta.** O #11 deixou o caminho da grade sem
arestas de propósito — o #6 tinha medido que o diagrama multi-conta carro-chefe
da AWS não tem nenhuma, e o eixo estava em aberto. Com o eixo decidido pela
presença de **passo numerado**, não desenhar o passo tornaria a escolha de eixo
inconferível. A ordem das raias sai por varredura minimizando `A5.5` — no modelo
de três zonas, ela acha custo **zero** pondo `us-east-1a` no meio. Note que o
#21 avisa que a *heurística* "alvo da convergência no meio" apenas troca um
cruzamento por outro; aqui o mesmo arranjo foi **medido**, não suposto.

---

## O que este protótipo descobriu

### 1 · A ordem dos irmãos também tinha de ser derivada

O #11 derivou a ordem das **linhas** da grade pela incerteza 4 do
[#7](https://github.com/ThiagoPanini/panlabs-skills/issues/7) — quem escreve o
modelo é um agente, e nenhum LLM emite a mesma lista duas vezes na mesma ordem.
O que passou batido é que a lista de **filhos** tem o mesmo problema, e ele só
aparece quando um container tem irmãos que **nenhuma aresta liga**: o ELK
layouta por camada a partir das arestas, e onde não há aresta o desempate é a
ordem de entrada.

Medido na landing zone: a conta Org Management tem `Organizations` e
`Control Tower` sem aresta entre eles, e embaralhar `nos` trocava os dois de
lugar. Agora a ordem dos irmãos é derivada (exposição, depois rótulo) e os cinco
modelos passam na reordenação.

**E a ordem das ARESTAS também.** Aqui a geometria não muda — o que muda é a
ordem das células no arquivo. Custa duas coisas concretas: o diff do `.drawio`
fica sujo sem um pixel ter se mexido, e **ordem do documento é ordem Z**, então
duas arestas que se cruzam trocam de "quem passa por cima" entre execuções. O
caminho do ELK escapava porque quem devolve a lista de arestas é o ELK, em ordem
própria; os caminhos novos iteram o modelo.

### 2 · A aresta que não tem dono some — em silêncio

`planoDeContas` desenhava as arestas **internas** de cada conta (pelo ELK de
dentro dela) e as **travessias** (pela política). Uma aresta do ator para um nó
dentro de uma conta não é nenhuma das duas: não tem conta dos dois lados, e o
ELK de conta nenhuma a viu. Ela simplesmente **não apareceu no render** — o
"1. HTTPS" do cliente para o ALB não existia no desenho, e nada avisou.

É `A4.2` da rubrica: omissão calada. Vale como aviso de método para o resto do
motor — **toda partição de responsabilidade precisa de um caso `else` que
falhe ou desenhe, nunca de dois `if` que se acham completos.**

### 3 · A armadilha mais cara: higiene de processo no render

`UnknownVizError` no draw.io headless **não encerra o processo** — vira
`UnhandledPromiseRejection` e o binário fica pendurado para sempre. E `timeout`
mata o `xvfb-run`, não os filhos dele. Cada render que estourava deixava um
`Xvfb` e um `drawio` vivos.

Depois de meia dúzia deles, **arquivos que rendiam passam a falhar**. O
diagnóstico foi ao lugar errado por horas: uma bisseção acusou "quase qualquer
célula que eu remova conserta", que é a assinatura de um limiar, não de uma
célula ruim. O arquivo estava certo o tempo todo; a máquina é que estava
saturada.

Duas consequências para o motor de verdade:

- **`limpar-render.sh` antes de cada medição.** Comparar renders exige ambiente
  comparável.
- **`pkill -f "$(basename "$ENTRADA")"` é uma armadilha em si:** o nome do
  arquivo aparece na linha de comando de **quem chamou** o script, e o pkill mata
  o chamador junto. O lote parava na terceira linha, sem erro nenhum.

E o achado que fecha o diagnóstico: `UnknownVizError` **não existe no
`app.asar`** do draw.io — só no binário do Electron. É erro do Chromium, não do
draw.io. Procurar no lugar certo teria economizado a bisseção inteira.

---

## O que ficou aberto, de propósito

- **A vista de detalhe de uma conta com faixa de AZ não sai.** O caminho da
  grade sabe desenhar `nuvem › VPC › subnet` e recusa conta como container raiz.
  Quando isso acontece, a página daquela conta é **omitida com aviso nomeado**,
  nunca em silêncio. Unificar os caminhos B e C é trabalho de outro ticket — e a
  decisão de qual container manda na grade já está tomada aqui (o mais externo
  que precisa de grade).
- **Níveis 2 e 5 da hierarquia de travessia não são desenháveis ainda.** O 2 por
  decisão (não é fato do modelo); o 5 porque nenhum modelo do corpus o exercitou.
  A `politicaDeTravessia` nunca os devolve, então não há caminho que os alcance
  em silêncio.
- **A OU não aninha.** `ou` é uma string, e a árvore real do Organizations tem
  OU dentro de OU. Nenhum diagrama de arquitetura oficial desenha esse
  aninhamento (`G2` — a OU nem caixa tem), então o IR não paga por ele antes de
  alguém precisar.
- **`X7` (multiplicidade anotada) e `D4` (truncamento com `....` / `⋮`) não foram
  implementados.** São a resposta da AWS para cardinalidade *indeterminada*, e
  nenhum dos modelos aqui tem essa forma. Ficam como entrada para o ticket que
  tratar de escala.
- **O desempate alfabético dos papéis de subnet continua placeholder**, herdado
  do #11 e pelo mesmo motivo: ordenar camadas privadas por significado exige um
  fato que o IR ainda não tem.
