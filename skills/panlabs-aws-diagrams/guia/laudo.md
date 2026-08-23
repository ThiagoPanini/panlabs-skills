# O laudo e o portão

O laudo sai **sempre**, em `relatorio.geometria` e no `--explicar`. Bloquear é que
é opcional. Comando aqui roda da raiz da skill, como no [`SKILL.md`](../SKILL.md).

```bash
node tools/check-geometria.cjs <modelo.json>          # o laudo, legível
node tools/check-geometria.cjs <modelo.json> --json    # para ler no código
node tools/check-geometria.cjs --exemplos              # o corpus inteiro
node motor/gerar.cjs <modelo.json> --portao veracidade # bloqueia se o desenho mentir
```

## Guarda de veracidade, não linter de beleza

Este é o enquadramento que decide tudo o resto. Três checagens não medem se o
desenho está **feio** — medem se ele está **falso**:

| | o que acusa |
|---|---|
| `A4.2` | nó geometricamente dentro de um grupo do qual não é filho lógico — comunica uma fronteira de rede que **não existe** |
| `A4.4` | o aninhamento que a geometria afirma diverge do que o modelo declara |
| `A5.5` | aresta atravessando fronteira alheia — a mesma mentira, aplicada ao roteamento |

Tolerância zero nas três não é rigor, é o mínimo: um diagrama assim não é feio, é
**mentiroso**, e como não há diferença contra IaC neste escopo, **nada a jusante
pega isso**.

Duas checagens de **faixa** têm a mesma tolerância zero e ficam **fora das 62 de
propósito**. A rubrica modela uma árvore de contenção só, e o motor desenha duas
coisas: **grupo afirma contenção, faixa afirma atributo compartilhado**. Aplicar
as checagens de aninhamento sobre faixas reprovava o desenho certo pelo motivo de
maior gravidade do validador — uma faixa existe justamente para **cruzar** outras
caixas.

| | o que acusa | espelho de |
|---|---|---|
| `F1` | a faixa não abraça exatamente os membros que declara | `A4.2` |
| `F2` | a aresta atravessa a caixa de uma faixa que não é dela | `A5.5` |

