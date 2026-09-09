---
name: panlabs-presentation-builder
description: Gera uma apresentação HTML de arquivo único, offline, em slides 16:9 paginados, numa jornada de três turnos — uma rodada de calibragem com o storyboard proposto antes de existir um slide, o deck construído com a folha de contato, e o ajuste. O modelo escreve a fonte num dialeto restrito de HTML, e o compilador desenha o palco, embute o tema e recusa o que está fora do vocabulário. Use ao pedir uma apresentação, um deck ou slides; ao transformar um texto, uma proposta, uma ata ou um relatório em apresentação; ao encurtar, revisar ou corrigir uma apresentação já gerada; e ao retomar uma fonte escrita numa sessão anterior.
---

# panlabs-presentation-builder

> **O modelo escreve a FONTE. O compilador desenha o PALCO.**

A fonte de um deck é um arquivo em **HTML restrito**: um cabeçalho com os metadados e a direção de arte, uma `<section>` por slide, um padrão do catálogo e uma função no arco nomeados em cada seção, e um slot de texto por conteúdo. Não existe nela onde escrever uma medida, uma cor, uma classe inventada ou um `style=` — o compilador recusa, e a recusa nomeia o próprio conserto.

O que sai é **um `.html` de arquivo único que abre offline**: o tema viaja inline, o script viaja inline, e não há uma única referência externa na página. Ele **pagina**: um slide por vez num palco 16:9 centrado na janela, setas para avançar e voltar, número de página fixo no mesmo canto, visão geral em grade, notas do apresentador e a lista de atalhos — tudo por tecla, e **nenhum botão sobre o slide**.

Python 3 da casa e nada além dele: sem `pip install`, sem rede, sem CDN. Os comandos abaixo rodam a partir da **raiz da skill — o diretório onde este próprio `SKILL.md` está**. **Nada é gravado dentro desta árvore**: a fonte e a apresentação nascem no projeto de quem chamou ou no temporário do sistema.

> ⚠️ **Esta é a v2, e ela está sendo construída em fila.** O catálogo está **completo, nos dezoito padrões** que a spec pediu — os de poucas palavras, a afirmação de tela cheia, os quatro que carregam uma série (número gigante, métricas em linha, linha do tempo e tabela), duas colunas, três colunas, comparação, lista com ícones, o gráfico com título-tese em seis formas, e a figura sob medida, que fecha a lista. O palco de apresentar também está inteiro — visão geral, notas, atalhos, progresso, fragmentos e os três perfis de movimento. Os **dois temas** existem: `base`, sem marca, e `panlabs`, com as fontes e as cores da documentação da casa. A **direção de arte** mora no cabeçalho, cada slide declara a **função dele no arco**, o **storyboard** sai ao lado do deck a cada construção, e a **jornada de três turnos** abaixo é o caminho inteiro. Faltam os exemplos por tema e o benchmark, que chegam pelos dois últimos tickets da spec. O que este documento descreve é o que existe e roda; ele não promete o que ainda não.

## A jornada, em três turnos

**Um pedido de apresentação não vira deck na mesma mensagem.** O que sai errado num deck quase nunca é um slide — é a tese, é o público, é a duração —, e nenhum dos três é barato de consertar depois que existem vinte slides. Por isso a **calibragem vem antes de gerar**, e o que ela produz é texto: uma rodada de perguntas, uma frase de tese, um storyboard e uma direção de arte. Corrigir qualquer um deles custa uma linha; corrigir o mesmo erro no deck custa o deck.

**A doutrina que estes três turnos aplicam está em [`NARRATIVE.md`](NARRATIVE.md)** — o arco padrão e as quatro variantes por gênero, o título-tese, o respiro, a régua de que nada se perde, e como a duração vira número de slides. Leia antes de propor o storyboard do primeiro turno; ela é a metade da skill que nenhum comando reprova.

### Turno 1 · A calibragem, o storyboard e a direção de arte, numa mensagem só

**Primeiro reconheça a entrada**, porque uma delas não é deste turno:

| o que chegou | o que fazer |
|---|---|
| um pedido em prosa, um texto, uma proposta, uma ata, um relatório | este turno |
| um `.deck.html` de uma sessão anterior | **vá direto ao turno 3** — a fonte já carrega o cabeçalho, a direção de arte e o storyboard inteiros, e perguntar de novo o que está escrito nela é o pior jeito de retomar um deck |

