---
name: panlabs-aws-diagrams
description: Desenha arquitetura AWS em draw.io numa jornada de três turnos — uma rodada de perguntas sobre o que a descrição não determinou, o desenho das duas vistas por motor determinístico com validador geométrico, e ajuste sob demanda. Use ao pedir, desenhar ou revisar um diagrama AWS; ao escolher entre arquiteturas antes de desenhar; e ao retomar um `.drawio` gerado numa sessão anterior.
---

# panlabs-aws-diagrams

> **O agente escreve o QUE existe. O motor calcula ONDE fica.**

A **fronteira** não é disciplina, é gramática: `schema.json` não tem nenhuma propriedade que nomeie posição, tamanho, distância ou direção. Não existe onde escrever uma coordenada. Escreva semântica — quais recursos existem, quem contém quem, quem fala com quem — e pare.

E a razão de a skill existir não é bonita, é estrutural: **nenhuma checagem geométrica sabe se a arquitetura desenhada existe.** O validador guarda o **desenho**; a **pergunta** guarda o **fato**. É por isso que a jornada começa perguntando — e é por isso que ela pergunta **uma vez**, sobre o que a descrição não determinou, em vez de sabatinar até uma família de checagem fechar: a checagem mede o modelo, e antes do desenho não existe modelo para medir.

Os comandos abaixo rodam a partir da **raiz da skill — o diretório onde este próprio `SKILL.md` está**, não um caminho fixo: instalada, essa raiz é `<projeto>/.claude/skills/panlabs-aws-diagrams/` ou `~/.claude/skills/panlabs-aws-diagrams/`, nunca `skills/panlabs-aws-diagrams/` — esse é o caminho da árvore de desenvolvimento. Todo `<raiz-da-skill>` usado adiante é essa mesma frase. Há **uma exceção que decide onde o seu trabalho vai parar**: o verbo de caso resolve o destino subindo do **diretório corrente** até a raiz do repositório git, então ele roda de dentro do projeto que vai receber o diagrama. Rodá-lo da raiz da skill grava o resultado no repositório da própria skill — que é exatamente o defeito que a jornada nova existe para não repetir.

Node 18+, e nada além dele: o `elkjs` vai embarcado, nenhum `npm install`, nenhuma rede. **Nada é gravado dentro desta árvore** — o resultado nasce no projeto de quem chamou, e os arquivos de trabalho no temporário do sistema.

## A jornada

