# ⚠️ Protótipos descartáveis — não é a skill

Código e medições de uma pergunta só, do ticket
[#14 · Vista lógica → vista técnica: modelo, persistência e transição](https://github.com/ThiagoPanini/panlabs-skills/issues/14).
**Nada aqui vira produção.** O que sobrevive é a *decisão*, que fica na resolução do ticket;
estes arquivos ficam como fonte primária.

**Abra `comparacao.html` com duplo clique** — as duas vistas lado a lado, com o alternador.

---

## A pergunta

> Como o **mesmo modelo** serve às duas vistas — lógica e técnica — e como uma vista lógica
> aprovada é retomada numa sessão futura para virar técnica?

O caso é a continuação direta da sabatina do
[#15](https://github.com/ThiagoPanini/panlabs-skills/issues/15): varejo, 300 lojas, três
fronteiras de responsabilidade, candidata **A** escolhida, SPOF do SFTP recusado por orçamento.
Aquela transcrição termina exatamente aqui:

> *(Como a vista aprovada persiste entre sessões é decisão do ticket #14, não desta.)*

## Rodar

```bash
node sessao1.cjs     # a vista lógica, aprovada e persistida
node sessao2.cjs     # dias depois: retoma o arquivo e emite a técnica
./tools/renderizar.sh
./tests/rodar.sh     # a régua, nove camadas
```

---

## O que ficou decidido

### 1 · Um IR só, com dois casacos — e o trade-off do ticket é falso

O ticket enunciou a escolha como **rastreabilidade vs simplicidade**: dois modelos ligados por
mapeamento explícito rastreiam melhor, um modelo só é mais simples.

**Não é um trade-off.** Com um IR, a rastreabilidade não é uma tabela de-para que alguém mantém
— é uma **função**:

```
projetar(modelo_técnico, 'lógica')  ==  o que foi aprovado
```

Com dois modelos, responder *"o que estou desenhando ainda é o que você aprovou?"* exige que o
mapeamento esteja certo, e nada garante que esteja. Com um, a pergunta se responde sozinha. É
uma comparação de strings, e roda em `tools/check-projecao.cjs`.

O modelo tem **um nó por coisa** e dois casacos:

```jsonc
{ "id": "processar-na-chegada", "rotulo": "Processar na chegada", "dentro": "sub-app",
  "logico":  { "tipo": "bloco" },
  "tecnico": { "tipo": "servico", "servico": "lambda", "rotulo": "Lambda · parse e curadoria" } }
```

Duas mecânicas fazem a projeção funcionar, e as duas são o motivo de a fase técnica poder
detalhar sem mexer no que foi aprovado:

| | |
|---|---|
| **Colapso de contenção** | `dentro` aponta sempre para o pai mais fino. Para a vista mais grossa, sobe-se até o primeiro ancestral que exista nela. Enfiar `VPC › Subnet` entre a folha e a fronteira **não muda uma linha da projeção lógica**. |
| **Contração de aresta** | Um nó que só a camada técnica tem fica no meio de um caminho lógico. `guardar-bruto → [EventBridge] → processar` projeta de volta para `guardar-bruto → processar`, com o rótulo da aresta aprovada. |

E a consequência mais forte: **o motor do #11 não mudou um byte.** Servir as duas vistas não é
problema do motor, é problema de projeção — a saída de `projetar.cjs` é um `modelo@1` comum, e o
motor continua sendo um renderizador de uma vista só. `tools/check-motor-intocado.cjs` confere
os 11 arquivos por hash.

### 2 · Onde o modelo persiste: embutido, e uma cópia por página

As três opções do ticket **não são alternativas** — duas delas são a mesma resposta em eixos
diferentes:

```
ONDE o modelo mora    → embutido em <object>, não sidecar
COMO as vistas moram  → duas páginas <diagram> do MESMO arquivo
```

Sidecar `.yaml` cai por **argumento, não por medição**, e é o mesmo argumento que o #11 usou:
**dois arquivos dessincronizam**. O usuário arrasta o `.drawio` para o Slack e o par se desfaz
na primeira vez. Duas páginas em vez de dois arquivos é o mesmo argumento um nível acima.

> **O sidecar tem um argumento a favor, e ele é o número medido abaixo:** com o modelo embutido
> em duas páginas, o selo é **58% do arquivo**. Um sidecar não pagaria isso. A troca é
> *dessincronização certa* contra *arquivo 2,3× maior*, e este protótipo escolhe o arquivo maior
> porque o `.drawio` circula sozinho — anexo de e-mail, canal de Slack, pasta compartilhada — e
> um modelo que só existe ao lado do desenho é um modelo que some. Se o dossiê real (sabatina
> inteira, dez achados, transcrição de ata) tornar a conta insustentável, a decisão merece ser
> reaberta com o número real na mão, e não foi medida com dossiê grande.

**Onde, dentro do XML**, foi medido — sete hospedeiros pelo codec do próprio app:

| hospedeiro | sobrevive | íntegro |
|---|---|---|
| atributo no `<mxfile>` | sim | sim |
| atributo no `<diagram>` | sim | sim |
| **atributo no `<mxGraphModel>`** | **NÃO** | — |
| `<object>` envolvendo a camada (`id=1`) | sim | sim |
| `<object>` em célula oculta ← **adotado** | sim | sim |
| `<UserObject>` em célula oculta | sim | sim |
| `<object>` oculto na **segunda** página | sim | sim |

O selo é escrito em **toda página**, não só na primeira.

**O que a medição estabelece:** que a segunda página preserva o payload byte a byte, igual à
primeira (linha 7 da tabela). Sem isso a cópia por página nem seria opção.

**O que é argumento, não medição** — e a distinção importa: apagar uma página é a operação mais
banal do mundo no draw.io, e com uma cópia só ela leva a sessão junto; extrair uma página para
um arquivo novo mata até a cópia no `<mxfile>`. **Nenhuma das duas foi executada contra o app** —
são consequências raciocinadas da tabela, não linhas medidas. Registrado assim de propósito: a
tabela mede sobrevivência ao *codec*, e sobrevivência a *gesto de usuário* é outra coisa.

**O custo, esse é medido:** o selo é **58% do arquivo** — 40.501 de 70.325 bytes, 19,8 KB por
página, com o modelo de sessão escapado. A segunda cópia custa exatamente isso.

### 3 · Como a skill reconhece o próprio arquivo — e por que `host` não serve

```
host="panlabs-aws-diagrams"   →  depois do round-trip pelo app:  host="Electron"
```

**O `host` é do app, não nosso.** Quem gravar por último escreve o próprio nome nele. Serve para
explicar, nunca para decidir. A marca forte é o atributo `panlabsEsquema` do selo, que faz
round-trip byte a byte (medido).

### 4 · O humano editou à mão: três estados, não dois

O reflexo é guardar um hash do arquivo. **Não serve**, e a medição mostra por dois motivos
diferentes: ele acusa arquivo *intocado* — **abrir e salvar no app, sem tocar em nada, já
reescreve o XML** (medido: 39.172 → 39.112 bytes numa página, 70.325 → 69.917 no arquivo de
duas) — e ele **não distingue arrastar uma caixa de apagar um serviço**, que são respostas
opostas.

Duas impressões, e a fronteira entre elas **não é geometria contra o resto** — é **o que a
célula AFIRMA** contra **como ela APARECE**:

| estado | as duas impressões | o que a skill faz |
|---|---|---|
| `intacto` | as duas batem | regera à vontade |
| `remanejado` | afirmação bate, aparência não | **avisa**: regerar apaga o ajuste que você fez |
| `divergente` | a afirmação não bate | **para**, e relata a diferença exata |

Dois estados não dariam conta: colapsar `remanejado` em `intacto` joga fora meia hora de ajuste
manual; colapsar em `divergente` bloqueia quem só moveu uma caixa — e bloqueio que dispara à toa
é bloqueio que o usuário aprende a ignorar.

**Dez edições humanas × três esquemas** (`tools/medir-impressao.cjs`):

| esquema | acertos |
|---|---|
| hash do arquivo inteiro | 5/10 |
| semântica **sem cor** + aparência | 9/10 |
| semântica **com cor** + aparência ← adotado | **10/10** |

> A primeira das dez edições é *"salvar sem editar nada"*, e ela **precisa do draw.io headless**.
> Sem o binário a régua roda as outras nove e diz que pulou — os placares viram 5/9, 8/9 e 9/9.
> É justamente a linha que o binário destrava que derruba o hash de arquivo, então vale rodar
> com ele antes de acreditar no primeiro número.

O único caso que separa os dois últimos é o **experimento de controle**, e ele vale por si:

> `Public subnet` e `Private subnet` têm o **mesmo `shape`** e o **mesmo `grIcon`**
> (`mxgraph.aws4.group` + `group_security_group`). Diferem **só no hex** — `#7AA116` contra
> `#00A4A6`. **Num diagrama AWS, cor não é cosmético:** a fronteira pública/privada, que é
> exatamente a que a checagem `A4.2` da rubrica (#8) existe para proteger, mora na cor e em
> nenhum outro lugar. Uma impressão que ignora cor deixa repintar uma subnet privada de pública
> e ainda chama o arquivo de intacto.

Quando diverge, o relato sai no vocabulário do **modelo**, não do XML — toda célula que o motor
emite carrega o id de um elemento — e cada diferença é classificada em *absorvível* (o modelo
tem campo que a expressa) ou *opaca* (não tem). Ver `tools/demo-divergencia.cjs`.

> O "antes" da comparação não é guardado: é **regerado** do modelo selado. O #11 provou que o
> motor é determinístico, então regerar reproduz as células gravadas. É por isso que o selo
> carrega hash e não lista de células — guardar a saída junto da fonte compraria mais um par
> capaz de dessincronizar. A ressalva honesta está no selo: `panlabsMotor` diz qual motor
> desenhou, para que uma diferença de aparência causada por *upgrade do motor* seja explicável
> em vez de misteriosa.

### 5 · A aprovação é uma impressão, não um booleano

`aprovado: true` sobrevive a tudo. Você aprova a vista lógica, a sessão seguinte elabora, alguém
acrescenta uma capacidade que ninguém discutiu, e o booleano continua dizendo sim — o diagrama
técnico sai com carimbo de aprovado por cima de uma arquitetura que ninguém aprovou.

O acordo guarda o **recorte** da projeção lógica aprovada (nós, fluxos, notas — não título nem
subtítulo, que são apresentação) e o sha256 dele. Reconferir é reprojetar o modelo de hoje e
comparar.

O recorte é **guardado**, e isso não contradiz "não guarde saída junto da fonte": ele não é
derivável do modelo atual. É **história** — o que o humano disse sim para —, e história não se
recalcula. Sem ele, uma quebra de acordo sabe dizer *que* mudou, nunca *o que* mudou.

**Experimento de controle, 12/12** (`tools/check-projecao.cjs`) — sete mutações que **têm** de
ser pegas, cinco que **não podem** ser:

```
tirar o casaco lógico de uma capacidade aprovada    ✓ pego
renomear uma capacidade aprovada                    ✓ pego
mudar uma capacidade de fronteira                   ✓ pego
apagar uma capacidade aprovada                      ✓ pego
acrescentar capacidade que não foi discutida        ✓ pego
apagar a nota do achado RECUSADO                    ✓ pego
hub só-técnico com 2 entradas e 2 saídas lógicas    ✓ pego
─────────────────────────────────────────────────────────
acrescentar infraestrutura (nó só-técnico)          ✓ passou
trocar o serviço AWS de uma capacidade              ✓ passou
enfiar mais um nível de rede e reparentar           ✓ passou
mudar o número da conta                             ✓ passou
dar rótulo técnico novo a uma aresta aprovada       ✓ passou
```

### 6 · A candidata escolhida e as descartadas

Ficam no `dossiê`, com as tuplas `E1–E5` inteiras. As descartadas ficam por dois motivos
concretos: para a sessão seguinte **não repropor** uma forma que já foi recusada, e para
responder *"por que não a B?"* seis meses depois. O invariante de distinção do #15 virou
checagem — duas candidatas com a mesma tupla são a mesma arquitetura com dois nomes, e o
validador reprova.

O `dossiê` continua **opaco ao motor**, como o #11 decidiu — e agora nem chega perto dele: o
motor come a *projeção*, não o modelo de sessão. O que mudou é que a **camada de sessão** lê o
dossiê, e é isso que faz uma vista aprovada ser retomável. *Opaco ao motor* não quer dizer *sem
forma*.

A recusa de achado ganhou um elo explícito: `achados[].viaNota` aponta a nota que leva a recusa
até o desenho. Elo, e não busca de substring no texto — quem editar o texto da nota não pode
quebrar a rastreabilidade sem perceber. Achado `recusado` sem `viaNota` é **erro de validação**.

### 7 · O briefing — recuperar a conversa sem guardar a conversa

A resposta que **não** serve é guardar a transcrição: é cara, envelhece mal e obriga a próxima
sessão a reler uma conversa para descobrir três fatos. O que se recupera é o dossiê, e o
briefing é ele renderizado — o que ficou decidido, o que foi recusado e por quê, o que está
estacionado esperando a fase técnica, e se o acordo ainda vale. É a primeira coisa que a sessão
2 imprime.

---

## Os arquivos

| | |
|---|---|
| `sessao1.cjs` | A vista lógica, aprovada e persistida. Ponta a ponta. |
| `sessao2.cjs` | A retomada: reconhece, relata, elabora, confere, emite as duas páginas. |
| `sessao/esquema.json` | `sessao@1` — o IR de sessão. Um nó, dois casacos. |
| `sessao/projetar.cjs` | `sessao@1` + vista → `modelo@1`. Colapso e contração. **O coração.** |
| `sessao/acordo.cjs` | Aprovar e reconferir. A aprovação como fato conferível. |
| `sessao/impressao.cjs` | As três impressões, o diff e a classificação. |
| `sessao/abrir.cjs` | Reconhecer, extrair, classificar o estado, e a **política** de cada estado. |
| `sessao/gravar.cjs` | Selar no `<object>` e costurar as páginas. |
| `sessao/elaborar.cjs` | O delta técnico, com o guarda que recusa mexer em casaco lógico. |
| `sessao/validar.cjs` | O que só a camada de sessão sabe cobrar. |
| `sessao/briefing.cjs` | A retomada em texto. |
| `modelo/varejo-logica.json` | O caso no estágio lógico — o único arquivo escrito à mão. |
| `modelo/varejo-elaboracao.json` | O delta que a sessão 2 aplica. Não é um segundo modelo. |
| `tools/medir-hospedeiro.cjs` | **M1** — onde o metadado sobrevive ao codec do app. |
| `tools/medir-impressao.cjs` | **M2** — 10 edições humanas × 3 esquemas de impressão. |
| `tools/check-projecao.cjs` | **M3** — o acordo, com experimento de controle 12/12. |
| `tools/check-motor-intocado.cjs` | O motor do #11 conferido por hash. |
| `tools/check-roundtrip.cjs` | O arquivo de duas páginas pelo codec do app. |
| `tools/check-fronteira.cjs` | A fronteira do #11 sobre o esquema novo. |
| `tools/demo-divergencia.cjs` | O que a skill diz quando o humano editou à mão. |
| `tools/renderizar.sh`, `tools/gerar-comparacao.cjs` | Render dos PNGs e a página de comparação. |
| `saida/varejo.drawio` | **O entregável**: duas páginas, o modelo, o dossiê e o acordo dentro. |
| `saida/1-logica.png`, `2-tecnica.png` | O render das duas páginas. |
| `saida/varejo-so-remanejado.drawio` | O mesmo arquivo com **uma caixa arrastada** — lê como `remanejado`. |
| `saida/varejo-editado-a-mao.drawio` | E com o **conteúdo** mexido — lê como `divergente`, com o diff exato. |

---

## Achados de bancada (custaram uma rodada cada)

**1 · Contração perdia a identidade da aresta.** A aresta contraída nascia sem o id da aresta
aprovada, o motor caía no id derivado, e a **mesma** vista lógica saía com outros ids de célula
depois da elaboração técnica — uma divergência inteira num desenho que não mudou em nada. A
aresta contraída **continua sendo** a aprovada: herda o id. Quando um salto abre em leque (um
barramento com vários consumidores), o alvo desempata.

**2 · "Geometria" era a fronteira errada.** A primeira versão só olhava `x/y/w/h`. Trocar a
fonte ou recolher um container não mexe em coordenada nenhuma, e o arquivo saía **intacto** —
quer dizer, *regere à vontade* por cima do ajuste de alguém. A fronteira certa é **afirmação
contra aparência**, e a aparência inclui ordem z e todo o resto do style.

**3 · Um modelo só não quer dizer uma apresentação só.** A primeira volta emitiu as duas páginas
com o mesmo título, e a página **técnica** saiu do render dizendo *"vista lógica"* no cabeçalho.
Virou `vistas.{logica,tecnica}.{titulo,subtitulo,genero}` — que de propósito **não entra no
acordo**: trocar o título depois de aprovado não desfaz aprovação nenhuma.

**4 · A vista lógica não é a técnica com menos coisa — é a técnica com menos *afirmação*.**
O modelo lógico tinha `guardar-bruto → processar` e `processar → guardar-bruto` (avisa / lê).
Verdadeiro, e um ciclo de 2 — que o ELK quebra revertendo uma aresta e que jogava o layout
inteiro para trás, com aresta riscando rótulo de nó. *Como* o Lambda alcança o arquivo é detalhe
técnico. A vista lógica diz "chegou arquivo novo, processa"; o caminho pelo VPC endpoint e o
papel cross-account só existem na camada técnica. O desenho melhorou e o modelo ficou mais
honesto — **a vista para não-AWS não deve ser a técnica com os ícones trocados.**

**5 · O irmão da armadilha do #19.** Lá ficou registrado que XML inválido faz o draw.io
**renderizar** truncado e sair com código 0. Aqui apareceu a versão de exportação: sob pressão de
memória o app **exporta XML com páginas a menos** e também sai com 0. Medido nesta máquina — o
mesmo arquivo de duas páginas voltou com 2 numa execução (69.149 bytes) e com 1 na seguinte
(25.588), sem erro nenhum nas duas. **Quem chama o app tem de conferir o que voltou**, porque o
código de saída não conta. Vale para o motor de verdade, não só para o teste.

**6 · Dois bugs que só a revisão pegou, e os dois eram silenciosos.**

O primeiro é um `else` sem chaves em `projetar.cjs`:

```js
if (vista === 'tecnica') for (const c of CAMPOS_TECNICOS) if (casaco[c] !== undefined) …
else if (casaco.nota !== undefined) saida.nota = casaco.nota;   // ← gruda no `if` de dentro
```

O `else` liga ao `if` interno, dentro do `for`. Na vista lógica a linha inteira nunca roda, e
**toda `casacoLogico.nota` sumia da projeção** — sem erro, sem aviso, e sem que o acordo pudesse
notar, porque o recorte também não carregava o campo. O segundo: a chave de deduplicação da
contração era `de>para`, então **duas arestas aprovadas distintas entre o mesmo par colapsavam
numa só** — e como as duas pontas da comparação do acordo perdiam a mesma, a checagem ficava
cega para a própria perda.

O padrão dos dois é o mesmo e é o que este ticket inteiro persegue: **perda que não dá erro.**
Os dois viraram guarda em `check-projecao.cjs`, e o da nota tem experimento de controle — com o
`else` sem chaves de volta, a checagem sai 1.

**7 · O NUL byte.** Um `\0` entrou num literal de string ao gravar o arquivo, e o efeito é
pérfido: o `node` roda normalmente, mas o `grep` passa a tratar o arquivo como binário e **não
imprime nada** — inclusive nas linhas certas. Diagnóstico só saiu com um dump de bytes.

---

## O que este protótipo NÃO demonstrou

- **Absorver a edição do humano.** A divergência é detectada, relatada e classificada em
  absorvível/opaca. Absorver de verdade — virar campo do modelo — é decisão de produto e não
  foi construída. Classificar já responde a pergunta do ticket; absorver é outro ticket.
- **Dossiê grande.** O selo já é 58% do arquivo com um dossiê de brinquedo. Sabatina real, com
  transcrição de ata e dez achados, não foi medida.
- **Mais de duas vistas.** O esquema tem exatamente dois casacos. Se aparecer uma terceira vista
  (C4 nível 1, por exemplo — hoje fora de escopo), `logico`/`tecnico` viram um mapa.
- **Privacidade do dossiê.** O `.drawio` que a diretoria recebe carrega, dentro, as candidatas
  descartadas e os achados recusados. Qualquer um que abra *Extras › Editar diagrama* lê tudo.
  É consequência da decisão de persistência, e não foi tratada.

## Dívida que este protótipo empurra para outros tickets

- **O sentido de leitura na vista técnica.** `dados: "volta"` é semântico — o modelo sabe qual
  aresta é o caminho de volta — mas o layout ordena pela **seta**, e o `O1` do
  [#5](https://github.com/ThiagoPanini/panlabs-skills/issues/5) (17 de 24 diagramas oficiais)
  quer o fluxo correndo esquerda → direita. Na vista técnica multi-conta isso empurra a zona de
  aterrissagem para a direita e cria uma aresta atravessando o desenho inteiro. Dar `dados` ao
  ELK como dica de reversão é candidato a conserto — matéria do
  [#12](https://github.com/ThiagoPanini/panlabs-skills/issues/12)/[#18](https://github.com/ThiagoPanini/panlabs-skills/issues/18),
  não deste ticket, porque consertar aqui exigiria mexer no motor e derrubaria a afirmação de §1.
- **Nota presa a nó encosta em borda de container** (visível nos dois PNGs). Mesma família do
  "aresta pode raspar o rótulo de um nó" que o #11 já deixou para o
  [#18](https://github.com/ThiagoPanini/panlabs-skills/issues/18).
- **`no.nota` viaja e não desenha.** O `modelo@1` do #11 declara `nota` no nó, mas o motor só
  desenha `notas[]` — a anotação presa ao nó nunca vira célula. Não é regressão deste ticket
  (o modelo do #11 já tinha `"nota": "single-AZ"` num RDS que sai sem ela), mas os dois casacos
  daqui herdam o campo. **Consequência prática, e ela é do #11 e não do motor:** o que precisa
  virar desenho vai em `notas[]` — foi assim que "quem é dono de cada fronteira" saiu do campo
  inerte e virou legenda visível na vista lógica.