Leia o pedido e todo o material que veio junto. Depois devolva **uma mensagem só**, com as quatro partes abaixo nesta ordem — e **nenhum arquivo**: neste turno nada é construído, e essa é a regra inteira.

**A rodada.** Perguntas numeradas, uma linha cada, **cada uma já com a sua recomendação**, e diga que **«vai» aceita todas de uma vez** — porque a maior parte delas não importa a quem pediu. A rodada é **adaptativa**: pergunte só o que o pedido e o material não determinam, de modo que material rico produza rodada **curta**, não longa. E **um fato que você consegue descobrir lendo o que já está na sua frente nunca vira pergunta**: perguntar o que já foi dito é o jeito mais rápido de uma calibragem virar formulário.

**Uma rodada, e só uma.** O que você não perguntou agora vira uma suposição que você **declara** junto do storyboard — nunca uma segunda rodada. Duas rodadas antes do primeiro slide é exatamente a espera que faz alguém desistir da skill e abrir o PowerPoint.

O que a rodada decide é o cabeçalho inteiro de uma fonte:

| decide | a pergunta | a recomendação, se ninguém disser nada |
| --- | --- | --- |
| `title` | que decisão ou reação esta apresentação quer provocar | a tese que o material sustenta, escrita como manchete |
| `occasion` | em que ocasião isto é apresentado, e quando | o que o pedido disser, com a data de hoje |
| `minutes` | quantos minutos de fala | 10 — e a duração dimensiona o deck, um slide por minuto |
| `theme` | em que identidade | `panlabs` |
| `lang` | em que idioma | o idioma em que o pedido foi escrito |
| `motion` | quanto palco: `static`, `editorial` ou `cinematic` | `editorial` |
| `moments` | quantos picos o deck se dá | `standard` |
| `cover` | por onde o deck abre | a capa que o material sustenta: pelo número quando há um, pela manchete quando não |
| `signature` | o motivo geométrico que volta e faz do deck uma peça | um traço tirado do tema, repetido na mesma altura em todo slide |
| `register` | em que pessoa, em que tom e com que vocabulário os slides falam | o registro e o tom em que o próprio pedido está escrito |
| `difference` | em que este deck difere do exemplo canônico da skill | diga onde, na capa e na assinatura |
| `renounced-1` `renounced-2` `renounced-3` | de que três padrões este deck abre mão | os três que o material não sustenta |
| `content-1` `content-2` | o que cada cor de conteúdo significa neste deck, se ele gastar alguma | as duas coisas que o deck compara do começo ao fim — e nenhuma das duas, num deck que se pinta só com tinta e acento |

E mais duas perguntas que não moram no cabeçalho e mudam tudo o que vem depois dele: **quem está na sala e o que essa gente já sabe**, que é o que separa contexto de insulto; e **o que não pode faltar e o que não pode entrar**, que é a única parte da rodada cuja resposta vira um slide diretamente.

**A mensagem central.** A frase «a mensagem central é X», escrita assim, literal. É a tese do deck em uma linha e a coisa mais barata que existe nesta jornada para alguém corrigir.

**O storyboard proposto.** Uma linha por slide, na ordem: a função no arco, o padrão do catálogo e a mensagem daquele slide. É a mesma tabela que [`compiler/storyboard.py`](compiler/storyboard.py) escreverá ao lado do deck no turno seguinte — propô-la agora é o que faz o próximo pedido poder ser «o slide 4 está fazendo a tensão de novo» em vez de «encurte o slide sete».

**A direção de arte proposta.** As escolhas estéticas da tabela acima, escritas como você as gravará no `<direction>`. Um veto aqui custa uma linha; o mesmo veto depois do turno 2 custa um deck inteiro.

**Fecha quando** quem pediu responde a rodada, ou diz «vai».

### Turno 2 · A fonte, o deck, a folha de contato e o que ficou fora

Escreva a fonte no projeto de quem chamou, com o sufixo `.deck.html`, e construa dali:

```bash
python3 compiler/build.py <projeto>/<nome>.deck.html <projeto>/<nome>.html
```

**Nada é gravado dentro desta árvore** — nem a fonte, nem o deck, nem o storyboard. A skill instalada é a mesma para todas as sessões da máquina, e um comando que escrevesse nela faria o pacote crescer um arquivo por uso.

