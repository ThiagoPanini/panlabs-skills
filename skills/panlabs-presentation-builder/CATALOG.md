# O catálogo

**Este documento é gerado.** O registro que manda é [`compiler/catalog.py`](compiler/catalog.py): o compilador valida por ele, e o bloco abaixo sai dele. Editar este arquivo à mão não muda o que o compilador aceita — muda só o que você lê. `python3 compiler/catalog.py --check` reprova quando os dois discordam, e `--write` põe o registro de volta aqui.

**Um padrão define estrutura e slots, nunca uma medida.** Onde o texto senta, quão grande ele fica e quanto do palco ele ocupa é assunto do palco, não da fonte — um padrão que travasse uma altura seria um padrão quebrado no próximo projetor. Você escolhe o padrão e escreve o texto; a composição vem com ele.

**O orçamento é do slide, mobília inclusive.** O rótulo de uma capa e o kicker de uma pergunta são palavras que a plateia lê, e saem do mesmo teto que a manchete. Nada aqui conta o que você **fala** por cima do slide, que é onde mora tudo o que não coube.

**Os slots obrigatórios são o que mantém o palco cheio.** Todo padrão deste primeiro catálogo diz poucas palavras, e poucas palavras é exatamente o que deixa metade do telão apagado — o portão de render reprova o slide cujo conteúdo ocupa menos de 40% da altura do palco. Um slide de duas palavras sobrevive a esse piso tendo uma **âncora** e um **horizonte**: uma coisa pequena na borda de cima e uma coisa grande embaixo, com o palco entre as duas. É por isso que uma capa exige a linha de `meta` e uma pergunta-pivô exige o `kicker`; sem eles o padrão perde a capacidade de segurar o palco, faça o tema o que fizer.

