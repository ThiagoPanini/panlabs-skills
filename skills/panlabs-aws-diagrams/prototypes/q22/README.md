# q22 · Ordem de leitura das camadas de rede

Protótipo do ticket
[Ordem de leitura das camadas de rede: o que põe a subnet de dados embaixo?](https://github.com/ThiagoPanini/panlabs-skills/issues/22).

> **Este protótipo não forka o motor — ele estende o do
> [#11](https://github.com/ThiagoPanini/panlabs-skills/issues/11), em
> `../q11/motor/`**, pela mesma razão do
> [#12](https://github.com/ThiagoPanini/panlabs-skills/issues/12): a ordem dos
> irmãos é espinha dos dois, e um fork criaria duas verdades. As suites do #11 e
> do #12 rodam como primeira camada da suite daqui.

> ### ⚠️ Este diretório substituiu uma resposta anterior
>
> O commit **`9b27d6f`** já respondia o #22 com um protótipo **autônomo** —
> `camadas.cjs` e `gerar.cjs` próprios, emissor draw.io próprio, quatro modelos.
> O cabeçalho da decisão era o mesmo desta: **derivar do conteúdo, `camada` como
> escape**. Ele foi substituído, não descartado, e o porquê está medido em
> `tools/check-standalone.cjs` — ver §6. Os arquivos continuam em `9b27d6f`.

## A resposta em uma frase

> **O que põe a subnet de dados embaixo é o que ela guarda.**

A metade da exposição estava certa e ficou: pública em cima, privada embaixo. O
que mudou é o desempate do meio — era o alfabeto, agora é a **camada de rede**,
e ela sai da **categoria AWS** de cada serviço que a subnet hospeda, que o
catálogo ([#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17)) já
sabia desde sempre. `rds` é `database`, `ecs` é `containers`, `nat gateway` é
`network_content_delivery` — três fatos que estavam no repositório e ninguém
tinha ligado ao layout.

**O agente não responde uma pergunta a mais.** Era o custo que o ticket temia na
candidata do campo semântico, e ele não se paga: a premissa 11 do mapa (máximo
AFK) fica intacta.

## Rodar

```bash
./tests/rodar.sh                                    # a suite inteira (inclui #11 e #12)
node tools/check-camada.cjs                         # só as decisões, sem pixel
node tools/check-saltos.cjs                         # a candidata rival, medida
node ../q11/motor/gerar.cjs modelo/web-dados.json --explicar   # a trilha da camada
```

## O que tem aqui

| | |
|---|---|
| `modelo/app-dados.json` | Linha 1 da tabela do ticket — a que o alfabeto acertava **por coincidência**. |
| `modelo/web-dados.json` | Linha 2 — `D` antes de `W` invertia os andares. |
| `modelo/ingest-core.json` | Linha 3 — a mais dura: nenhum dos dois rótulos contém palavra que diga andar. |
| `modelo/tres-camadas-mistas.json` | Três andares, e uma subnet que guarda **dois** (ECS + Redshift). A regra de mistura. |
| `modelo/subnet-vazia-declarada.json` | O caso da subnet vazia **depois** do escape `camada`. |
| `modelo/elk-sem-camada.json` | A mesma lacuna no caminho do ELK, onde ela **avisa** em vez de recusar. |
| `modelo/web-dados-com-fluxo.json` | Existe só para dar à candidata rival o melhor cenário dela — borda pública e arestas. |
| `recusa/subnet-vazia.json` | O modelo que **não gera**. A suite exige que ele falhe, e confere a mensagem. |
| `saida/antes-ordem-alfabetica.png` | O **antes**, e não é reconstituição — ver abaixo. |
| `tools/check-camada.cjs` | A regra isolada do pixel: tabela do ticket, leitura, mistura, escape, lacuna, controle. |
| `tools/check-saltos.cjs` | A candidata "distância da borda", medida no corpus inteiro dos três protótipos. |
| `tools/gerar-antes.sh` | Materializa o motor de `a83b48a` a partir do git e roda contra o modelo de hoje. |
| `tools/check-standalone.cjs` | A regra do protótipo substituído (`9b27d6f`), carregada do git e medida contra a que ficou. |

---

## 1 · A tabela do ticket, medida

O ticket trouxe três casos e a ordem que um arquiteto espera. A régua roda os
três e mostra as **duas** regras lado a lado — sem a coluna do alfabeto a tabela
seria afirmação, e com ela é comparação:

| modelo | conteúdo (a regra nova) | alfabeto (o placeholder) |
|---|---|---|
| `App subnet · Data subnet` | App, Data ✅ | App, Data ✅ *(acerta por coincidência)* |
| `Web subnet · Data subnet` | Web, Data ✅ | Data, Web ❌ |
| `Ingest subnet · Core subnet` | Ingest, Core ✅ | Core, Ingest ❌ |

A régua **exige** que o alfabeto acerte exatamente 1 dos 3. Se ele acertasse os
três, a tabela não distinguiria as duas regras e não provaria nada.

### O antes é o motor de antes

`saida/antes-ordem-alfabetica.png` é o **mesmo modelo** de `web-dados` rodado
pelo motor como ele estava no fechamento do #12 — `tools/gerar-antes.sh`
materializa `motor/` e `catalog/` do commit `a83b48a` com `git archive` e roda
aquele binário. Não há chave de compatibilidade no motor de hoje: o antes é o
antes, não uma imitação dele.

Ponha os dois lado a lado e a inversão aparece inteira — `Data subnet` em cima
do `Web subnet`, com o mesmo título e o mesmo conteúdo.

---

## 2 · Como a camada é lida

### A tabela de categorias, e o que ela deixa de fora

Nove das trinta categorias do catálogo têm significado de andar quando o recurso
está **dentro de uma subnet**:

| andar | categorias |
|---|---|
| **borda** — encara algo de fora | `network_content_delivery`, `security_identity_compliance` |
| **aplicação** — computa | `compute`, `containers`, `application_integration`, `front_end_web_mobile` |
| **dados** — guarda | `database`, `storage`, `analytics` |

As outras 21 **calam**, e quem cala não vota. `management_governance`,
`artificial_intelligence`, `internet_of_things` e companhia não dizem se a caixa
é borda ou fundo, e fingir que dizem seria trocar um placeholder alfabético por
um placeholder taxonômico. Uma subnet cujos membros todos calam fica sem camada
— o mesmo estado da subnet vazia.

A linha mais frouxa é `security_identity_compliance`: a categoria inteira não é
borda (IAM, KMS e Secrets Manager estão nela), mas o recorte é o que mora dentro
de uma subnet, e ali o que aparece é appliance de inspeção — Network Firewall,
WAF. Serviço regional não entra em subnet.

### A regra de mistura: vence o membro mais fundo

Uma subnet que guarda um ALB **e** um RDS é lida como camada de dados.

Não é gosto — é a regra protegendo o invariante que ela existe para proteger. O
que a convenção de rede proíbe é **subnet com banco ficando acima de subnet sem
banco**. Tomar o membro mais raso permitiria exatamente isso: bastaria pendurar
um load balancer na subnet do banco para ela subir. Tomar o mais fundo torna o
invariante impossível de violar — se guarda dado, não sobe.

`tres-camadas-mistas` é a prova: a `Analytics subnet` guarda ECS e Redshift, e
desce para o terceiro andar.

### O preço, nomeado

Uma subnet de ingestão que hospeda os **brokers** (MSK é `analytics`) é lida como
dados, e um arquiteto a quereria em cima. É o caso em que a regra encosta, e o
escape existe para ele.

### A exposição continua na frente, e isso é decisão

Uma subnet **pública** que só hospeda compute continua acima de uma subnet
**privada** que hospeda um Transit Gateway. Público em cima é o sentido de
leitura do deck; a camada ordena **dentro** dele. Inverter as duas chaves
poria a borda privada acima da aplicação pública, que é a leitura errada.

### O alfabeto sobreviveu, sem significado

Ele é o **último** desempate, e mudou de função: não carrega mais leitura
nenhuma, só fecha a ordem total entre coisas que a semântica empatou — que é o
que o determinismo exige (a incerteza 4 do #7, que o #11 fechou).

---

## 3 · O campo `camada` é escape, não pergunta

O esquema ganhou uma propriedade opcional na subnet:

```json
{ "tipo": "subnet", "rotulo": "Reserved subnet", "acesso": "privada",
  "camada": "dados" }
```

Ela **não** entra na sabatina. É para os dois casos que o conteúdo não cobre:

- **a subnet vazia** — o range reservado para o banco que ainda não existe;
- **o conteúdo que diria errado** — a subnet de ingestão com os brokers.

Declarado vence derivado, e **divergência entre os dois vira aviso**, nunca
silêncio: `subnet "app-a": declarada como camada "dados", mas o que ela guarda é
"aplicacao" (ecs). O motor obedece à declaração.` Mesma política que o
[#16](https://github.com/ThiagoPanini/panlabs-skills/issues/16) fixou para
conflito com premissa corporativa — obedece e sinaliza.

**Isto não fere a fronteira do #11.** `camada` nomeia um andar de rede, não uma
posição: os valores são `borda | aplicacao | dados`, não `1 | 2 | 3` nem
`topo | meio | fundo`. O `check-fronteira` continua verde, e continua sendo ele
quem responde — não a minha palavra.

---

## 4 · O caso da subnet vazia: o motor recusa, e recusa com precisão

O ticket mandou mostrar o que acontece. Acontece isto:

```
✗ a grade não sabe empilhar estas linhas — falta a camada de rede das subnets
    · VPC "vpc" · privadas: "Reserved subnet" (res-a, res-b) não diz que camada
      de rede ocupa — vazia, nada a inferir (são 2 papéis para empilhar)
    · declare `camada` ("borda" | "aplicacao" | "dados") nessas subnets, ou
      ponha dentro delas o serviço que elas hospedam
```

Três coisas sobre essa recusa:

**1 · Ela é para o AGENTE, não para o humano.** É esta a diferença que salva a
premissa 11. Um campo obrigatório no IR viraria pergunta na sabatina, que é
tempo do usuário; uma recusa com a lista exata é uma ida e volta de máquina — o
agente lê, acrescenta `camada`, roda de novo. O humano não é chamado.

**2 · Ela só dispara onde a falta muda o desenho.** A condição é: mais de um
**papel** para empilhar, na mesma VPC e mesma exposição, e algum deles sem
camada. Papel único não tem contra quem ser ordenado, e aí a subnet vazia não
custa nada — a régua tem esse caso e ele **não** recusa.

**3 · Ela é assimétrica entre os dois caminhos, de propósito.**

> **O motor exige o fato onde o fato É o desenho, e avisa onde ele é só desempate.**

Na grade, a chave de papel manda sozinha na ordem das linhas: sem o fato, a
ordem é inventada. No caminho do ELK, a camada só decide entre irmãos que
nenhuma aresta ordena, e o ELK tem o grafo inteiro para mandar nele — recusar
ali bloquearia o caso comum por uma ambiguidade que quase nunca chega ao
desenho. `modelo/elk-sem-camada.json` é o mesmo buraco, desenhado com aviso.

---

## 5 · A candidata rival, medida em vez de descartada por argumento

O ticket perguntou: *"ou ordenar por distância da borda, contando saltos até o
nó mais exposto — funciona quando há arestas, e cai para o quê quando não há?"*

`tools/check-saltos.cjs` conta, no corpus **inteiro** dos três protótipos:

| | |
|---|---|
| modelos em que a distância consegue ordenar | **3** |
| modelos em que ela fica muda | **9** |
| onde ela fala, **concorda** com o conteúdo | **3** |
| onde ela fala, **discorda** do conteúdo | **0** |
| só no corpus herdado (q11+q12, escrito antes desta pergunta) | fala em 2, muda em 2, discorda em 0 |

E ela ganhou o melhor cenário possível de propósito: `web-dados-com-fluxo` é o
caso da linha 2 da tabela com um andar público e arestas, escrito **para** dar à
rival um ponto de partida e um caminho. Ela concorda ali também.

A leitura: **a distância não é uma segunda fonte de informação.** Onde ela fala,
repete o que o conteúdo já dizia; onde o conteúdo fala sozinho, ela está muda. E
o modo como ela fica muda importa — quase sempre por **não haver nó exposto de
onde contar**, não por falta de aresta. Uma VPC privada inteira não tem borda no
diagrama, e é justamente ela que mais precisa da ordem.

Por isso a distância não entrou nem como desempate: ela custaria um segundo
critério para não mudar nenhuma resposta.

---

## 6 · A resposta anterior, e por que esta ficou no lugar dela

O `9b27d6f` chegou ao **mesmo cabeçalho**: derivar do conteúdo, `camada` como
escape semântico, exposição primeiro. Isso não é coincidência — é o sinal de que
a decisão é a certa, e vale registrar que duas passadas independentes caíram nela.

Divergem em três pontos, e um deles é medível.

**1 · Onde a regra mora.** Lá ela vive num emissor próprio, ao lado do motor;
aqui ela está **dentro** do motor do #11 — `motor/camadas.cjs`, consumida por
`derivar.cjs` e por `dispor.cjs`. É a diferença entre demonstrar a decisão e
tê-la valendo: os desenhos de lá saem de 151 linhas de emissor de protótipo, os
daqui saem do mesmo caminho que produz `web-multi-az` e a landing zone, com
faixa de AZ, catálogo corrigido e as 62 checagens do #18 à espera.

**2 · Mistura.** Lá, subnet com serviços de mais de uma camada vira
`indefinida` e vai para o fim. Aqui, **vence o mais fundo**.

**3 · A tabela.** Lá são 7 categorias, aqui 9 —
`security_identity_compliance`, `application_integration` e `analytics`
entraram.

Os pontos 2 e 3 têm o mesmo efeito e a mesma medida. `tools/check-standalone.cjs`
carrega a regra de lá **do próprio git** e roda as duas sobre os modelos de rede
do q11 e do q12 — escritos antes das duas, por outros tickets:

| | |
|---|---|
| subnets medidas | **23** |
| sem camada pela regra de `9b27d6f` | **3** |
| sem camada pela regra que ficou | **0** |

As três:

| modelo | subnet | lá | aqui |
|---|---|---|---|
| `q11/pedidos-serverless` | `Private subnet` | `indefinida` (conteúdo misto) | `dados` |
| `q12/landing-zone-6-contas` | `Private subnet` | `indefinida` (conteúdo misto) | `dados` |
| `q12/plataforma-3-contas` | `Inspection subnet` | `indefinida` (sem evidência) | `borda` |

Duas caem pela regra de mistura, e não são casos exóticos: `lambda + endpoints
+ rds` e `ecs + rds` são a forma normal de uma subnet de aplicação. A terceira
cai pela tabela curta — `Network Firewall` é `security_identity_compliance`, e
sem essa linha a subnet **mais de borda de todo o corpus** é a que a regra não
sabe nomear.

E "sem camada" não é neutro: a subnet indefinida vai para o **fim** do grupo de
exposição dela. Isso é uma posição, e uma posição que ninguém escolheu — é o
mesmo defeito do alfabeto, com outro nome.

A régua trava o achado: ela **falha** se um dia a regra que ficou deixar de
nomear mais que a anterior.

---

## O que este protótipo descobriu

**1 · O motor não desenhava subnet vazia — e o erro falava de outra coisa.**
Os dois caminhos do ELK decidiam "container ou folha" por **contagem de
filhos**, não por tipo. Uma subnet sem nada dentro caía no ramo de folha e
morria em `res.folha()` com `nó "res" do tipo "subnet" sem chave de serviço` —
mensagem que fala de serviço para quem escreveu uma subnet. O caminho da grade
nunca teve o problema (lá o container vazio já ganhava caixa mínima), e é por
isso que ninguém tinha topado com ele: **os exemplos do #11 e do #12 não têm
nenhuma subnet vazia.** Agora container é quem o esquema diz que é container, e
existe uma `caixaVazia` só, para os dois caminhos.

**2 · A prova das variantes de fluxo do #11 estava velha, sem um pixel de
diferença.** `pedidos-tracejado.drawio` e `pedidos-animado.drawio` não estavam
no laço de geração da suite do #11 — saíam de uma chamada manual com `--fluxo`.
Quando o #12 derivou a ordem dos irmãos, os dois arquivos versionados ficaram
com a ordem de células de antes: **geometria idêntica, ordem de documento
diferente**, e nada acusando. Foi este ticket que descobriu, ao comparar hashes
para provar que a regra de camada não mexia em desenho nenhum. Os dois entraram
no laço.

**3 · A limpeza de render do #12 podia matar quem a chamasse.** O `render.sh`
descreve exatamente esse perigo em prosa — *"o nome do arquivo aparece na linha
de comando de QUEM CHAMOU este script, e o pkill mata o chamador junto"* — e o
`limpar-render.sh` ao lado tinha o mesmo defeito em código: `pkill -f
'squashfs-root/drawio'` casava com `./tests/rodar.sh /…/squashfs-root/drawio`. A
suite do #22 chama a do #12 passando o binário adiante, e a do #12 imprimia
"suite verde" e morria com SIGKILL logo depois — o `pipefail` do chamador
traduzia isso em vermelho **sem uma linha de erro**. O padrão passou a exigir
uma flag depois do caminho.

**4 · Um `package.json` esquecido em `/tmp` sequestra o `require` do Node.**
A extração do AppImage do draw.io (#9/#10) deixa o `package.json` do próprio
draw.io na raiz de `/tmp`. Como o Node resolve o tipo de módulo pelo
`package.json` mais próximo subindo do arquivo, qualquer coisa extraída para um
`mktemp -d` herda aquele arquivo: o `elk.bundled.js` (UMD) passava a ser
carregado com semântica de ESM e `require` devolvia `{}`. O erro que aparecia era
**`ELK is not a constructor`**, a 1.600 km da causa. `gerar-antes.sh` ancora o
tipo com um `{"type":"commonjs"}` de uma linha na raiz da extração.

**5 · O invariante é mais forte que a intuição, e é ele que escolhe a regra de
mistura.** "Vence o mais fundo" parece arbitrário até você perguntar o que a
regra existe para impedir. A resposta — *subnet com dado nunca acima de subnet
sem dado* — só é garantida por uma das duas agregações possíveis, e é ela que
fica. A outra (vence o mais raso) transforma um load balancer numa alavanca para
subir a camada de dados.

## O que fica aberto

- **O caso do broker.** MSK é `analytics`, então uma subnet de ingestão que
  hospeda os brokers desce para dados. O escape resolve caso a caso, mas se isso
  aparecer com frequência no corpus de validação, a saída não é mexer no
  `analytics` inteiro — é reconhecer que **streaming não é armazenamento** e
  cortar a categoria. Precisa de evidência que ainda não existe.
- **A camada só é lida de nó que resolve para serviço.** Na vista lógica os
  filhos são `bloco`, que não têm categoria AWS nenhuma, então toda subnet
  lógica fica sem camada. Hoje não custa (a vista lógica não tem subnet — o #15
  agrupa por fronteira de responsabilidade), mas o
  [#14](https://github.com/ThiagoPanini/panlabs-skills/issues/14) projeta uma
  vista na outra, e se um dia a vista lógica ganhar rede, é aqui que ela
  encalha.
- **A ordem das linhas ainda não é conferida pelo validador do
  [#18](https://github.com/ThiagoPanini/panlabs-skills/issues/18).** As 62
  checagens medem incidência e contenção; nenhuma pergunta se a camada de dados
  está embaixo. É uma checagem nova, do tipo `A4`, e criá-la é decisão da
  rubrica — não deste ticket.