Sai o deck, sai o `<nome>.storyboard.md` ao lado dele, sai a folha de contato em PNG e saem os dois laudos. **Laudo vermelho é ida e volta de máquina**: corrija a fonte, rode de novo, e não traga isso para quem pediu — o que chega a uma pessoa é um deck que já passou.

Entregue três coisas, e as três:

- **o arquivo**, com o caminho, e a nota de que ele abre offline em qualquer navegador;
- **a folha de contato**, que é o deck inteiro numa imagem — é o que se olha antes de entregar, e é exatamente o que a máquina não sabe julgar;
- **a lista do que ficou fora do deck**. O que não coube num slide foi para as `<notes>` daquele slide; o que não coube no deck vai nesta lista, para quem pediu decidir se volta.

**Sem Chromium na máquina não há folha de contato**, e o portão de render diz isso por um `SKIP` nomeado. Entregue as outras duas e **avise que ninguém olhou o deck** — a folha existe porque laudo verde não é a mesma coisa que página certa, e entregar sem ela em silêncio é entregar dizendo que alguém conferiu.

**Fecha quando** o laudo está verde e o que existe está na mão de quem pediu.

### Turno 3 · O ajuste

Ajuste no nível em que o pedido veio. **«O slide 7 está denso» é um ajuste de slide**: abra a fonte gravada, mexa naquela `<section>`, reconstrua. **«Falta tensão antes da tese» é um ajuste de arco**: mexa primeiro no storyboard — a ordem dos `arc=`, um slide a mais, um a menos — e só depois nos slides.

A fonte gravada é o que faz este turno existir depois que a sessão acabou: recebendo o `.deck.html`, uma sessão nova retoma o deck de onde ele parou, sem recomeçar do zero por causa de uma vírgula.

**Fecha quando** quem pediu para de pedir.

## O dialeto

```html
<deck title="A régua e a plateia"
      occasion="Retrospectiva de engenharia"
      theme="base"
      lang="pt-BR"
      minutes="2"
      motion="static">

  <direction>
    <p class="cover">cover-headline</p>
    <p class="signature">nenhuma — este deck é curto demais para um motivo voltar</p>
    <p class="register">primeira pessoa do plural, frase curta, sem jargão de ferramenta</p>
    <p class="moments">sober</p>
    <p class="difference">o exemplo canônico abre por um número; este abre pela manchete</p>
    <p class="renounced-1">chart</p>
    <p class="renounced-2">table</p>
    <p class="renounced-3">timeline</p>
  </direction>

  <section pattern="full-bleed-statement" arc="tension">
    <p class="statement">Nenhuma suíte verde substitui a <strong>primeira fileira</strong> lendo o slide projetado.</p>
    <notes>Diga que a suíte da v1 estava verde na véspera da apresentação que não funcionou.</notes>
  </section>

  <section pattern="closing-call" arc="call">
    <p class="thesis">A máquina mede o defeito que o olho não vê; o olho mede o resto.</p>
    <p class="call">Abra o próximo deck no projetor antes de mandá-lo.</p>
  </section>

</deck>
```

**O cabeçalho é o `<deck>` mais o `<direction>` logo abaixo dele.** No `<deck>`, todos os campos são obrigatórios: `title`, `occasion`, `theme`, `lang`, `minutes`, `motion`. Faltou um, o compilador recusa dizendo qual. `motion` é o perfil de movimento — `static`, `editorial` ou `cinematic`.

**O `<direction>` é a direção de arte deste deck, e é o primeiro filho do `<deck>`.** Cada escolha é um `<p>` com o nome dela na `class=`, como um slot de slide: a `cover` em que o deck abre, a `signature` que se repete, o `register` do texto, a escala de `moments`, a `difference` em relação ao exemplo canônico, e três `renounced-N` — padrões de que este deck abre mão. `content-1` e `content-2` são opcionais e dizem o que cada cor emprestada significa aqui; **um slide que gaste uma cor que a direção não declarou reprova** — uma figura pintada com ela, e também um gráfico, que o palco desenha nas duas. Nada disso chega ao palco e nada disso pinta coisa alguma: a direção alimenta o storyboard e as réguas.

**Uma `<section>` é um slide**, e ela carrega dois nomes: o `pattern=` é a forma que ela toma no catálogo, e o `arc=` é a função dela no arco — `context`, `tension`, `thesis`, `evidence`, `plan` ou `call`. Um não implica o outro: um gráfico pode ser a tensão ou a prova. **O último slide é um `closing-call` com `arc="call"`** — o fecho é obrigatório, e um deck que para em vez de fechar reprova. **Um slot é um `<p>` com o nome do slot na `class=`** — e nada mais: um segundo atributo é geometria vestida de prosa, e geometria não atravessa esta costura.