Três turnos: **pergunta, desenho, ajuste**. Os sete passos do arco continuam existindo como capacidade — eles voltam a ser sequenciais [em dois gatilhos](#quando-o-arco-volta-a-ser-sequencial) —, o que muda é que deixam de ser sete portões com turno próprio.

Porque o preço é assimétrico: **pergunta respondida no escuro é a pergunta cara, e diagrama errado que aparece em trinta segundos é barato de corrigir.** Quem chega com um descritivo em prosa quer um desenho para reagir, não sete portões.

### Turno 1 · A pergunta

A skill é invocada junto de um descritivo — prosa, ata de reunião, documento, foto de quadro branco. Duas outras portas entram por outro lugar, e a primeira coisa a fazer é reconhecer qual delas é:

| entrada | o que rodar |
|---|---|
| descritivo em prosa, ata, foto de quadro branco | nada — é este turno |
| um `.drawio` de sessão anterior | `node tools/resume.cjs <arquivo.drawio>` — o briefing volta, e nada dele se pergunta de novo |
| um modelo já escrito (`model@1`) | `node engine/generate.cjs <modelo.json> --output <destino.drawio>` — e pare aqui, a jornada acabou |

**Uma rodada, inteira de uma vez, cada pergunta numerada e com a sua recomendação.** Nunca pergunte fato que você mesmo pode descobrir — a rodada é curta por conteúdo, não por corte.

**A regra de parada é *perguntei o que a descrição não determinou*.** Ela é uma lista, não um julgamento:

- os **eixos de forma** `E1–E5` que a descrição deixou em aberto — `E1` computação · `E2` integração · `E3` estado e dados · `E4` exposição de rede · `E5` fronteira de responsabilidade;
- mais **qualquer fato cuja ausência faria o desenho afirmar algo falso** — quem inicia uma travessia, se um dado sensível mora em subnet pública, se uma fronteira é conta ou grupo.

`A1` — a família de completude — **não roda aqui**. Ela roda no turno 2, depois do desenho, porque ela mede o modelo e o modelo não existe antes de desenhar. O protocolo inteiro está em [`guide/inquiry.md`](guide/inquiry.md).

**A `/grilling`, quando ela existe.** Verifique se a skill está no ambiente. Existindo, use-a — com **teto de uma rodada**. Não existindo, aplique o mesmo formato, que está escrito em [`guide/inquiry.md`](guide/inquiry.md) e não depende de nada de fora. O empréstimo é de **forma** — rodada inteira de uma vez, pergunta numerada com recomendação, nunca perguntar fato descobrível — e **nunca de regra de parada**: aquela skill para quando a fronteira dela esvazia, e aqui o teto é uma rodada. **Nenhum comando desta skill a invoca**, e nenhuma instrução daqui pressupõe que ela exista: o caminho de fallback é o caminho principal.

**Proponha o título e mostre o `case-slug` que sai dele, nesta rodada.** É a última chance de renomear antes de qualquer escrita em disco — e até aqui **nada foi escrito**.

**Fecha quando** a rodada saiu inteira, numerada e com recomendação, e o `case-slug` foi mostrado. Uma rodada, e só: o que não foi perguntado agora vira chute declarado ou vira o arco sequencial, nunca uma segunda rodada.

### Turno 2 · O desenho

Escolha a candidata que **você** recomendaria e desenhe. As alternativas saem **junto** do desenho, não antes dele — o humano compara formas olhando uma delas pronta.

Resolva todo nome de serviço pelo catálogo **antes** de escrevê-lo:

```bash
node catalog/aws-shapes.cjs "kinesis data firehose" opensearch "availability zone"
```

Escreva um `session@1` com `stage: "technical"` — um IR, dois casacos sobre os mesmos nós: o lógico diz a **capacidade**, o técnico diz o **serviço** e o `resource`. **O contrato é [`session/schema.json`](session/schema.json)**, e é ele que descreve os dois casacos campo a campo; [`guide/model.md`](guide/model.md) traz o que o esquema não consegue dizer sobre si mesmo. Em [`examples/session/`](examples/session/) ficam três arquivos: a sessão lógica, o delta do **arco sequencial**, e [`retail-technical.json`](examples/session/retail-technical.json) — o resultado já pronto de aplicar o delta à sessão lógica, no mesmo [one-liner de `elaborate`](#quando-o-arco-volta-a-ser-sequencial) que gera o seu.

Grave a sessão e o descritivo fora desta árvore, e rode o verbo **de dentro do projeto que vai receber o diagrama** — é o diretório corrente que decide o destino:

```bash
node <raiz-da-skill>/tools/case.cjs /tmp/<case-slug>.session.json <case-slug> --brief /tmp/<case-slug>.brief.txt
```

Sai um diretório em `docs/architecture/diagrams/<case-slug>/`, a partir da raiz do repositório git de quem chamou — criado quando não existe, e fora de repositório git cai no diretório corrente **com aviso**. Dentro dele, **um** `.drawio` com as duas vistas, lógica primeiro, com a sessão embutida uma cópia por página — apagar uma aba não impede retomar pelas outras —, e um `case.md` de cinco seções fixas. Com `--image`, e existindo o binário do draw.io, sai também o PNG; não existindo, **avisa e segue**.

**Duas abas é o piso, não o teto.** A vista lógica sai em uma página — o casaco lógico não tem como declarar conta, `account` não está entre os três `kind` que ele aceita —, e a **técnica** sai em `1+N`: uma consolidada mais uma por conta, assim que o modelo tem **duas contas ou mais**. Com uma conta, ou nenhuma, `N` é zero e o arquivo abre com as duas abas de sempre; com as três contas do par de [`examples/session/`](examples/session/), abre com **cinco**. O corte é **estrutural**, não gatilho de saturação: as de detalhe saem no mesmo comando que a consolidada, e o porquê está em [`guide/model.md`](guide/model.md). Vista de detalhe que não sai **avisa e segue** — o arquivo grava sem ela, nomeando a conta e o motivo.

**O portão de veracidade está ligado por padrão neste caminho** (`--gate truthfulness`). Sem humano entre as duas vistas, é ele que recusa gravar um desenho que afirma fronteira de rede que o modelo nega.

**Todo nome de recurso é inferido**, e o `case.md` os lista num bloco só para conferir num turno. **Nunca invente um nome em silêncio** — o diagrama passaria a afirmar um recurso que não existe.

**Com um eixo de forma ainda em aberto, desenhe com a recomendação e declare qual foi o chute** — em prosa, neste turno, e como fato `inferred` no dossiê, com o `from` dizendo de onde saiu. Com **dois ou mais**, não desenhe: [o arco vira sequencial](#quando-o-arco-volta-a-ser-sequencial).

**Agora, e não antes, medem-se o modelo e o grafo.** A exceção do verbo de caso já terminou: volte para a **raiz da skill** — os três comandos abaixo são de novo relativos a ela, não ao projeto de quem chamou. As duas checagens comem `model@1`, então projete a sessão primeiro:

```bash
node -e "const {project}=require('./session/project.cjs');
  require('fs').writeFileSync('/tmp/projection.json',
    JSON.stringify(project(require('/tmp/<case-slug>.session.json'),'technical').model));"
node tools/check-geometry.cjs /tmp/projection.json
node tools/review-gaps.cjs /tmp/projection.json
```

**O laudo sai vermelho em `A1.2`/`A1.3`/`A1.11` mesmo num desenho correto — dívida conhecida do corpus inteiro, não do seu modelo.** Não entre em loop de conserto atrás dessas três: o piso está explicado em [`guide/inquiry.md`](guide/inquiry.md) e em [`guide/report.md`](guide/report.md).

A **revisão de lacunas** — SPOF, single-AZ, egress sem controle, dado em subnet pública, cross-account sem confiança, assíncrono sem DLQ — **relata e propõe; ela não bloqueia**. Ela sai no mesmo turno que o desenho, e vira a seção 5 do `case.md`. Consertar um SPOF calado produz um diagrama bonito de uma arquitetura que não existe, e nada a jusante pega isso.

Todo achado recusado continua precisando de `viaNote` apontando para uma entrada de `notes` com `origin: "rejected-finding"`. **É o elo que faz a recusa sobreviver até o desenho** — sem ele, *"SPOF conhecido e aceito"* fica só no dossiê e o diagrama volta a enganar calado.

**Fecha quando** o comando gravou os dois arquivos e você entregou, no mesmo turno: o desenho, as candidatas que não escolheu com o `because` de cada uma, os nomes de recurso que inferiu, os achados de lacuna, e o chute declarado quando houve um.

### Turno 3 · O ajuste

Sob demanda, quantas vezes o usuário quiser. A primeira versão é um começo, não um veredito.

Corrija o `session@1` e rode o mesmo comando do turno 2 com o mesmo `case-slug`: o diretório é reescrito no lugar, e regerar o mesmo modelo produz o mesmo arquivo byte a byte — o selo não tem relógio, então o `.drawio` versiona com diff limpo.

Quando o desenho sair diferente do esperado, `--explain` é a primeira coisa a rodar: ele mostra como cada nome caiu no catálogo, de onde saiu a camada de rede de cada subnet, e o laudo geométrico página a página.

**Fecha quando** o usuário parar de pedir ajuste. Não há portão aqui, e é de propósito: turno que fecha por checagem é turno que discute com quem está pedindo.

## Quando o arco volta a ser sequencial

Dois gatilhos, e **os dois se conferem sem julgamento**:

| | gatilho | como se confere |
|---|---|---|
| 1 | o usuário pede para ver as opções antes | ele pediu |
| 2 | **dois ou mais** dos cinco eixos continuam em aberto depois da rodada do turno 1 | conte os eixos `E1–E5` sem resposta: `≥2` promove |

Com dois eixos em aberto, desenhar é cara-ou-coroa, e mostrar candidatas sai mais barato que desenhar duas vezes. Com **um**, desenha-se com a recomendação e declara-se o chute — voltar ao arco por um eixo custa um turno para economizar um palpite.

No arco sequencial as candidatas vêm **antes** do desenho: teto 3, piso 2, e diga por quê quando entregar menos. Cada uma carrega sua tupla `E1–E5`, apresentada em **compra / paga / escolha se / errada se** mais a sua recomendação. **O invariante de tupla vale nos dois caminhos**: todo par difere em ≥1 eixo e o campo `differsIn` guarda em qual — tuplas iguais colapsam e são descartadas. As descartadas ficam no dossiê com o `because`, que é o que responde *"por que não a B?"* seis meses depois.

Escolhida uma, a aprovação vira **registro conferível**: `approve` guarda o recorte da projeção lógica e `check` reprojeta o modelo de hoje e compara. **O que ela deixou de fazer é travar a vista técnica** — quem guarda essa fronteira agora é o portão de veracidade, por máquina.

```bash
node tools/approve.cjs /tmp/<case-slug>-logical.json --by <quem> --output /tmp/<case-slug>.drawio
node tools/resume.cjs /tmp/<case-slug>.drawio --delta /tmp/<case-slug>-elaboration.json
```

`--candidate` sai do próprio dossiê — a vencedora está marcada com `state: "chosen"` —; passe-o à mão só quando nenhuma estiver marcada. O `resume` sai com **2** quando a elaboração mudou o que foi aprovado, e aí a resposta certa é aprovação nova, não desenho novo.

Os dois caminhos convergem no verbo de caso, que é o que grava no projeto de quem chamou:

```bash
node -e "const {elaborate}=require('./session/elaborate.cjs');
  require('fs').writeFileSync('/tmp/<case-slug>.session.json',
    JSON.stringify(elaborate(require('/tmp/<case-slug>-logical.json'),
                             require('/tmp/<case-slug>-elaboration.json'))));"
```

## Os comandos

| | |
|---|---|
| `node tools/case.cjs <sessao.json> <slug> --brief <b.txt>` | o turno 2: as duas vistas e o `case.md`, em `docs/architecture/diagrams/<slug>/` do projeto de quem chamou. **Rode do diretório desse projeto** — o destino sobe do diretório corrente. `--gate` (padrão `truthfulness`) · `--image` |
| `node engine/generate.cjs <m.json> --output <x.drawio>` | desenha um `model@1` direto. `--theme light\|dark\|corporate` · `--flow solid\|dashed\|animated` · `--gate none\|truthfulness\|failure\|strict` · `--explain` |
| `node tools/check-geometry.cjs <m.json>` | o laudo das 62 checagens. `--examples` roda os exemplos que a skill embarca, `--json` para ler no código, `--theme` avalia o tema pedido (padrão `light`) |
| `node tools/review-gaps.cjs <m.json>` | a revisão de lacunas |
| `node catalog/aws-shapes.cjs <nome>...` | resolve nome → shape, com as correções aplicadas |
| `node tools/approve.cjs <sessao.json>` | o arco sequencial: aprova a vista lógica e grava o `.drawio` que retoma. `--by` · `--candidate` · `--at` · `--output` |
| `node tools/resume.cjs <arq.drawio>` | reconhece o arquivo, classifica as páginas e imprime o briefing. Com `--delta <d.json>`, elabora a vista técnica e grava as duas |
| `node session/publish.cjs <arq.drawio>` | a cópia que sai de casa: poda o que é sobre **pessoas** e sobre **caminhos não tomados**, e mantém o que é sobre a arquitetura desenhada |

O `.drawio` do caso carrega a deliberação — candidatas descartadas com o motivo, achados recusados, quem aprovou —, tudo legível em *Extras › Editar diagrama*. **O arquivo que retoma e o arquivo que circula não são o mesmo arquivo**: para mandar para fora, gere a cópia publicada.

## O que o motor recusa, e por quê

Recusa alto em vez de desenhar errado. Toda recusa vem com a lista do que consertar.

| recusa | porque |
|---|---|
| modelo fora do esquema | o contrato é o contrato — e a mensagem sugere o vizinho (`"insidee"` → *você quis dizer "inside"?*) |
| XML mal formado | o draw.io renderiza **truncado com código 0**. O renderizador não reclama, então quem reclama é o gerador |
| tema que reprova no contraste | rótulo que some não dá erro em lugar nenhum. `--force` gera assim mesmo, para o estrago poder ser visto |
| subnet sem camada de rede, no caminho da grade | a ordem das linhas **é** o desenho, e ordem inventada põe a camada de dados em cima |
| desenho que afirma fronteira que o modelo nega | é o portão de veracidade, ligado por padrão no verbo de caso. `--gate none` desliga, para o estrago poder ser visto |
| sessão no estágio lógico, no verbo de caso | as duas vistas são o ponto de um caso, e uma sessão sem casaco técnico só tem uma para desenhar |
| laudo incompleto, em qualquer nível de portão | se uma família de checagem parou de rodar, o verde não quer dizer nada |

Recusa é **para o agente, não para o humano**: é ida e volta de máquina, não uma pergunta nova.

## A régua

A suíte de testes e o corpus de modelos que ela come **moram fora desta árvore, no workspace irmão, e não são lidos nem rodados por quem executa a skill** — 8 camadas. As sete primeiras rodam em qualquer máquina; só o render precisa do draw.io headless e, sem o binário, avisa e segue. O render é dependência de **desenvolvimento**; a skill publicada não carrega nenhuma.

Uma suíte verde sobre a semântica **não substitui** o portão sobre a geometria, e nenhum dos dois substitui olhar o PNG — o corpus tem caso de 24 checagens estáticas verdes com o ícone errado no desenho.

## Onde está o resto

| leia quando | |
|---|---|
| for fazer a rodada do turno 1, ou precisar do arco sequencial inteiro | [`guide/inquiry.md`](guide/inquiry.md) |
| for escrever ou corrigir um modelo, e o esquema não bastar | [`guide/model.md`](guide/model.md) |
| a empresa tiver premissas de arquitetura, ou não tiver | [`guide/context-pack.md`](guide/context-pack.md) |
| o laudo acusar, ou o portão barrar | [`guide/report.md`](guide/report.md) |
| pedirem fundo escuro, cor da casa, fluxo animado ou uma cópia para circular | [`guide/visual.md`](guide/visual.md) |

Os contratos são a fonte da verdade e estão versionados — leia o arquivo, não uma cópia dele: [`schema.json`](schema.json) (`model@1`, o que o motor come), [`session/schema.json`](session/schema.json) (`session@1`, o que persiste entre conversas e o que o verbo de caso lê), [`theme/schema.json`](theme/schema.json) (`theme@1`, o vocabulário fechado de estilo) e [`session/elaboration.schema.json`](session/elaboration.schema.json) (`elaboration@1`, o delta da fase técnica). Os quatro são varridos por `check-single-schema.cjs`, e `model@1` e o casaco técnico de `session@1` têm paridade de campo conferida por `check-technical-parity.cjs` — os dois na régua do workspace irmão.