**Um grupo é uma série, e é a primeira vez que este catálogo precisa de uma (#212).** `número gigante`, `tabela` e `linha do tempo` dizem mais de um fato por slide, e um slot dito uma vez não segura isso. Onde há um grupo, o slide carrega um `<ul>`, um `<ol>` ou um `<table>` — sem `class=` em nenhum dos dois, porque cada padrão tem no máximo um grupo e a própria tag já diz o que é. Um item é um `<li>` (ou uma `<tr>` de uma tabela), com os campos do grupo escritos exatamente como um slot: um `<p>` por campo, o nome do campo na `class=`.

**O que não cabe no slide vai para as notas, e o slide pode chegar em batidas (#215).** Um `<notes>` por seção guarda o que você fala por cima, fora do orçamento de palavras e fora do palco — ele viaja para um painel que só quem apresenta abre. E um slot marcado com o `step` pelado só aparece depois de um avanço, na ordem em que o padrão lê os slots: é uma escolha de ritmo, não de composição, e por isso o palco não se mexe quando a batida cai. O que o portão de render recusa é o palco em branco antes da primeira delas.

**Um ícone é o nome de um slot, nunca um atributo.** O slot de papel **ícone** carrega só o nome Lucide como texto — `<p class="item-1-icon">circle-check</p>` — porque a mesma regra de sempre vale aqui: um slot carrega `class=` e nada mais. O compilador confere o nome contra o conjunto vendorizado em [`themes/base/icons/`](themes/base/icons/) e escreve, na página construída, só os ícones que o deck de fato usa — nunca o conjunto inteiro. A licença do conjunto está ao lado, em [`themes/base/icons/LICENSE`](themes/base/icons/LICENSE).

**O gráfico é um grupo que o compilador desenha em vez de imprimir (#213).** Você escreve a tese, a unidade, a fonte datada e a série — rótulo e valor por ponto —, e a `<section>` ganha um `type=` a mais dizendo em que forma. O que chega à página é um SVG gerado, e a medição do [#94](https://github.com/ThiagoPanini/panlabs-skills/issues/94) é o motivo de ser assim: o mesmo gráfico de barras custou 30 linhas e 79 coordenadas escritas à mão contra duas linhas de dado por um gerador, e o eixo do gerador saiu melhor do que o da mão. **Nenhuma cor é escrita no SVG** — cada marca leva uma classe, e o tema pinta; é assim que o mesmo gráfico troca de identidade junto com o deck. **Um valor é um número puro**, dígitos com vírgula decimal: a unidade mora no slot `unit`, e o número é desenhado exatamente como foi escrito. **Rótulo tem largura máxima**, porque SVG não mede texto e um rótulo comprido não quebra linha nem reclama — ele passa por baixo do vizinho ou sai pela borda; o compilador recusa antes, dizendo em quantos caracteres ele cabe.

**A figura é o slot que este catálogo não limita (#214).** Todo padrão acima diz o que vai dentro dele; `figura com legenda` diz apenas **de que** a figura pode ser feita, porque o momento em que o catálogo não tem o que o slide pede — um ciclo, um organograma, um fluxo — é o momento que a spec se recusa a sacrificar. Você escreve um `<svg>` e desenha, ou aponta um `<img src="…"/>` para um arquivo e o compilador o embute em base64. Sem `title`, a figura fica com o palco inteiro; com ele, divide. **Toda cor é do tema**: `fill` e `stroke` só aceitam `none` ou `var(--token)`, e é isso que faz o mesmo desenho trocar de identidade junto com o deck. **O vocabulário do desenho é fechado**, e é ele — e não uma regra por ameaça — que recusa `<script>`, `<use>`, `href=` e `style=`. **E o arquivo é conferido antes de virar página**: caminho que não existe, peso acima do teto e bytes que não são do formato que a extensão promete recusam a construção, que é como «retrato vazio proibido» deixa de ser doutrina e vira régua.

[`examples/few-words.deck.html`](examples/few-words.deck.html) é um deck de sete slides, um por padrão de poucas palavras; [`examples/statement.deck.html`](examples/statement.deck.html) é a afirmação de tela cheia sozinha; [`examples/evidence.deck.html`](examples/evidence.deck.html) é um deck de quatro slides, um por padrão que carrega uma série; [`examples/side-by-side.deck.html`](examples/side-by-side.deck.html) cobre colunas, comparação e lista com ícones; [`examples/charts.deck.html`](examples/charts.deck.html) tem um slide por forma de gráfico; [`examples/figure.deck.html`](examples/figure.deck.html) cobre as duas metades da figura e as duas composições dela; [`examples/presenting.deck.html`](examples/presenting.deck.html) é o deck do próprio palco, com notas do apresentador em todo slide e fragmentos em três deles. Os sete compilam pelo comando documentado no [`SKILL.md`](SKILL.md).

<!-- catalog:begin -->

O cabeçalho é o próprio `<deck>`, e todos os campos dele são obrigatórios: `title`, `occasion`, `theme`, `lang`, `minutes`, `motion`. Um slot é um `<p>` com o nome do slot na `class=` — e, no máximo, o `step` pelado que faz dele um fragmento. O vocabulário de ênfase inline fecha em três marcações: `<strong>` e `<mark>`, sempre disponíveis, e `<br/>` (quebra forçada), disponível só nos padrões que o dizem.

`motion` é o perfil de movimento do deck, e vale um destes: `static`, `editorial`, `cinematic`. Ele decide como um slide chega e como um fragmento entra, e mais nada; numa máquina que pediu menos movimento nenhuma animação roda, seja qual for o perfil.

São 18 padrões, na ordem do arco. O orçamento é do slide inteiro, mobília inclusive, e nenhum slide passa de 90 palavras seja qual for o padrão.

### `cover-headline` · até 25 palavras

A capa que abre pela manchete — o deck se apresenta pelo que afirma.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `kicker` | metadado | não | o rótulo curto que situa o deck antes do título |
| `title` | afirmação | sim | a manchete: o que este deck afirma |
| `subtitle` | corpo | não | uma frase que estende a manchete |
| `meta` | metadado | sim | a ocasião e a data, na base do palco |

### `cover-numbered` · até 25 palavras

A capa que abre por um número, com o título dizendo o que ele mede.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `number` | número | sim | o número que abre a capa, no maior corpo do palco |
| `title` | afirmação | sim | o que o número quer dizer, logo abaixo dele |
| `meta` | metadado | não | de onde veio o número, e quando foi medido |

### `pivot-question` · até 12 palavras

A pergunta que vira a apresentação, em corpo de display.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `kicker` | metadado | sim | o rótulo que avisa a plateia de que vem uma pergunta |
| `question` | afirmação | sim | a pergunta em que a apresentação vira |

### `thesis-title` · até 25 palavras

A tese no alto e uma frase só no pé, com o palco inteiro entre as duas.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `title` | afirmação | sim | a tese, com verbo ou número |
| `sentence` | corpo | sim | a única frase que sustenta a tese |

### `big-number` · até 25 palavras

Um número gigante e a legenda que diz o que ele prova.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `number` | número | sim | o número, sozinho no maior corpo do palco |
| `caption` | afirmação | sim | o que o número prova |
| `meta` | metadado | não | de onde veio o número, e quando foi medido |

### `inline-metrics` · até 48 palavras

De duas a quatro métricas lado a lado, cada uma com seu número e seu rótulo.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `claim` | afirmação | sim | o que as métricas, juntas, provam |

De 2 a 4 `<li>` dentro de um `<ul>`, sem `class=` em nenhum dos dois — cada `<li>` é uma métrica, com seu `value` e seu `label`.

| campo | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `value` | número | sim | o número da métrica |
| `label` | metadado | sim | o que esse número mede |

### `timeline` · até 60 palavras

De três a seis marcos em sequência, um deles podendo ser o momento presente.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `claim` | afirmação | sim | o que a linha do tempo prova |

De 3 a 6 `<li>` dentro de um `<ol>`, sem `class=` em nenhum dos dois — cada `<li>` é um marco, com seu `label` e sua `date`. `<li now>` marca o momento presente, em no máximo um `<li>`.

| campo | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `label` | nome | sim | o nome do marco |
| `date` | metadado | sim | quando o marco aconteceu |

### `table` · até 90 palavras

Uma tabela com cabeçalho obrigatório e até seis linhas ao todo, cabeçalho incluído.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `claim` | afirmação | sim | o que a tabela prova |

Um `<table>` sem `class=`, com um `<thead>` de um `<tr>` de `<th>` (o cabeçalho, obrigatório) e um `<tbody>` de um a 5 `<tr>` de `<td>` — 6 linhas ao todo, cabeçalho incluído, e toda linha do corpo com o mesmo número de células que o cabeçalho.

### `chart` · até 60 palavras

Um gráfico desenhado a partir dos dados escritos no próprio slide, com título-tese e fonte datada.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `title` | afirmação | sim | a tese que o gráfico prova — com verbo ou número |
| `unit` | metadado | sim | em que unidade os valores estão, ou o que os cem por cento somam |
| `source` | metadado | sim | de onde veio o dado, e quando foi medido — a data é obrigatória |

De 2 a 12 `<li>` dentro de um `<ul>`, sem `class=` em nenhum dos dois — cada `<li>` é um ponto da série, com seu `label` e seu `value`. `<li mark>` marca o ponto que o slide é sobre, na cor de acento, em no máximo um `<li>`.

| campo | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `label` | nome | sim | o nome do ponto |
| `value` | número | sim | o número do ponto — dígitos, com vírgula decimal e sem unidade |

A série não é impressa, é desenhada: a `<section>` carrega um `type=` a mais, que diz em que forma. São 6 formas, e cada uma tem a sua faixa de pontos — fora dela a construção recusa.

| `type=` | pontos | o que desenha |
| --- | --- | --- |
| `bars-h` | 2 a 6 | barras horizontais — cada rótulo tem uma coluna só dele, e é a forma que aceita rótulo longo |
| `bars-v` | 2 a 8 | barras verticais — o rótulo fica sob a coluna, e por isso precisa ser curto |
| `line` | 3 a 8 | uma linha sobre uma grade com eixo, para a evolução de uma medida no tempo |
| `area` | 3 a 8 | a mesma linha com a área preenchida até o zero, para volume em vez de posição |
| `sparkline` | 4 a 12 | a linha sem eixo nem grade, com o último valor em destaque — a tendência, e um número |
| `share` | 2 a 3 | uma barra empilhada de fatias que somam cem, uma por cor que o tema empresta |

Todo valor é um número — dígitos, com vírgula decimal e nada mais: a unidade mora no slot `unit`, e o número é desenhado do jeito que foi escrito. Negativo recusa. Numa forma de proporção (`share`) os valores têm de somar exatamente 100.

### `figure-caption` · até 48 palavras

Uma figura desenhada sob medida, ou uma imagem embutida por caminho, com a legenda embaixo.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `title` | afirmação | não | a tese que a figura prova — sem ela, a figura fica com o palco inteiro |
| `caption` | metadado | sim | o que a figura mostra, e de onde ela veio — é também o texto alternativo |

A figura não é um slot de texto, e não leva `class=`: ou é um `<svg>` que você desenha, ou é um `<img>` apontando para um arquivo — a tag já diz qual dos dois.

Um `<svg>` precisa do `viewBox` e é montado só com estes elementos — `<g>`, `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`, `<text>`, `<tspan>` — que só aceitam estes atributos: `viewBox`, `d`, `points`, `x`, `y`, `width`, `height`, `rx`, `ry`, `cx`, `cy`, `r`, `x1`, `y1`, `x2`, `y2`, `dx`, `dy`, `transform`, `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-dasharray`, `opacity`, `fill-opacity`, `stroke-opacity`, `font-size`, `text-anchor`, `dominant-baseline`. Qualquer outra tag ou atributo recusa, `<script>`, `<use>`, `href=` e `style=` inclusive.

Toda cor vem do tema: `fill` e `stroke` só aceitam `none` ou `var(--token)`, e os tokens são `--surface`, `--ink`, `--ink-muted`, `--accent`, `--content-1`, `--content-2`, `--hairline-faint`, `--hairline`, `--hairline-strong`. Um hexadecimal, um `rgb()`, um nome de cor ou um `url()` recusam — é o que faz a mesma figura trocar de identidade junto com o deck.

Um `<img>` carrega só `src=`, um caminho de arquivo — relativo à fonte do deck, ou absoluto — e nunca uma URL. O compilador embute o arquivo em base64: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, até 2,0 MB cada. Caminho que não existe, arquivo acima do teto e bytes que não são do formato que a extensão promete recusam a construção — um retrato vazio nunca chega ao palco.

### `full-bleed-statement` · até 12 palavras

Uma frase em corpo de display, segurando o palco sozinha.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `statement` | afirmação | sim | a frase que o slide inteiro sustenta |

### `two-columns` · até 60 palavras

A tese no alto, sustentada por dois argumentos lado a lado — admite `<br/>` na prosa.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `title` | afirmação | sim | a tese que as duas colunas sustentam |
| `column-a` | corpo | sim | o primeiro argumento |
| `column-b` | corpo | sim | o segundo argumento |

### `three-columns` · até 75 palavras

A tese no alto, sustentada por três argumentos lado a lado — admite `<br/>` na prosa.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `title` | afirmação | sim | a tese que as três colunas sustentam |
| `column-a` | corpo | sim | o primeiro argumento |
| `column-b` | corpo | sim | o segundo argumento |
| `column-c` | corpo | sim | o terceiro argumento |

### `comparison` · até 75 palavras

Dois lados nomeados e postos lado a lado, com uma hairline entre eles — admite `<br/>` na prosa.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `title` | afirmação | sim | a tese que a comparação decide |
| `label-a` | metadado | sim | o nome do primeiro lado |
| `label-b` | metadado | sim | o nome do segundo lado |
| `body-a` | corpo | sim | o que se diz do primeiro lado |
| `body-b` | corpo | sim | o que se diz do segundo lado |

### `icon-list` · até 60 palavras

Até cinco itens, cada um com seu ícone — nunca um marcador solto.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `title` | afirmação | sim | a tese que a lista sustenta |
| `item-1-icon` | ícone | sim | o ícone do primeiro item |
| `item-1-text` | corpo | sim | o primeiro item |
| `item-2-icon` | ícone | não | o ícone do segundo item |
| `item-2-text` | corpo | não | o segundo item |
| `item-3-icon` | ícone | não | o ícone do terceiro item |
| `item-3-text` | corpo | não | o terceiro item |
| `item-4-icon` | ícone | não | o ícone do quarto item |
| `item-4-text` | corpo | não | o quarto item |
| `item-5-icon` | ícone | não | o ícone do quinto item |
| `item-5-text` | corpo | não | o quinto item |

### `pull-quote` · até 30 palavras

Uma citação segurando o palco, com a atribuição na base.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `quote` | afirmação | sim | a frase citada, na voz de quem a disse |
| `attribution` | metadado | sim | quem disse, e em que papel |

### `section-divider` · até 8 palavras

O respiro entre duas seções — um número no alto, o nome embaixo.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `index` | número | sim | o número da seção que começa, no alto do palco |
| `title` | nome | sim | o nome da seção, no pé do palco |

### `closing-call` · até 30 palavras

O fecho que volta à tese e pede alguma coisa.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `thesis` | corpo | sim | a tese, relembrada em uma linha |
| `call` | afirmação | sim | o que você pede à plateia |
| `meta` | metadado | não | onde a conversa continua depois do deck |

### Títulos que reprovam

Um slot de papel **afirmação** que diga só uma destas reprova a construção — a categoria nomeia a pasta, não o ponto:

«visão geral», «agenda», «introdução», «conclusão», «próximos passos», «contexto», «resumo», «obrigado».

### Quebra forçada

`<br/>` só é aceito, vazio e sem atributo, dentro da prosa destes padrões — nos demais a construção recusa: `two-columns`, `three-columns`, `comparison`.

### Notas do apresentador

Um slide carrega no máximo um `<notes>`, sem `class=` e sem atributo — a tag já diz o que é. O que vai nele é prosa, com as mesmas marcações de ênfase e com `<br/>` sempre disponível, e **não conta no orçamento de palavras**: a nota é lida por uma pessoa num painel, não pela sala num telão. Nada dela chega ao palco. Um `<notes>` vazio reprova — ou escreva a nota, ou tire a tag.

### Fragmentos

Um slot marcado com o `step` pelado (`<p class="sentence" step>`) só aparece depois que o apresentador avança. A ordem é a ordem em que o padrão lê os slots, nunca um número escrito no atributo — `step="2"` reprova. Dois slots que o registro emparelha (o ícone e o texto de um item) entram no mesmo passo, e marcar um sem marcar o outro reprova. Um item de grupo não é fragmento: uma série é uma prova só, e meia linha do tempo é uma linha do tempo mentindo sobre o próprio eixo.

**O passo zero não pode ser vazio.** Marcar todos os slots deixa o palco em branco até o primeiro avanço, e a sala lê isso como um slide que não carregou; o portão de render reprova, e o conserto é tirar o `step` de um deles.

<!-- catalog:end -->