**O vocabulário de ênfase inline fecha em três marcações.** `<strong>` (negrito) e `<mark>` (destaque com uma régua na cor de acento) valem em qualquer slot; `<br/>`, vazio e sem atributo, força uma quebra de linha só nos padrões que o dizem — o [`CATALOG.md`](CATALOG.md) lista quais. Qualquer outra tag é recusada, `<em>` inclusive: o vocabulário fechou nestas três de propósito.

**Um padrão pode carregar um grupo**, que é uma série ao invés de um fato só — a métrica que se repete, o marco da linha do tempo, a linha da tabela. Um grupo é um `<ul>`, um `<ol>` ou um `<table>` — sem `class=`, porque a própria tag já diz o que é —, e cada item dentro dele (um `<li>`, ou uma `<tr>` de tabela) carrega seus próprios campos do mesmo jeito que um slide carrega slots: um `<p>` por campo, o nome do campo na `class=`. Um marco da linha do tempo aceita ainda `<li now>`, para marcar o momento presente.

**O gráfico é o grupo que o compilador desenha em vez de imprimir.** A `<section pattern="chart">` carrega um `type=` a mais — `bars-h`, `bars-v`, `line`, `area`, `sparkline` ou `share` —, a tese no `title`, a unidade no `unit`, a fonte com data no `source`, e a série num `<ul>` de `<li>` com `label` e `value`; `<li mark>` põe a cor de acento no ponto que o slide é sobre. O que sai é SVG gerado por [`compiler/charts.py`](compiler/charts.py), sem `<canvas>` e sem biblioteca, com **nenhuma cor escrita dentro dele** — a marca leva uma classe, o tema pinta. O valor é um número puro, dígitos com vírgula decimal, desenhado exatamente como foi escrito: a unidade mora no `unit`, negativo reprova, e numa proporção os valores têm de somar cem.

**A figura é o único slot que o catálogo não limita.** A `<section pattern="figure-caption">` leva a legenda no `caption`, o título-tese opcional no `title`, e a figura numa tag só dela: um `<svg>` que o próprio modelo desenha, ou um `<img src="…"/>` apontando para um arquivo que o compilador embute em base64. Sem título, a figura fica com o palco inteiro; com ele, divide. **Nenhuma cor é escrita no desenho** — `fill` e `stroke` só aceitam `none` ou um `var(--token)` do tema, e um hexadecimal reprova; o vocabulário de elementos e atributos é fechado, e é ele que recusa `<script>`, `<use>`, `href=` e `style=` sem precisar de uma regra por ameaça. Uma imagem que não existe, que passa do teto de dois megabytes ou cujos bytes não são do formato que a extensão promete reprova a construção — é assim que «retrato vazio proibido» vira régua de máquina.

**As notas do apresentador são um `<notes>` dentro do slide**, no máximo um por seção, sem `class=` e sem atributo nenhum. O que vai nele é prosa com as mesmas marcações de ênfase, mais `<br/>` sempre disponível, e **não conta no orçamento de palavras**: é exatamente onde mora o que não coube no slide, e nada dele chega ao palco — a nota viaja para um painel que só quem apresenta abre. Um `<notes>` vazio reprova: ou escreva a nota, ou tire a tag.

**Um slot marcado com o `step` pelado vira um fragmento** — `<p class="sentence" step>` — e só aparece depois que quem apresenta avança. A ordem é a ordem em que o padrão lê os slots, nunca um número escrito no atributo; `step="2"` reprova. Um par que o registro emparelha, o ícone e o texto de um item, entra na mesma batida, e marcar um sem o outro reprova. Item de grupo não é fragmento: uma série é uma prova só, e meia linha do tempo mente sobre o próprio eixo. **Marcar todos os slots reprova no portão de render**, porque o palco fica em branco até o primeiro avanço e a sala lê isso como um slide que não carregou.

**O catálogo está em [`CATALOG.md`](CATALOG.md)**, e é lá que se escolhe um padrão: cada um traz os slots que aceita, quais deles são obrigatórios, o papel de cada slot, quantas palavras o slide inteiro pode gastar e, quando houver, o grupo que carrega. Aquele documento é **gerado** de [`compiler/catalog.py`](compiler/catalog.py), que é o registro que o compilador de fato consulta — `python3 compiler/catalog.py --check` reprova quando os dois discordam, e `--write` põe o registro de volta lá.

