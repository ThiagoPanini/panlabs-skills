# O corpus de validação — o critério, escrito antes de rodar

Este arquivo nasce em duas partes e **nesta ordem**, e a ordem é a garantia: o
critério é commitado sozinho, antes de existir corpus novo, antes de existir
gatilho calibrado, antes de qualquer medição de aceitação. O git prova que
nenhum número aqui foi escolhido depois de ver o resultado.

> Ticket [#26](https://github.com/ThiagoPanini/panlabs-skills/issues/26).
> A segunda parte — **o que o corpus disse** — entra abaixo, em commit posterior.

---

# Parte 1 · O critério

## Por que um critério escrito antes

Um corpus sem critério prévio mede o que ele já sabia entregar. Este repositório
já pagou essa conta duas vezes, e as duas estão registradas: o `A4.1` do
[#23](https://github.com/ThiagoPanini/panlabs-skills/issues/23) media **o motor
contra ele mesmo** (limiar 12 px = o `PAD` do próprio motor, 77 ocorrências
reportando exatamente 8), e o [#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17)
tinha 24 checagens estáticas verdes sobre um ícone errado.

Uma checagem que não sabe falhar não é uma checagem. Um corpus que não sabe
reprovar não é um corpus.

## § 1 · O que "aprovado" significa, caso a caso

Um caso do corpus está **aprovado** quando as cinco valem. Nenhuma é opcional, e
nenhuma é julgamento.

| | condição | como se confere |
|---|---|---|
| `C1` | o motor gera, ou **recusa por desenho** | `motor/gerar.cjs` sai 0; os casos de `modelo/recusa/` declaram a recusa esperada e a mensagem que a nomeia |
| `C2` | **nenhuma falha semântica** | `semanticas.length == 0` — `A4.2`, `A4.4`, `A5.5` e `F1`, as quatro de tolerância zero |
| `C3` | **o laudo está completo** | as 8 famílias rodaram. Um laudo incompleto nunca passa, em nenhum nível — a garantia do [#18](https://github.com/ThiagoPanini/panlabs-skills/issues/18) que o enxerto do #23 já engoliu uma vez |
| `C4` | **toda falha fora do piso está nomeada** | o piso está em `guia/laudo.md`; qualquer falha além dele precisa de entrada escrita no §5 deste arquivo, com motivo. Falha não nomeada = caso reprovado |
| `C5` | **determinismo** | duas gerações do mesmo modelo saem byte a byte idênticas |

**`C4` é o que faz o corpus medir alguma coisa.** Sem ele, "tem falha" é o estado
natural — os modelos do corpus têm de 4 a 9 falhas cada um — e a régua não
distingue nada. Com ele, cada falha ou está no piso conhecido ou tem dono.

## § 2 · O piso — o que NÃO conta contra o caso

Herdado de `guia/laudo.md`, medido nos 15 modelos que já existiam. Repetido aqui
porque um critério que aponta para outro arquivo é um critério que se afrouxa
sozinho.

| | por quê |
|---|---|
| `A1.2` `A1.3` | nenhum diagrama emite legenda — o motor não tem legenda |
| `A1.11` | `modelo@1` é `additionalProperties: false` e não tem `data`/`versao`/`autor` |
| `A1.5` `A1.12` | sempre que houver nota com `sobre` — as duas checagens não conhecem a classe "nota desenhada" |
| `A7.2` | o quadrado do ícone contra o tingimento de subnet, 2,71:1 — leitura de **traço** aqui, de **área** no portão do tema |
| `A7.4` `A3.9` | `calibravel`, limiar default de engenharia |
| `A4.5` | padding de grupo uniforme |
| `A3.7` | o caminho da grade dimensiona a largura só pela nuvem |
| `A5.7` | avisa de propósito desde o [#24](https://github.com/ThiagoPanini/panlabs-skills/issues/24): o eixo segue o dado, e a seta da consulta aponta para trás — que é o que ela é |

Tudo o mais é `C4`.

## § 3 · A cobertura de gênero — e o que cada gênero tem de EXERCITAR

Cobertura **não** é um arquivo por gênero. É um arquivo por gênero que põe sob
carga o mecanismo que aquele gênero implica — senão o corpus tem sete rótulos e
um caminho de código.

| | gênero | o mecanismo que o caso tem de exercitar |
|---|---|---|
| `L1` | blocos lógicos / capacidades | vista lógica **sem passo numerado** — o regime em que `eixoDaGrade` devolve `coluna`, e agrupamento por fronteira de responsabilidade |
| `L2` | fluxo de dados lógico | vista lógica **com** `ordem` — `eixoDaGrade` devolve `raia` sem nenhuma AZ envolvida |
| `T1` | referência com consciência de rede | árvore `nuvem › vpc › subnet` + a dimensão `az`, com o caminho da **grade** (não o do ELK) |
| `T2` | pipeline de dados | cadeia de ≥4 serviços gerenciados **fora de VPC** — o caminho do **ELK**, e a categoria AWS decidindo camada onde não há subnet |
| `T3` | event-driven / serverless | **leque assíncrono**: uma origem de evento para ≥2 consumidores, com fila morta declarada em um e ausente em outro |
| `T4` | fluxo de requisição numerado | `ordem` em toda aresta **e** faixa de AZ na mesma página — os dois disputando a horizontal (#21) |
| `T5` | multi-account | os **dois** modos derivados do #12 — integração (travessia desenhada) e inventário (`E1` suprime) — e a faixa de OU |

Além dos gêneros, um eixo que não é gênero nenhum e sem o qual a calibração 1
não tem o que medir:

| | o que o corpus precisa ter |
|---|---|
| **densidade do leque** | modelos cujo grafo de travessia entre zonas **não cabe numa reta** — o caso em que nenhuma permutação de raia zera o `A5.5` |

## § 4 · As duas calibrações — o que conta como resposta

A parte nova do ticket. Escrever aqui o que conta como resposta é o que impede a
resposta de ser desenhada em volta do resultado.

### 4.1 · O gatilho da vista de zona de referência (#21)

O [#21](https://github.com/ThiagoPanini/panlabs-skills/issues/21) decidiu que
apagar a aresta que cruza zona — a saída do [#6](https://github.com/ThiagoPanini/panlabs-skills/issues/6)
aplicada à zona — é **fallback, não default**, e que o disparo tem de vir do
**validador**, não de constante mágica. Ficou pendente *qual checagem e qual
limiar*.

**Conta como resposta** quando as quatro valem:

| | |
|---|---|
| `Z1` | a checagem é uma que o validador **já calcula** — não uma métrica nova inventada para este gatilho |
| `Z2` | o limiar é **derivado**, não escolhido: ou é a tolerância que a própria rubrica já fixa para aquela checagem, ou tem medição do corpus por trás |
| `Z3` | existe caso do corpus em que o gatilho **dispara** e caso em que **não dispara**, e a diferença entre os dois é a densidade do leque — não uma flag no modelo |
| `Z4` | quando dispara, a supressão é **dita**, não silenciosa — o motor recusa mentir por ausência em todo o resto, e não pode abrir exceção aqui |

**Conta como NÃO ter respondido:**

- o gatilho nunca dispara no corpus — aí ele é infalsificável, e o honesto é
  registrá-lo como névoa nomeada em vez de embarcá-lo como calibrado;
- o gatilho dispara sobre um desenho que já era verdadeiro — um fallback que
  dispara sem precisar é um fallback que **apaga aresta verdadeira**, e isso é
  pior que o cruzamento que ele evita.

### 4.2 · Os limiares da revisão de lacunas (#15)

A política está decidida no [#15](https://github.com/ThiagoPanini/panlabs-skills/issues/15):
bloqueia **em bloco, uma vez só**, relata e nunca conserta calado. O que ficou
pendente é o limiar — as regras do protótipo dispararam **4 achados num modelo de
3 nós**.

**Conta como resposta** quando as quatro valem:

| | |
|---|---|
| `L1` | toda regra tem **pré-condição escrita**: o modelo afirma a estrutura sobre a qual a regra fala. Onde o modelo não afirma, a regra é **muda** — e quem cala não vota (#22) |
| `L2` | toda regra **dispara em ≥1 modelo do corpus** — regra que nunca dispara nunca foi testada |
| `L3` | toda regra é **muda em ≥1 modelo do corpus** — regra que dispara em todos não está medindo nada, está afirmando uma constante |
| `L4` | nenhum modelo do corpus produz mais achados que **⌈nós ÷ 4⌉** |

`L2` e `L3` juntos são o guarda: uma regra tem de saber dizer sim e saber dizer
não, contra o mesmo corpus. É a forma da lição do #23 — *a checagem que não sabe
falhar não é uma checagem* — aplicada à outra ponta.

`L4` é o teto, e o número sai do próprio ticket: o protótipo fez **1,33 achado por
nó**. Um a cada quatro nós é uma ordem de grandeza abaixo, e é o que separa
"consultor que aponta o que importa" de "linter que o usuário aprende a ignorar".

> **Se o teto não for atingível, o critério não se ajusta.** A razão vira achado
> registrado, e a regra que estoura vira refino conhecido (premissa 12 do mapa).
> Baixar a régua depois de ver o número é exatamente o que este arquivo existe
> para impedir.

## § 5 · O arco ponta a ponta

O ticket pede a skill rodando *necessidade vaga → sabatina → candidatas →
aprovação da vista lógica → vista técnica → `.drawio`*.

| | condição |
|---|---|
| `E1` | o arco roda contra um caso que **não existia antes deste ticket** — validar o arco contra a própria fixture dele não mede nada |
| `E2` | cada um dos 7 passos do `SKILL.md` fecha na condição escrita **dele**, e não em julgamento |
| `E3` | `conferir(aprovado).ok` é verdadeiro depois de a fase técnica ter enfiado VPC e subnet entre a folha e a fronteira |
| `E4` | o `.drawio` final passa em `--portao veracidade` |
| `E5` | a cópia publicada existe e o selo dela diz que **não retoma** |

## § 6 · A instalação

| | condição |
|---|---|
| `I1` | `~/.claude/skills/panlabs-aws-diagrams` e `~/.agents/skills/panlabs-aws-diagrams` resolvem para a skill deste repo |
| `I2` | `agents/openai.yaml` existe e segue a forma que os outros skills da casa usam |
| `I3` | um comando da skill roda **a partir do caminho instalado**, não do repo — é o que prova que a premissa 7 sobreviveu |

## § 7 · O que este critério NÃO promete

Nomeado agora, para não virar surpresa depois:

- **não** promete que o corpus é representativo de arquitetura de produção — ele
  é sintético, escrito por quem escreveu o motor, e a premissa 12 do mapa já diz
  que a rubrica se refina **depois** das primeiras execuções reais;
- **não** promete inspeção visual de todo caso novo — o render é dependência de
  desenvolvimento (premissa 8), e o corpus tem caso de 24 checagens estáticas
  verdes com o ícone errado. Onde o olho não passou, isto fica dito;
- **não** promete que os cinco eixos de forma da sabatina são os certos — o #15
  já registrou que cinco *bastaram*, não que cinco *são*.

---

# Parte 2 · O que o corpus disse

> Escrita **depois** de rodar. A Parte 1 foi commitada sozinha, antes de existir
> modelo novo — `git log` é a prova de que nada aqui foi desenhado em volta do
> resultado.

## § 8 · A cobertura, fechada

Seis modelos entraram. Os três primeiros fecham gêneros que estavam em **zero**;
o quarto não é gênero nenhum, é o eixo de densidade sem o qual a calibração 1 não
teria o que medir; os dois últimos nasceram de regras que o próprio critério
cobrou.

| | modelo | por que ele existe |
|---|---|---|
| `L1` | `logica-atendimento` | blocos e fronteiras **sem passo numerado** — o regime em que `eixoDaGrade` devolve `coluna` |
| `T2` | `pipeline-analitico` | 6 serviços gerenciados **fora de VPC**, o caminho do ELK sem árvore de rede |
| `T3` | `eventos-fanout` | leque assíncrono: 3 consumidores, 2 com fila morta e **um sem** |
| — | `quorum-3-az` | **densidade**: réplica entre todos os pares de zona, grafo de travessia em triângulo |
| `T1` | `loja-banco-exposto` | o `L2` do §4.2 cobrou: `dado-em-subnet-publica` não tinha sujeito no corpus |
| — | `frota-preditiva` (sessão) | o `E1` do §5 cobrou: o arco precisa de um caso que não existia antes |

Os sete gêneros da v1 agora têm modelo: `L1`×1 `L2`×1 `T1`×9 `T2`×1 `T3`×1
`T4`×1 `T5`×4, mais 2 de recusa e 2 pares de sessão.

## § 9 · O que o corpus reprovou, e o que foi consertado

**Dois defeitos vivos**, os dois achados por modelo novo, os dois com o mesmo
formato — *a checagem que não sabe falhar*, o padrão que o #23 nomeou.

### 9.1 · O guarda do encaixe era cego em dois dos quatro lados

`temSobreposicao` (`motor/alinhar.cjs`) media só `bottom` e `right`. A assimetria
não era decisão: o passe nasceu movendo coluna para **baixo**, e um filho que
desce só pode sair pelo pé do pai. Mas `delta` é `cy(u) − cy(v)` e é negativo com
a mesma frequência.

No `eventos-fanout`, três encaixes de −13, −27 e −6 px empurram a coluna das
filas mortas **46 px acima** do lugar dela, e `dlq-estoque` termina **7 px acima
do topo da própria região**: `A4.4`, falha **semântica** — o desenho afirmando
que a fila morta não está na região. `refitar` não cobria por acidente: ele só
**cresce** o container, e crescer resolve quem passa do pé, nunca quem sai pelo
topo.

A conta da correção, medida com o controle nas duas versões do guarda:

| | antigo | novo |
|---|---|---|
| `eventos-fanout` | 5 falhas, **1 semântica** | 3 falhas, **0 semânticas** |
| `varejo` / processamento | 10 avisos | 11 avisos (`A6.4`, calibrável) |
| os outros 18 modelos e as outras 4 páginas do varejo | — | **idênticos** |

Um aviso de limiar não-medido por uma falha semântica. E vale um aviso de método:
a **primeira** versão desta medição se envenenou — o script tirava o snapshot do
guarda "novo" do próprio arquivo de trabalho, que estava no meio de uma troca, e
mediu o guarda antigo duas vezes concluindo *"nada mudou"*. As duas versões
passaram a vir de fontes que o script não escreve (o índice do git e `HEAD`), com
uma sonda de sanidade antes de medir.

### 9.2 · O `spof` era ansioso de três jeitos, e cada um saiu de um modelo

Calibração 2 inteira está no §11; aqui fica o que o corpus **reprovou**.

## § 10 · Calibração 1 — o gatilho da vista de zona de referência

**Resposta curta: a checagem não existia, e o defeito que ela mediria não acontece
neste motor.**

### 10.1 · A checagem — e por que ela não existia

`A5.5` varre `cena.grupos`. A faixa é **outra classe** (`cena.faixas`), e ficou
fora das 62 por decisão explícita do #18: *a rubrica modela uma árvore de
contenção, e o motor desenha duas coisas*. Só que dessa decisão apenas `F1`
chegou a ser escrito — a pergunta de **contenção** da faixa. A pergunta de
**travessia** ficou sem dono.

Resultado medido: o motor era **estruturalmente cego** ao defeito que o fallback
do #21 existe para evitar. Nenhuma checagem media a aresta cortando a faixa
alheia — nem para disparar o fallback, nem para pegar a regressão.

> **`F2` — aresta atravessando faixa alheia.** Predicado literalmente o de
> `A5.5` (polilinha cruzando uma caixa com a qual a aresta não tem relação),
> trocada a classe `grupo` pela classe `faixa`. Semântica, tolerância **zero**.
> Fora das 62 de propósito, como `F1`, pelo mesmo motivo de higiene.

⚠️ **Isto é uma flexibilização do `Z1`, e ela está sendo dita em vez de
escondida.** O `Z1` pedia uma checagem que o validador **já calculasse**. `F2` é
nova. O que a medição mostrou é que a checagem necessária estava **faltando**, não
apenas não-escolhida — e a métrica não é nova, é a de `A5.5` sobre a classe que o
#18 tinha posto de lado.

### 10.2 · O limiar — zero, e ele não é inventado

É a tolerância que a própria rubrica fixa para a família semântica. Nenhuma
constante nova entrou.

### 10.3 · A densidade, medida — e a surpresa

`tools/medir-leque.cjs`, malha **completa** de 3 a 6 zonas (cada broker falando
com todos os outros):

| zonas | travessias | piso previsto | **`F2` medido** | `A3.2` |
|---|---|---|---|---|
| 3 | 6 | 2 | **0** | 2 |
| 4 | 12 | 8 | **0** | 5 |
| 5 | 20 | 20 | **0** | 12 |
| 6 | 30 | 40 | **0** | 25 |

O **piso** é a previsão de `ordemDeRaias` (`|i−j| − 1` por aresta, minimizado
sobre as permutações) — e ela nasceu num mundo anterior ao
[#24](https://github.com/ThiagoPanini/panlabs-skills/issues/24), em que a aresta
ia reto de coluna a coluna. O roteamento de hoje leva a aresta longa para a
**borda externa** das faixas: no `quorum-3-az` a perna horizontal sai em `y=367`,
que é exatamente o pé das três bandas. O piso conta um cruzamento que o desenho
não faz mais.

**E o olho confirma.** No render do `quorum-3-az` as duas arestas longas descem e
correm por fora das faixas em vez de cortar a do meio — `F2 = 0` é verdade no
pixel, não só na medição. No mesmo render, os dois rótulos *"busca réplica"*
colidem no rodapé: é o `A3.2` da tabela acima, visto.

### 10.4 · O que sobra, e o que fica de névoa

O que cresce com a densidade é **legibilidade**, não veracidade — `A3.2` de 2 a
25. E isso reenquadra a pergunta do #21 uma volta abaixo dela mesma: o #21 já
tinha medido que *"o validador do #8 é cego a esta pergunta, que nunca foi sobre o
diagrama mentir"*; o #26 mede que, depois do #24, ela também **não é mais sobre a
aresta cruzar**.

### 10.5 · O placar honesto contra o §4.1

Duas das quatro condições que eu mesmo escrevi **não** foram cumpridas, e o
registro vale mais que a nota:

| | condição | veredito |
|---|---|---|
| `Z1` | a checagem já é calculada pelo validador | ✗ **relaxado** — `F2` é nova. A justificativa está em 10.1: ela estava *faltando*, não *não-escolhida*, e a métrica é a de `A5.5` |
| `Z2` | limiar derivado, não escolhido | ✓ zero, a tolerância da família semântica |
| `Z3` | um caso do corpus dispara, outro não | ✗ **não cumprido** — `F2` = 0 em **todos**, e o único caso que dispara é **plantado** |
| `Z4` | quando dispara, a supressão é dita | — inaplicável: não há supressão, porque o fallback não foi construído |

`Z3` não cumprido é exatamente a cláusula de *"não ter respondido"* do §4.1: um
gatilho que nunca dispara no corpus é infalsificável, e o honesto é registrá-lo
como névoa nomeada em vez de embarcá-lo como calibrado. **É o que foi feito.**

O que a `AC 4` do ticket pede literalmente — *"checagem e limiar nomeados"* —
está entregue: `F2` e zero. O que ela pede implicitamente — um gatilho calibrado
**contra o corpus** — não está, porque o corpus não consegue produzi-lo. Essa
metade é respondida pela `AC 7`, no §13.

Então:

- **`F2` entra armada e calada.** O que ela compra é a regressão: no dia em que
  uma mudança de roteamento reintroduzir o cruzamento, o portão `veracidade`
  barra em vez de o desenho sair mentindo. O corpo de prova é **plantado**
  (`tests/casos/quebrados.cjs`), pelo mesmo argumento que o #24 usou para `A5.5`
  — checagem que nenhum modelo do corpus produz, se não for cobrada no caso
  plantado, não é cobrada em lugar nenhum.
- **O fallback em si NÃO foi construído**, e isso é o `Z`-negativo do §4.1
  aplicado a si mesmo: precondição falsa em toda densidade medida. Fica névoa
  nomeada, com o número que a reabre — `F2 > 0` em qualquer modelo.
- **A pergunta sucessora tem nome e não tem medição**: se um dia se quiser
  suprimir a travessia de zona, o gatilho mora no eixo da **legibilidade**, e
  nenhum limiar de `A3.2` foi medido contra corpus de desenho profissional. O #6
  já dizia isso do lado das contas — a AWS suprime a aresta por **espaguete**,
  não por mentira.

## § 11 · Calibração 2 — os limiares da revisão de lacunas

**Resposta curta: 1,33 achado por nó virou 0,101. Treze vezes menos.**

E o que consertou não foi apertar número. Três das quatro regras do protótipo
disparavam sobre **ausência** (*"nenhum componente declara redundância"*), e regra
que dispara sobre ausência dispara em todo modelo pequeno — porque modelo pequeno
é quase todo ausência. Daí 4 achados em 3 nós.

> **Um achado só nasce sobre um fato que o modelo AFIRMA, nunca sobre um fato que
> ele não menciona.**

Cada regra declara a estrutura de que precisa. Onde o modelo não afirma, a regra
sai **muda**, com o motivo — *"não acusou"* não pode se confundir com *"não
rodou"*. É o *quem cala não vota* do #22 na outra ponta.

### 11.1 · Os três limiares medidos, e o falso positivo que cada um matou

Nenhum foi escolhido. Cada um saiu de um modelo concreto reprovando.

| limiar | o falso positivo que ele matou |
|---|---|
| `spof` orfana **≥2** | num encadeamento `A→B→C`, dizer que B é o ponto único de falha de C é só dizer que **C tem um vizinho**. O `pedidos-serverless` acusava o VPC endpoint por "separar" o DynamoDB |
| egresso conta **ligado**, não só contido | no `hub-tgw-3-contas` o Transit Gateway **é** a saída controlada e mora **fora** das VPCs que serve. A regra reprovava as duas spokes pelo motivo que as torna certas |
| `spof` **só os maximais** | a `frota-preditiva` é uma cadeia, e numa cadeia toda ligação é ponto de articulação com os órfãos **encaixados**. Acusava **seis** num modelo de 11 nós — pior que o protótipo que motivou tudo isto |

O terceiro só apareceu porque o `E1` do §5 obrigou o arco a rodar contra um caso
**novo**. Um corpus feito só de arquiteturas em leque nunca teria mostrado.

### 11.2 · Nenhuma lista inventada

`"guarda estado"` é `dados` na tabela de categoria AWS do #22 — a mesma que decide
o andar da subnet. `"fila"` é `application_integration`. E **fila morta é
derivada**: o que recebe o refugo de uma fila é *outra fila do mesmo serviço*. Por
isso o `eventos-fanout` acusa exatamente **um** dos três consumidores — o único
sem destino de falha —, em vez de três.

### 11.3 · A régua cobra dos dois lados

`tests/check-lacunas.cjs`: toda regra tem de **disparar em ≥1** modelo **e calar
em ≥1**. Regra que dispara em todos não mede nada, afirma uma constante.

| regra | disparou | calou |
|---|---|---|
| `spof` | 7 | 15 |
| `single-az` | 2 | 9 |
| `egress-sem-controle` | 9 | 5 |
| `dado-em-subnet-publica` | 1 | 16 |
| `cross-account-sem-confianca` | 3 | 18 |
| `assincrono-sem-dlq` | 1 | 20 |

`L4`: **22 de 22** dentro do teto ⌈nós÷4⌉. Total 25 achados em 247 nós.

### 11.4 · A exceção que expirou sozinha

`plataforma-3-contas` fazia 6 com teto 5, e a entrada ficou registrada com o
motivo medido — o denominador do teto é contagem de nós, e achado escala com
**superfície** de arquitetura. Aí a cláusula dos maximais entrou e ela caiu para
4: `check-lacunas.cjs` ficou vermelho com a mensagem que ele mesmo tinha
preparado (*"ela não estoura mais: APAGUE a entrada"*), e a entrada foi apagada.
Mesma trajetória da quarentena do #23.

**A observação sobre o denominador continua valendo** e não tem mais nenhum
modelo do corpus para prová-la — fica no §13.

## § 12 · O arco, a instalação, e o olho

**O arco fecha** (`tests/check-arco.cjs`), contra `frota-preditiva`, que não
existia antes deste ticket. Diferente do varejo de propósito, para não passar duas
vezes pelo mesmo caminho de código: 1 conta contra 3, `porElk` contra
`porContas`, 1 página contra 1+N, fronteira = `grupo` contra fronteira = `conta`.

Os sete passos fecham na condição escrita de cada um, com **dois controles na
outra ponta**: mexer num rótulo aprovado tem de **quebrar** o acordo, e o arquivo
de trabalho tem de **carregar** a deliberação que a cópia publicada não carrega.
Sem os controles, as duas checagens passariam medindo nada.

> ⚠️ **Onde o arco executa e onde ele apenas confere.** `check-arco.cjs` começa no
> **passo 2**. A perna *necessidade vaga → sabatina* não é executada, e não é
> esquecimento: a sabatina é um protocolo que um **agente** conduz com um humano,
> não código — não há função a chamar entre *"quero saber que um caminhão vai
> quebrar antes"* e o primeiro fato confirmado. O que o arco faz com essa perna é
> **conferir o produto dela**: que todo fato está confirmado, que todo fato
> inferido diz de onde saiu, e que as candidatas não colapsam. Do passo 4 em
> diante tudo é executado de verdade — inclusive a revisão de lacunas, que roda o
> código e é conferida contra as decisões do dossiê.

`E3` é a prova do #14 e ela é **visível**: `pontuar-risco` foi aprovado dentro de
`analise` e a fase técnica o empurra dois níveis abaixo, para dentro de uma subnet
que a vista lógica não conhece — e `conferir()` continua `ok`.

**A instalação** (`tools/instalar.sh`) aponta em vez de copiar, e **recusa apontar
para um worktree**: `.claude/worktrees/` é apagado junto com a sessão que o criou,
e um link para lá funciona hoje e some amanhã sem avisar. Ela não acredita em si
mesma — no fim roda um comando da skill **a partir de cada caminho instalado**,
que é o que prova a premissa 7.

**O olho passou nos seis desenhos novos**, que é a metade que suíte nenhuma
substitui. O que ele viu além do que as checagens dizem:

- no `quorum-3-az`, as arestas longas **por fora** das faixas — a confirmação de
  pixel do §10.3;
- no `loja-banco-exposto`, o fluxo em zigue-zague (direita → esquerda → direita),
  porque o ALB e o banco estão na sub-rede pública e a aplicação na privada. O
  `A5.7` **avisa**, então aqui o olho e o validador concordam;
- no `frota` técnico, a VPC e a subnet aparecendo **dentro** da fronteira
  `Análise` — o nível de rede que a vista lógica não tem, desenhado sem quebrar o
  acordo.

## § 13 · O que o corpus reprovou e NÃO foi consertado

A premissa 12 do mapa pede isto **nomeado, não silenciado**. Cada linha tem o
gatilho que a reabre.

| | o que é | reabre quando |
|---|---|---|
| **o fallback de zona não existe** | `F2` está armada e calada; a supressão da aresta cross-zone não foi construída, porque a precondição é falsa em toda densidade medida | `F2 > 0` em qualquer modelo — a checagem existe justamente para avisar |
| **o limiar de legibilidade não foi medido** | o que cresce com a densidade é `A3.2` (2 → 25), e nenhum limiar dele foi calibrado contra desenho profissional | alguém quiser suprimir travessia de zona por espaguete, como a AWS faz com contas (#6) |
| **o denominador do teto de achados** | achado escala com **superfície** (contas, VPCs, pontos de entrada), não com contagem de nós. `web-fluxo-3-az` tem 20 nós e 0 achados; `plataforma-3-contas` tem 17 nós, 3 contas e 4 | um modelo do corpus voltar a estourar por superfície e não por regra ansiosa |
| **`retencao-sem-regra` não virou regra** | está no dossiê do corpus de sessão, mas retenção é fato de política que o `modelo@1` não tem onde afirmar. Sai da sabatina, não do grafo | o `modelo@1` ganhar onde declarar política de dado |
| **legenda: `A1.2` + `A1.3` em 35 de 35 páginas** | é o maior bloco de falha do corpus inteiro — **70 falhas**, duas por página, contadas em páginas e não em modelos porque o multi-conta sai em 1+N —, e nenhuma delas é o desenho mentindo. O motor não emite legenda | alguém decidir o vocabulário da legenda. O tema não contrai essa dívida **de propósito**: legenda é dívida de quem inventa notação |
| **`A7.2` em quase todos** | o quadrado do ícone a 2,71:1 contra o tingimento de subnet. O portão do tema trata como **área** e avisa; este validador trata como **traço** e reprova | as duas leituras forem unificadas — ver `recertificacao.md` §4 |
| **`A3.7` no caminho da grade** | a largura é dimensionada só pela nuvem e o desenho estoura o canvas | o caminho da grade aprender a medir a união |
| **`A6.3` em cadeia longa** | `frota` sai 5,1:1 e `logica-atendimento` 5,0:1: cadeia de 7 passos não cabe em 16:9. Aviso, e é honesto — a arquitetura **é** uma cadeia | a sabatina aprender a subtrair (*"o que sai do diagrama?"*) sobre cadeia, e não só sobre saturação |

### E um erro do próprio critério, que vale mais registrado que corrigido

A tabela do §3 diz que o `T2` exercita *"a categoria AWS decidindo camada onde não
há subnet"*. **Esse mecanismo não existe** — só subnet carrega camada
(`chaveDeIrmao` mapeia todo o resto para `SEM_CAMADA`). Escrevi antes de conferir.

O que o `pipeline-analitico` de fato exercita é o caminho do ELK com uma cadeia
longa de serviços gerenciados e **nenhuma árvore de rede abaixo da região** — que
é um caminho que o corpus não tinha, então o caso vale. Mas a frase que o
justificava estava errada, e corrigi-la em silêncio seria exatamente o que a
Parte 1 existe para impedir.

## § 14 · #31 — a faixa degrada em vez de mentir

`web-fluxo-3-az` (§8) exercita o Auto Scaling group com membros **contíguos**:
nada mais mora nas subnets que ele une. O caso de uso 2
(`docs/aws-diagrams/casos/02-ingressos/`) rodou o caso frequente que faltava —
dois membros em AZs distintas e um terceiro serviço (`fraude-a`, antifraude) na
MESMA subnet de um deles. Na grade, a caixa da faixa é a união das subnets
inteiras dos membros, não do ícone de cada um, então o vizinho caía dentro por
construção. `F1` recusava um desenho verdadeiro, e as duas correções óbvias
— mover o vizinho, ou pôr o vizinho na faixa — mentem sobre rede ou sobre
escalonamento.

A correção: quando a união abraçaria um não-membro, a faixa **degrada** — para
de ser caixa e vira o mesmo recurso do rótulo de OU (`tema.faixaRotulo`), texto
solto sem forma, na calha que já estava reservada para o rótulo dela
(`motor/planejar.cjs`, `engoleNaoMembro`). Sem caixa não há o que `F1` meça, e o
desenho para de afirmar o que o modelo nega — sem o layout aprender a
restrição de contiguidade, que fica fora de propósito (a decisão está no
[#31](https://github.com/ThiagoPanini/panlabs-skills/issues/31)).

`web-asg-com-vizinho` entra no corpus como `T4`: a mesma forma mínima do
`web-fluxo-3-az`, com o vizinho que faltava. `F1 = ok`, 0 semânticas.

`modelo/recusa/faixa-que-mente.json` continua recusado — ele usa o caminho ELK
(uma AZ só), que esta correção não toca de propósito: é o corpo de prova do
portão, e tem de continuar mentindo.