`F2` nasceu no [#26](https://github.com/ThiagoPanini/panlabs-skills/issues/26) e
a razão é que **ela não existia**: `A5.5` varre `cena.grupos`, faixa é outra
classe, e o motor era estruturalmente cego ao defeito que o fallback do #21
existe para evitar. Ela entra **armada e calada** — medida em malha completa de
3 a 6 zonas, `F2` = 0 nas quatro. O que ela compra é a regressão: no dia em que
uma mudança de roteamento reintroduzir o cruzamento, o portão `veracidade` barra.
Ver [`../docs/corpus.md`](../docs/corpus.md).

## As oito famílias

62 checagens: 40 `fail`, 22 `warn`. Sessenta no validador obrigatório, **2 no
render** (`A2.9` quebra de rótulo, `A8.4` cobertura de tinta) — a partição é
exaustiva e sem sobreposição, e travada por teste.

| | | mede |
|---|---|---|
| `A1` | 12 | completude semântica — o checklist do C4 virado asserção |
| `A2` | 11 | notação e vocabulário visual |
| `A3` | 9 | sobreposição e legibilidade |
| `A4` | 7 | agrupamento e contenção |
| `A5` | 9 | arestas: cruzamento, ângulo, dobra, direção |
| `A6` | 5 | distribuição, grade, razão de aspecto |
| `A7` | 5 | acessibilidade (WCAG) |
| `A8` | 4 | volume e saturação |

O nome, o que mede, o limiar e a **fonte** de cada uma estão em
[`../validador/indice.cjs`](../validador/indice.cjs) — é uma tabela, não código de
cálculo, e existe para responder *"quais das 62, com que severidade"* sem
executar nada.

```bash
node -e "require('./validador/indice.cjs').CHECAGENS.filter(c=>c.familia==='A5').forEach(c=>console.log(c.id,c.severidade,c.nome))"
```

**Os limiares não foram inventados.** As métricas contínuas estão calibradas nos
percentis de 4.890 desenhos de especialistas. Oito checagens não têm base
experimental e estão marcadas `calibravel: true`, com `porque: null` em
`limiares.json` — o campo vazio é um pedido de medição, não um número
respeitável: `A3.9` `A4.7` `A5.3` `A5.7` `A6.4` `A7.4` `A8.3` `A8.4`.

## Os quatro níveis, e por que o default é `nenhum`

| `--portao` | barra quando |
|---|---|
| `nenhum` | nunca — **default** |
| `veracidade` | há falha semântica |
| `falha` | há qualquer falha |
| `estrito` | há qualquer falha **ou** aviso |

`veracidade` é o default recomendado de **publicação**, e publicar não é desenhar.
Bloquear em `gerar` faria o motor recusar por dívida conhecida, com dono e
endereço. **Recusar desenhar é decisão de quem entrega, e ela tem hora** — por
isso o verbo é `publicar` e a decisão é do passo 7, não do passo 6.

Mas o laudo não fica calado: **uma falha semântica vira aviso mesmo sem ninguém
pedir portão**. Um portão que só existe quando alguém pede é um portão que
ninguém sabe que existe.

### Um laudo incompleto nunca passa, em nenhum nível

Se uma família parou de rodar, o verde não quer dizer nada. Isso é garantia do
portão, e já falhou uma vez na vida real: uma versão anterior reimplementava a
decisão do lado de fora, engolia a exceção e saía **verde sobre um laudo que não
mediu nada**.

## É portão, não otimizador

Ele roda entre `planejar` e `emitir` — o único ponto onde a geometria já existe e
o XML ainda não — e é **função pura**.

Um laço de correção comandado pelo validador seria um segundo otimizador
competindo com o ELK **sem gradiente nem função objetivo**: as 62 não se combinam
num escore (a rubrica proíbe), e sem escalar não há o que descer. O motor já
corrige no lugar certo — `alinhar.cjs` desfaz a passada que piora, porque tem as
alavancas.

## O piso do corpus — o que NÃO tentar consertar

Medido nos 15 modelos. Estas acusam em quase todos, e o motivo é dívida
registrada, não defeito do seu modelo:

| | | por quê |
|---|---|---|
| `A1.2` `A1.3` | ✗ 15/15 | **nenhum diagrama emite legenda.** O vocabulário fechado do tema não contrai essa dívida — e não a contrai de propósito: legenda é a dívida de quem inventa notação, e o tema não deixa inventar |
| `A1.11` | ⚠ 15/15 | pede `data`, `versao`, `autor`; `modelo@1` é `additionalProperties: false` e não tem esses campos |
| `A7.2` | ✗ 15/15 | o quadrado do ícone de serviço fica em **2,71:1** contra o tingimento de subnet. O portão de contraste do tema **avisa** (trata como área); este validador **reprova** (trata como traço). As duas leituras convivem — ver `../docs/recertificacao.md` §4 |
| `A7.4` `A3.9` | ⚠ 15/15 | ambas `calibravel` — o limiar é default de engenharia |
| `A4.5` | ⚠ 14/15 | padding de grupo uniforme |
| `A3.7` | ✗ 8/15 | o caminho da grade dimensiona a largura só pela nuvem, e o desenho estoura o canvas |
| `A1.5` `A1.12` | ✗ sempre que houver **nota com `sobre`** | ver abaixo |

### A nota presa a nó derruba `A1.5` e `A1.12`

Nota com `sobre` desenha **como nó** — foi assim que o roteamento zerou as falhas
semânticas dela, pondo-a dentro do container do sujeito em vez de num offset fixo.
Mas `A1.5` (*todo elemento tipado*) e `A1.12` (*nenhum shape órfão*) procuram todo
objeto desenhado em `modelo.nos[]`, e a nota vive em `modelo.notas[]`. Resultado:
`n-x desenha como nó e não existe no modelo`.

Isolado em experimento, num modelo de dois nós:

```
sem nota                    → limpo
nota de rodapé (sem sobre)  → limpo
nota presa a nó (com sobre) → A1.5 e A1.12 acusam
```

Nenhum modelo de `modelo/*.json` usa `sobre`, e por isso o corpus não pega — só o
corpus de sessão usa, e o laudo dele não é asserido checagem a checagem. **É
defeito das duas checagens, não do seu modelo**: a nota é objeto desenhado
legítimo, e as duas precisam aprender a classe. Até lá, entra no piso.

Morde o protocolo: a revisão de lacunas **exige** nota ligada por `viaNota` para
todo achado recusado. Ver [`sabatina.md`](sabatina.md).

**"Tem falha" não distingue bom de quebrado neste corpus.** O que distingue é
`semanticas.length`, e ele está em **zero** no corpus inteiro.

### `A5.7` avisa de propósito

Direção de fluxo consistente passou a avisar em três páginas, e foi uma conta
paga conscientemente: com `dados: "volta"` virando dica de reversão, o eixo passou
a seguir **o dado** e a seta de uma consulta aponta para trás — que é o que ela é.
A troca foi *seta cosmética* por *ordem de leitura verdadeira*. Antes, a seta
ficava bonita e a fileira de contas saía lida de trás para frente.

Não "conserte" `A5.7` invertendo `dados`. Ver `../docs/roteamento.md` §6.

## Quando algo acusa de verdade

1. **Rode `--explicar`** — as três trilhas de auditoria, descritas no
   [`SKILL.md`](../SKILL.md).
2. **Falha semântica → o fato está errado no modelo**, não a geometria. `A4.2`
   costuma ser `dentro` apontando para o lugar errado; `A5.5`, uma travessia que o
   modelo não declara.
3. **`A8.1` estourado → decompor, não encolher.** O remédio é explícito na
   literatura. E é o mesmo movimento da sabatina: a próxima pergunta vira *"o que
   sai do diagrama?"*.
4. **`A2.1` acima de 6 entradas de legenda** é o único limite numérico
   rigorosamente derivado da pesquisa — *span of absolute judgement*. Não o
   negocie.

## Três avisos de método, cada um pago com uma tarde

- **Checagem estática não substitui render.** As 24 checagens do catálogo estavam
  verdes quando o PNG revelou um serviço saindo com o ícone errado.
- **Suíte verde sobre a semântica não substitui o portão sobre a geometria.** E
  nenhum dos dois pega um toco de linha pendurado — isso só o olho pegou.
- **Suíte verde por metade não é suíte verde.** Duas suítes já estiveram verdes
  ao mesmo tempo, cada uma contra o seu próprio motor, e nenhuma sabia o que a
  outra tinha quebrado.

## O que a evidência não sustenta

Regra popular de diagrama que **não** está nas 62 provavelmente foi medida e
reprovada. As que mais aparecem:

- **"no máximo 7±2 caixas"** é folclore aplicado a diagrama. Miller e Cowan
  mediram **memória de trabalho**, não leitura de diagrama — o diagrama fica na
  tela, é memória externa. Os cortes que a pesquisa empírica realmente encontra
  são **20 / 50 / 200 nós**, e os próprios autores do survey chamam o limiar de
  *"intuição de especialista, não pesquisa empírica"*.
- **O único limite numérico rigorosamente derivado é sobre VOCABULÁRIO, não sobre
  contagem de caixas**: ≤6 entradas de legenda, do *span of absolute judgement*.
  É o `A2.1`, e é o que não se negocia. `A8.1` (>20 avisa, >50 reprova) é
  convenção calibrada, e está rotulado como tal.
- **O remédio para diagrama grande é decompor, não encolher** — medido em mais de
  50% de ganho de compreensão.

Duas nuances que o folclore perde e que estão nas 62:

- **cruzamento a ~90° custa quase nada.** O alvo é zero cruzamentos, mas o `fail`
  é o **ângulo abaixo de 30°**, não a contagem.
- **o fundo efetivo é a pilha de grupos aninhados composta em ordem z**, não o
  fundo da página. Medir contra a página já produziu um falso negativo de
  1,00:1 lido como 13,57:1 — texto escuro sobre grupo escuro, passando folgado.