[`examples/statement.deck.html`](examples/statement.deck.html) é a fonte acima, inteira e construível — e é o menor deck que a doutrina admite, porque um deck fecha; [`examples/few-words.deck.html`](examples/few-words.deck.html) tem um slide por padrão de poucas palavras; [`examples/evidence.deck.html`](examples/evidence.deck.html) tem um slide por padrão que carrega uma série; [`examples/side-by-side.deck.html`](examples/side-by-side.deck.html) cobre colunas, comparação e lista com ícones; [`examples/charts.deck.html`](examples/charts.deck.html) tem um slide por forma de gráfico; [`examples/figure.deck.html`](examples/figure.deck.html) traz um ciclo desenhado à mão, uma figura dividindo o palco com um título e uma imagem embutida por caminho; [`examples/presenting.deck.html`](examples/presenting.deck.html) é o deck do próprio palco, com notas em todo slide, fragmentos em três deles e o perfil cinemático no cabeçalho.

## Construir

```bash
python3 compiler/build.py examples/statement.deck.html /tmp/exemplo.html
python3 compiler/build.py /tmp/proposta.deck.html /tmp/proposta.html --theme base
```

`--theme` sobrescreve o tema que o cabeçalho declara — é o que permite reconstruir o mesmo deck em `base` para provar que o padrão se sustenta sem marca nenhuma atrás dele, ou em `panlabs` para vê-lo com a identidade da casa. Os dois temas são estes; um nome que não seja um deles é recusado com a lista do que existe.

**Tudo o que o comando tem a dizer sai na saída padrão**, e o código de saída é o veredito: `0` o arquivo foi escrito, `1` não foi. A saída é determinística — não há relógio dentro dela, então duas construções da mesma fonte não diferem em um byte.

## O storyboard

Toda construção bem-sucedida escreve **um segundo arquivo ao lado do deck**, com o mesmo nome e o sufixo `.storyboard.md`: `/tmp/exemplo.html` traz `/tmp/exemplo.storyboard.md` junto. Ele é a história do deck em uma página — a direção de arte inteira numa tabela, e depois **uma linha por slide, com a função no arco, o padrão e a mensagem**, com os momentos marcados.

Ele existe porque **estrutura é mais barata de corrigir em texto do que em slide**. Com o storyboard ao lado, o próximo pedido pode ser «o slide 4 está fazendo a tensão de novo» em vez de «encurte o slide sete» — e ele é gerado da fonte, nunca escrito à mão, então não há uma segunda cópia da história para divergir da primeira. Como o deck, é reproduzível byte a byte.

```markdown
## Storyboard

| # | função | padrão | mensagem |
| --- | --- | --- | --- |
| 1 | tensão | `full-bleed-statement` · momento | Nenhuma suíte verde substitui a primeira fileira lendo o slide projetado. |
| 2 | chamada | `closing-call` | Abra o próximo deck no projetor antes de mandá-lo. |
```

## Apresentar

O arquivo construído se apresenta sozinho, **por teclado e só por teclado**: não existe barra de botões, e o que a plateia vê no telão é o deck e mais nada.

**A lista completa de atalhos mora dentro do próprio arquivo, sob a tecla `?`**, e é gerada do mesmo mapa de teclas que o deck de fato obedece — nenhuma tecla que funciona fica de fora dela. O que precisa ser dito aqui é só o que quem apresenta não tem como descobrir sozinho antes de abrir aquele painel:

| tecla | |
|---|---|
| `→` `espaço` | avança — e um clicker comum manda exatamente isto, ou `PageDown` |
| `←` | volta; um slide para trás volta revelado |
| `o` | a visão geral em grade; as setas escolhem, `enter` salta |
| `n` | as notas do apresentador |
| `?` | **todo o resto** |

Uma barra de progresso fica na borda de baixo do palco, na tinta secundária e nunca no acento: quão longe o deck está não é o que ele significa.

**A interface do palco é escrita em português, e não acompanha o `lang=` do deck.** Um deck em inglês sai com o painel de ajuda em português; #207 põe a internacionalização «além do idioma do deck» fora de escopo, e traduzir esse punhado de rótulos é dívida conhecida, não descuido.

