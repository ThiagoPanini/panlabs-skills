# A travessia pela entrada rica

**Este é o turno 0 do #240 rodado sobre o material que já existia**, e o que ele existe para provar é uma coisa só: com material rico, o mapa fecha **sem uma pergunta de fato**, e o bloco de fontes do deck nasce dos ids que o mapa já carrega. O pedido é o [`BRIEF.md`](BRIEF.md) e o material é o [`DATA.md`](DATA.md); o deck que saiu é o [`matt-pocock.deck.html`](matt-pocock.deck.html), o mesmo que o [#220](https://github.com/ThiagoPanini/panlabs-skills/issues/220) construiu — o que o #240 acrescenta não é outro deck, é a **jornada** que chega a ele.

A travessia pela entrada rala, a mesma tese sem material nenhum, está em [`SURVEY-THIN.md`](SURVEY-THIN.md). As duas juntas são o que o ticket pediu: o turno 0 medido nos dois extremos da entrada.

## O que chegou, e o que foi lido por quem

Duas classes de insumo, e nenhuma delas atravessou o contexto principal como texto cru:

| classe | o que era | quem leu | o que voltou |
| --- | --- | --- | --- |
| arquivos | `BRIEF.md`, 3,3 KiB | subagente | o pedido em seis partes, a reação pedida, as duas listas do que não pode faltar e do que não pode entrar |
| arquivos | `DATA.md`, 9,2 KiB | subagente | as três fontes com id, e os três gráficos com a conta de cada número |

**Nenhuma pesquisa foi lançada**, e essa é a medição: não havia falta que a pesquisa pudesse fechar.

## O mapa de insumos

| função | o que o material já dá | o que falta | o que a skill faz |
| --- | --- | --- | --- |
| `context` | o modelo em uma frase — uma skill por tarefa, invocada por `/nome`, o humano decide e o agente apura (`BRIEF` §1); o setup por repositório (`BRIEF` §2); e o tamanho real do que se instala: 327 linhas de `SKILL.md` nos seis comandos do fluxo principal (**F2**) | — | nada |
| `tension` | a plateia já usou um agente e não sabe o que é uma skill (`BRIEF`, «o que a plateia sabe»); e o contraste que o material sustenta sozinho — 41 skills no upstream, 25 vendorizadas na curadoria instalada (**F1**, **F2**) | — | nada |
| `thesis` | a reação que o deck quer provocar, escrita no pedido: sair querendo rodar `/setup-matt-pocock-skills` no próprio repositório na segunda-feira (`BRIEF`) | — | nada |
| `evidence` | os quatro dados que o pedido exige, cada um com fonte e data: frameworks em contagem e tamanho (**F1**), linhas por `SKILL.md` (**F2**), categorias em proporção (**F1**), o pipeline como figura sob medida; e a execução da spec #207 em acumulado (**F3**) | — | nada |
| `plan` | o pipeline do grilling ao merge, com a própria spec que produziu a apresentação como caso real (`BRIEF` §3, **F3**) | — | nada |
| `call` | o pedido diz qual é: um fecho que peça a decisão **na sala** (`BRIEF`); e quem decide é cada engenheiro, no próprio repositório | — | nada |

**Seis linhas, seis preenchidas, zero buracos.** É o caso que o `SKILL.md` descreve como «material rico fecha o mapa sem uma pergunta de fato, e aí o turno 0 é uma mensagem só, com a calibragem do turno 1 vindo junto».

## Os blocos

**Um bloco, e só um.** Ele trouxe o mapa acima, as três perguntas que sobraram — e nenhuma delas é uma pergunta **de fato**, todas são de gosto —, e nenhum aviso de pesquisa, porque não houve pesquisa:

1. abrir pela manchete ou pelo número? *Recomendação: manchete — o exemplo canônico já abre pelo número, e a `difference` do cabeçalho precisa de onde morar.*
2. `motion` `editorial` ou `cinematic`? *Recomendação: `editorial`.*
3. de que três padrões este deck abre mão? *Recomendação: `cover-numbered`, `big-number`, `full-bleed-statement` — os três que a capa por manchete torna incoerentes.*

**O segundo bloco não existiu**, e a regra que o impediu é a mesma que o teria permitido: ele só existe se a pesquisa mudar a tese, e não houve pesquisa.

## O bloco de fontes, e de onde ele nasceu

Os três ids do mapa são os três `<li>` do `<sources>` do deck, na mesma ordem e com o mesmo conteúdo — **F1** a anatomia medida pelo `overpower`, **F2** o conjunto instalado nesta máquina, **F3** as issues e os PRs da spec #207. Nenhum id foi inventado no turno 2: cada um entrou no mapa antes de existir um slide, e é isso que faz as quatro réguas de procedência do [#238](https://github.com/ThiagoPanini/panlabs-skills/issues/238) serem verdes por construção e não por conserto.

## O que os outros turnos entregaram

| turno | o que saiu |
| --- | --- |
| 1 | o storyboard de 21 linhas, a direção de arte, e o **esqueleto** com a folha de contato dele |
| 2 | o deck, a folha de contato, a lista do que ficou fora, e as quatro da lista visual respondidas |
| 3 | o **artigo** em Markdown, com os desenhos ao lado |

Os comandos e o que cada um devolveu estão em [`CROSSING.md`](CROSSING.md), ao lado deste arquivo.
