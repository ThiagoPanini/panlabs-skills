# O catálogo

**Este documento é gerado.** O registro que manda é [`compiler/catalog.py`](compiler/catalog.py): o compilador valida por ele, e o bloco abaixo sai dele. Editar este arquivo à mão não muda o que o compilador aceita — muda só o que você lê. `python3 compiler/catalog.py --check` reprova quando os dois discordam, e `--write` põe o registro de volta aqui.

**Um padrão define estrutura e slots, nunca uma medida.** Onde o texto senta, quão grande ele fica e quanto do palco ele ocupa é assunto do palco, não da fonte — um padrão que travasse uma altura seria um padrão quebrado no próximo projetor. Você escolhe o padrão e escreve o texto; a composição vem com ele.

**O orçamento é do slide, mobília inclusive.** O rótulo de uma capa e o kicker de uma pergunta são palavras que a plateia lê, e saem do mesmo teto que a manchete. Nada aqui conta o que você **fala** por cima do slide, que é onde mora tudo o que não coube.

**Os slots obrigatórios são o que mantém o palco cheio.** Todo padrão deste primeiro catálogo diz poucas palavras, e poucas palavras é exatamente o que deixa metade do telão apagado — o portão de render reprova o slide cujo conteúdo ocupa menos de 40% da altura do palco. Um slide de duas palavras sobrevive a esse piso tendo uma **âncora** e um **horizonte**: uma coisa pequena na borda de cima e uma coisa grande embaixo, com o palco entre as duas. É por isso que uma capa exige a linha de `meta` e uma pergunta-pivô exige o `kicker`; sem eles o padrão perde a capacidade de segurar o palco, faça o tema o que fizer.

**Um grupo é uma série, e é a primeira vez que este catálogo precisa de uma (#212).** `número gigante`, `tabela` e `linha do tempo` dizem mais de um fato por slide, e um slot dito uma vez não segura isso. Onde há um grupo, o slide carrega um `<ul>`, um `<ol>` ou um `<table>` — sem `class=` em nenhum dos dois, porque cada padrão tem no máximo um grupo e a própria tag já diz o que é. Um item é um `<li>` (ou uma `<tr>` de uma tabela), com os campos do grupo escritos exatamente como um slot: um `<p>` por campo, o nome do campo na `class=`.

[`examples/few-words.deck.html`](examples/few-words.deck.html) é um deck de sete slides, um por padrão de poucas palavras; [`examples/statement.deck.html`](examples/statement.deck.html) é a afirmação de tela cheia sozinha; [`examples/evidence.deck.html`](examples/evidence.deck.html) é um deck de quatro slides, um por padrão que carrega uma série. Os três compilam pelo comando documentado no [`SKILL.md`](SKILL.md).

<!-- catalog:begin -->

O cabeçalho é o próprio `<deck>`, e os cinco campos são obrigatórios: `title`, `occasion`, `theme`, `lang`, `minutes`. Um slot é um `<p>` com o nome do slot na `class=` e nada mais. Dentro de um slot a ênfase é livre, com duas marcações: `<em>` e `<strong>`.

São 12 padrões, na ordem do arco. O orçamento é do slide inteiro, mobília inclusive, e nenhum slide passa de 90 palavras seja qual for o padrão.

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

### `full-bleed-statement` · até 12 palavras

Uma frase em corpo de display, segurando o palco sozinha.

| slot | papel | obrigatório | o que vai nele |
| --- | --- | --- | --- |
| `statement` | afirmação | sim | a frase que o slide inteiro sustenta |

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

<!-- catalog:end -->