**O perfil de movimento decide duas coisas e mais nada**: como um slide chega e como um fragmento entra. `static` não anima nem uma nem outra — é o perfil de uma proposta sóbria, que não deveria precisar pedir para não ter efeito de palco. `editorial` faz o slide subir um fio e aparecer em 280 ms; `cinematic` gasta 620 ms, com uma escala mínima junto. **Numa máquina que declarou preferir menos movimento, nenhuma animação roda, seja qual for o perfil** — a preferência do sistema vence os três.

## O laudo

Toda construção imprime o laudo, verde ou vermelho, para «o que está errado neste deck» ser respondível sem abrir o navegador.

```
── audit · "A régua e a plateia" · theme base · 1 slide
   ✓ vocabulary · every pattern, class and tag in the source is one the catalog declares
   ✓ word-budget · no slide spends more words than its pattern budgets
   ✓ category-title · every claim on the stage makes a point, not a category
   ✓ repeated-pattern · no slide takes the same shape as the one before it
   ✓ icon-known · every icon a slide names is one the vendored Lucide set carries
   ✓ icon-paired · a slot never appears without the one it is paired with
   ✓ chart-data · every value a chart draws is a number, and a share adds up
   ✓ chart-source · every chart says where its number came from, and when
   ✓ chart-fit · every label a chart draws fits the room its form gives it
   ✓ figure-paint · every colour a drawn figure wears is a token of the theme
   ✓ figure-asset · every image a figure points at is there, and fits under the ceiling
   ✓ theme-repertoire · every character the deck prints is one the theme's own faces carry
   ✓ moment-scale · the deck holds as many moments as the scale it declared
   ✓ colour-semantics · every content colour a slide paints with is one the direction declared
   ✓ renounced-pattern · no slide takes a shape the direction gave up
   ✓ arc-closing · the deck ends on a closing, and the closing asks for something
   16 rulers, green
```

**Uma régua lê o dialeto e quinze leem a doutrina.** A primeira recusa uma fonte que o compilador não sabe construir. As outras construiriam sem reclamar e entregariam um deck que falha na sala: o slide que gasta mais palavras do que o padrão orça, o título que nomeia uma pasta em vez de dizer alguma coisa — a lista fechada de títulos-categoria está no [`CATALOG.md`](CATALOG.md) —, a mesma forma em dois slides seguidos, que a plateia lê como um slide que não avançou, um ícone que o conjunto vendorizado não conhece, um item de lista com o ícone e sem o texto ou vice-versa, um valor de gráfico que não é número ou uma proporção que não soma cem, um gráfico cuja fonte não diz de quando é o dado, um rótulo maior do que o espaço que a forma dá a ele, uma cor escrita dentro de uma figura em vez de um token do tema, uma imagem que não resolve, passa do teto de bytes ou não é do formato que o próprio nome promete, e um caractere que as fontes do tema não carregam.

**E quatro leem a direção de arte de volta contra os slides.** Elas são as únicas aqui que medem o deck contra uma promessa que ele mesmo fez no próprio cabeçalho: quantos momentos ele teria — um momento é uma figura desenhada, um gráfico ou uma afirmação de tela cheia, e a escala `high` só é emprestada ao movimento cinemático —, que cores de conteúdo significam alguma coisa nele, que padrões ele abriu mão de usar, e que ele acabaria pedindo alguma coisa. Sem `<direction>` no cabeçalho as quatro ficam caladas: a régua do dialeto já nomeou a falta, e quatro vermelhos sobre promessas que ninguém fez enterrariam o único conserto que produz todos eles. Todas são estáticas porque a fonte já responde por elas: contar palavras, ler um título, comparar dois `pattern=`, conferir um nome contra um registro, somar uma coluna de números e perguntar ao disco se um arquivo está lá não precisa de navegador.

**A forma do gráfico conta como forma.** Dois slides seguidos de `pattern="chart"` passam quando o `type=` difere — barra depois de linha não é um slide que deixou de avançar —, e reprovam quando é o mesmo.

**Laudo vermelho não escreve arquivo nenhum.** Meio deck no disco é pior do que nenhum, porque parece pronto. Cada linha vermelha nomeia o conserto no imperativo — `drop the class "highlight" — the pattern "full-bleed-statement" declares one slot: statement` —, e consertar é ida e volta de máquina: corrija a fonte e rode de novo, sem trazer isso para o humano.

**Abra o arquivo e olhe antes de entregar.** Laudo verde não quer dizer que a página está certa; ele diz que o defeito que a máquina sabe medir não está lá.

## O portão de render

Toda construção bem-sucedida também é levada a um Chromium real: o comando escreve o arquivo, imprime o laudo estático acima e, em seguida, entrega a página pronta para [`gate/render.cjs`](gate/render.cjs), que devolve uma **folha de contato em PNG** com todos os slides lado a lado e um segundo laudo, das sete réguas que só um navegador de verdade sabe responder — a fonte declarada no tema de fato pintou, ou caiu para a substituta sem avisar; o texto cabe no palco, ou vaza por cima da própria borda; o slide ocupa pelo menos 40% da altura do palco; nenhuma requisição de rede foi observada; o número de página fica no mesmo lugar do primeiro ao último slide; e um slide que revela em batidas mostra alguma coisa antes da primeira delas.

**Cada slide é medido duas vezes, e as duas leituras respondem perguntas diferentes.** No **passo zero**, antes de qualquer revelação, a única pergunta é se alguma coisa pintou — é o que a sala olha enquanto quem apresenta ainda está falando. **Assentado**, com todos os fragmentos no lugar, é o slide que o deck de fato entrega, e é o que as outras seis réguas leem: medir ocupação ou estouro contra um slide que ainda não chegou seria recusar a própria revelação, chamando um argumento de duas batidas de palco vazio.

```
── render · "A régua e a plateia" · 1 slide · 1600×900
   ✓ box-overflow · no leaf paints past the stage's own edges
   ✓ type-floor · no leaf paints smaller than 2.2% of the stage height
   ✓ occupancy · every slide fills at least 40% of the stage height
   ✓ network-zero · the deck makes no request the network has to answer
   ✓ platform-font · the face that painted is the one the theme declares
   ✓ page-number · the page number sits in the same place on every slide
   ✓ zero-step · a slide with fragments says something before the first advance
   contact sheet · /tmp/exemplo.contact-sheet.png
   7 rulers, green
```

**Sem Chromium na máquina, o portão degrada para um `SKIP` nomeado, e a construção não falha** — o código de saída de `build.py` fala só do laudo estático (`0` o arquivo foi escrito, `1` não foi); um defeito de render, ou a ausência de Chromium para medi-lo, nunca reabre essa promessa, porque só existe algo para renderizar depois que o arquivo já está no disco. [`gate/cdp.cjs`](gate/cdp.cjs) é a única dependência: um cliente CDP sem npm, sobre o WebSocket e o fetch que o próprio Node já tem, contra qualquer Chromium que `npx playwright install chromium` ou `npx puppeteer browsers install chrome` tenha deixado no cache da máquina.

Chamar o portão sozinho, sobre um arquivo já construído, também funciona:

```bash
node gate/render.cjs /tmp/exemplo.html --out /tmp
```

## O tema

Um tema é uma **folha de tokens**, e a lista de nomes é fechada: superfície, tinta, tinta secundária, acento, duas cores de conteúdo, três hairlines, raio, três fontes, e a escala tipográfica. [`themes/base/tokens.css`](themes/base/tokens.css) é o único lugar onde eles são declarados — **um tema que inventa um nome é recusado na construção**, porque um token que só um tema escreve é um token com que nenhum padrão pinta.

**Toda medida tipográfica é uma porcentagem da altura do palco** — display 11%, título 7%, frase de apoio 4,2%, corpo 2,8%, e um piso de 2,2% abaixo do qual nenhum texto desce. Um deck é projetado numa resolução que ninguém informa de antemão; tamanho em pixel é tamanho certo num projetor só.

`base` é duas coisas ao mesmo tempo, de propósito: é a estrutura que todo tema herda — palco, padrões, escala — e é um tema completo e sem marca. Um deck construído nele prova que o padrão se sustenta sozinho. **`base` entra debaixo de todo tema**, seja qual for o `--theme`; o outro é uma folha de sobrescritas por cima.

**[`themes/panlabs/`](themes/panlabs/) é a identidade da casa**, a mesma da documentação em `panlabs-docs`: fundo `#141414`, texto branco-frio, um acento terracota, hairlines a 7, 12 e 20% de tinta como única separação, raio 16, Inter para tudo com os alternates da docs ligados, Paper Mono para metadado, e duas cores de conteúdo emprestadas do azul e do verde da docs. Os valores ali são **literais resolvidos** de um arquivo que os escreve em `oklch(from …)`, então eles podem envelhecer sem ninguém notar; o verificador que compara os dois mora no workspace irmão e não sincroniza sozinho.

**As duas fontes viajam dentro do deck**, em subconjunto, embutidas em base64 — [`themes/panlabs/fonts/`](themes/panlabs/fonts/) tem os dois `.woff2`, a licença OFL ao lado e o manifesto que diz quais caracteres eles carregam. **É esse repertório que a régua `theme-repertoire` cobra**: uma seta que a Inter da docs não trouxe pintaria no substituto do sistema, sem aviso, e a construção reprova antes disso nomeando o caractere.

## Instalar

```bash
bash tools/install.sh
```

Expõe a skill nos dois caminhos que a casa usa — `~/.agents/skills/<nome>` apontando para o repositório, e `~/.claude/skills/<nome>` apontando para o primeiro —, e no fim **roda o comando de construção a partir de cada um**, conferindo que a página que sai não referencia nada fora dela. `--check` confere e não escreve link nenhum; `--force` substitui um diretório de verdade.

Instalar é **apontar, não copiar**: a skill instalada é sempre a que está no repositório. E o link **nunca aponta para um worktree** — worktree é apagado junto com a sessão que o criou, e o que sobra é um link quebrado sem nada avisando.

## Onde está o resto

| leia quando | |
|---|---|
| for escrever ou corrigir uma fonte | [`examples/statement.deck.html`](examples/statement.deck.html) |
| quiser saber que padrões existem e que slots cada um tem | [`compiler/catalog.py`](compiler/catalog.py) |
| precisar de um token, ou do tamanho de alguma coisa | [`themes/base/tokens.css`](themes/base/tokens.css) |
| quiser saber por que o compilador recusou | [`compiler/audit.py`](compiler/audit.py) |
| for medir a página construída num navegador de verdade | [`gate/cdp.cjs`](gate/cdp.cjs) |
| quiser a folha de contato ou o laudo das sete réguas de render | [`gate/render.cjs`](gate/render.cjs) |
| for escolher um padrão para um slide, com slots, papéis e orçamento | [`CATALOG.md`](CATALOG.md) |
| quiser ver os sete padrões de poucas palavras numa fonte só | [`examples/few-words.deck.html`](examples/few-words.deck.html) |
| quiser ver os quatro padrões que carregam uma série numa fonte só | [`examples/evidence.deck.html`](examples/evidence.deck.html) |
| quiser ver colunas, comparação e lista com ícones numa fonte só | [`examples/side-by-side.deck.html`](examples/side-by-side.deck.html) |
| for escolher um ícone, ou conferir a licença do conjunto | [`themes/base/icons/`](themes/base/icons/) |
| for escolher a forma de um gráfico, ou ver as seis numa fonte só | [`examples/charts.deck.html`](examples/charts.deck.html) |
| quiser saber como um gráfico é desenhado, ou por que um rótulo não coube | [`compiler/charts.py`](compiler/charts.py) |
| for desenhar uma figura sob medida, ou embutir uma imagem por caminho | [`examples/figure.deck.html`](examples/figure.deck.html) |
| quiser saber por que uma figura foi recusada, ou o que é embutido dela | [`compiler/figures.py`](compiler/figures.py) |
| for escrever notas do apresentador, ou revelar um slide em batidas | [`examples/presenting.deck.html`](examples/presenting.deck.html) |
| quiser saber que teclas o deck construído entende, ou o que cada perfil de movimento faz | [`compiler/stage.html`](compiler/stage.html) |
| quiser o valor de um token da identidade da casa, e de onde ele veio | [`themes/panlabs/tokens.css`](themes/panlabs/tokens.css) |
| quiser saber que caracteres o tema `panlabs` sabe pintar, ou refazer o corte das fontes | [`themes/panlabs/fonts/README.md`](themes/panlabs/fonts/README.md) |
| for embutir as fontes de um tema novo, ou entender o `@font-face` que sai | [`compiler/fonts.py`](compiler/fonts.py) |
| quiser saber o que sai no storyboard, ou de onde vem a mensagem de um slide | [`compiler/storyboard.py`](compiler/storyboard.py) |
| for propor um storyboard, escolher o arco, ou decidir o que fica de fora do deck | [`NARRATIVE.md`](NARRATIVE.md) |

A suíte que mede este compilador **mora fora desta árvore** e não é lida nem rodada por quem executa a skill: ela é do workspace irmão, e o que a skill publica não carrega o peso dela.
