---
name: panlabs-presentation-builder
description: Gera uma apresentação HTML de arquivo único, offline, em slides 16:9 paginados — o modelo escreve a fonte num dialeto restrito de HTML, e o compilador desenha o palco, embute o tema e recusa o que está fora do vocabulário. Use ao pedir uma apresentação, um deck ou slides; ao transformar um texto, uma proposta, uma ata ou um relatório em apresentação; ao encurtar, revisar ou corrigir uma apresentação já gerada; e ao retomar uma fonte escrita numa sessão anterior.
---

# panlabs-presentation-builder

> **O modelo escreve a FONTE. O compilador desenha o PALCO.**

A fonte de um deck é um arquivo em **HTML restrito**: um cabeçalho com os metadados, uma `<section>` por slide, um padrão do catálogo nomeado em cada seção, e um slot de texto por conteúdo. Não existe nela onde escrever uma medida, uma cor, uma classe inventada ou um `style=` — o compilador recusa, e a recusa nomeia o próprio conserto.

O que sai é **um `.html` de arquivo único que abre offline**: o tema viaja inline, o script viaja inline, e não há uma única referência externa na página. Ele **pagina**: um slide por vez num palco 16:9 centrado na janela, setas para avançar e voltar, número de página fixo no mesmo canto.

Python 3 da casa e nada além dele: sem `pip install`, sem rede, sem CDN. Os comandos abaixo rodam a partir da **raiz da skill — o diretório onde este próprio `SKILL.md` está**. **Nada é gravado dentro desta árvore**: a fonte e a apresentação nascem no projeto de quem chamou ou no temporário do sistema.

> ⚠️ **Esta é a v2, e ela está sendo construída em fila.** O catálogo está **completo, nos dezoito padrões** que a spec pediu — os de poucas palavras, a afirmação de tela cheia, os quatro que carregam uma série (número gigante, métricas em linha, linha do tempo e tabela), duas colunas, três colunas, comparação, lista com ícones, o gráfico com título-tese em seis formas, e agora a figura sob medida, que fecha a lista. Faltam as notas do apresentador, a visão geral, o tema `panlabs` e a jornada de três turnos, que chegam pelos tickets seguintes da spec. O que este documento descreve é o que existe e roda; ele não promete o que ainda não.

## O dialeto

```html
<deck title="A régua e a plateia"
      occasion="Retrospectiva de engenharia"
      theme="base"
      lang="pt-BR"
      minutes="1">

  <section pattern="full-bleed-statement">
    <p class="statement">Nenhuma suíte verde substitui a <strong>primeira fileira</strong> lendo o slide projetado.</p>
  </section>

</deck>
```

**O cabeçalho é o próprio `<deck>`**, e os cinco campos são obrigatórios: `title`, `occasion`, `theme`, `lang`, `minutes`. Faltou um, o compilador recusa dizendo qual.

**Uma `<section>` é um slide**, e o `pattern=` dela é um nome do catálogo. **Um slot é um `<p>` com o nome do slot na `class=`** — e nada mais: um segundo atributo é geometria vestida de prosa, e geometria não atravessa esta costura.

**O vocabulário de ênfase inline fecha em três marcações.** `<strong>` (negrito) e `<mark>` (destaque com uma régua na cor de acento) valem em qualquer slot; `<br/>`, vazio e sem atributo, força uma quebra de linha só nos padrões que o dizem — o [`CATALOG.md`](CATALOG.md) lista quais. Qualquer outra tag é recusada, `<em>` inclusive: o vocabulário fechou nestas três de propósito.

**Um padrão pode carregar um grupo**, que é uma série ao invés de um fato só — a métrica que se repete, o marco da linha do tempo, a linha da tabela. Um grupo é um `<ul>`, um `<ol>` ou um `<table>` — sem `class=`, porque a própria tag já diz o que é —, e cada item dentro dele (um `<li>`, ou uma `<tr>` de tabela) carrega seus próprios campos do mesmo jeito que um slide carrega slots: um `<p>` por campo, o nome do campo na `class=`. Um marco da linha do tempo aceita ainda `<li now>`, para marcar o momento presente.

**O gráfico é o grupo que o compilador desenha em vez de imprimir.** A `<section pattern="chart">` carrega um `type=` a mais — `bars-h`, `bars-v`, `line`, `area`, `sparkline` ou `share` —, a tese no `title`, a unidade no `unit`, a fonte com data no `source`, e a série num `<ul>` de `<li>` com `label` e `value`; `<li mark>` põe a cor de acento no ponto que o slide é sobre. O que sai é SVG gerado por [`compiler/charts.py`](compiler/charts.py), sem `<canvas>` e sem biblioteca, com **nenhuma cor escrita dentro dele** — a marca leva uma classe, o tema pinta. O valor é um número puro, dígitos com vírgula decimal, desenhado exatamente como foi escrito: a unidade mora no `unit`, negativo reprova, e numa proporção os valores têm de somar cem.

**A figura é o único slot que o catálogo não limita.** A `<section pattern="figure-caption">` leva a legenda no `caption`, o título-tese opcional no `title`, e a figura numa tag só dela: um `<svg>` que o próprio modelo desenha, ou um `<img src="…"/>` apontando para um arquivo que o compilador embute em base64. Sem título, a figura fica com o palco inteiro; com ele, divide. **Nenhuma cor é escrita no desenho** — `fill` e `stroke` só aceitam `none` ou um `var(--token)` do tema, e um hexadecimal reprova; o vocabulário de elementos e atributos é fechado, e é ele que recusa `<script>`, `<use>`, `href=` e `style=` sem precisar de uma regra por ameaça. Uma imagem que não existe, que passa do teto de dois megabytes ou cujos bytes não são do formato que a extensão promete reprova a construção — é assim que «retrato vazio proibido» vira régua de máquina.

**O catálogo está em [`CATALOG.md`](CATALOG.md)**, e é lá que se escolhe um padrão: cada um traz os slots que aceita, quais deles são obrigatórios, o papel de cada slot, quantas palavras o slide inteiro pode gastar e, quando houver, o grupo que carrega. Aquele documento é **gerado** de [`compiler/catalog.py`](compiler/catalog.py), que é o registro que o compilador de fato consulta — `python3 compiler/catalog.py --check` reprova quando os dois discordam, e `--write` põe o registro de volta lá.

[`examples/statement.deck.html`](examples/statement.deck.html) é a fonte acima, inteira e construível; [`examples/few-words.deck.html`](examples/few-words.deck.html) é um deck de sete slides, um por padrão de poucas palavras; [`examples/evidence.deck.html`](examples/evidence.deck.html) é um deck de quatro slides, um por padrão que carrega uma série; [`examples/side-by-side.deck.html`](examples/side-by-side.deck.html) cobre colunas, comparação e lista com ícones; [`examples/charts.deck.html`](examples/charts.deck.html) tem um slide por forma de gráfico; [`examples/figure.deck.html`](examples/figure.deck.html) traz um ciclo desenhado à mão, uma figura dividindo o palco com um título e uma imagem embutida por caminho.

## Construir

```bash
python3 compiler/build.py examples/statement.deck.html /tmp/exemplo.html
python3 compiler/build.py /tmp/proposta.deck.html /tmp/proposta.html --theme base
```

`--theme` sobrescreve o tema que o cabeçalho declara — é o que permite reconstruir o mesmo deck em `base` para provar que o padrão se sustenta sem marca nenhuma atrás dele.

**Tudo o que o comando tem a dizer sai na saída padrão**, e o código de saída é o veredito: `0` o arquivo foi escrito, `1` não foi. A saída é determinística — não há relógio dentro dela, então duas construções da mesma fonte não diferem em um byte.

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
   11 rulers, green
```

**Uma régua lê o dialeto e dez leem a doutrina.** A primeira recusa uma fonte que o compilador não sabe construir. As outras construiriam sem reclamar e entregariam um deck que falha na sala: o slide que gasta mais palavras do que o padrão orça, o título que nomeia uma pasta em vez de dizer alguma coisa — a lista fechada de títulos-categoria está no [`CATALOG.md`](CATALOG.md) —, a mesma forma em dois slides seguidos, que a plateia lê como um slide que não avançou, um ícone que o conjunto vendorizado não conhece, um item de lista com o ícone e sem o texto ou vice-versa, um valor de gráfico que não é número ou uma proporção que não soma cem, um gráfico cuja fonte não diz de quando é o dado, um rótulo maior do que o espaço que a forma dá a ele, uma cor escrita dentro de uma figura em vez de um token do tema, e uma imagem que não resolve, passa do teto de bytes ou não é do formato que o próprio nome promete. Todas são estáticas porque a fonte já responde por elas: contar palavras, ler um título, comparar dois `pattern=`, conferir um nome contra um registro, somar uma coluna de números e perguntar ao disco se um arquivo está lá não precisa de navegador.

**A forma do gráfico conta como forma.** Dois slides seguidos de `pattern="chart"` passam quando o `type=` difere — barra depois de linha não é um slide que deixou de avançar —, e reprovam quando é o mesmo.

**Laudo vermelho não escreve arquivo nenhum.** Meio deck no disco é pior do que nenhum, porque parece pronto. Cada linha vermelha nomeia o conserto no imperativo — `drop the class "highlight" — the pattern "full-bleed-statement" declares one slot: statement` —, e consertar é ida e volta de máquina: corrija a fonte e rode de novo, sem trazer isso para o humano.

**Abra o arquivo e olhe antes de entregar.** Laudo verde não quer dizer que a página está certa; ele diz que o defeito que a máquina sabe medir não está lá.

## O portão de render

Toda construção bem-sucedida também é levada a um Chromium real: o comando escreve o arquivo, imprime o laudo estático acima e, em seguida, entrega a página pronta para [`gate/render.cjs`](gate/render.cjs), que devolve uma **folha de contato em PNG** com todos os slides lado a lado e um segundo laudo, das seis réguas que só um navegador de verdade sabe responder — a fonte declarada no tema de fato pintou, ou caiu para a substituta sem avisar; o texto cabe no palco, ou vaza por cima da própria borda; o slide ocupa pelo menos 40% da altura do palco; nenhuma requisição de rede foi observada; e o número de página fica no mesmo lugar do primeiro ao último slide.

```
── render · "A régua e a plateia" · 1 slide · 1600×900
   ✓ box-overflow · no leaf paints past the stage's own edges
   ✓ type-floor · no leaf paints smaller than 2.2% of the stage height
   ✓ occupancy · every slide fills at least 40% of the stage height
   ✓ network-zero · the deck makes no request the network has to answer
   ✓ platform-font · the face that painted is the one the theme declares
   ✓ page-number · the page number sits in the same place on every slide
   contact sheet · /tmp/exemplo.contact-sheet.png
   6 rulers, green
```

**Sem Chromium na máquina, o portão degrada para um `SKIP` nomeado, e a construção não falha** — o código de saída de `build.py` fala só do laudo estático (`0` o arquivo foi escrito, `1` não foi); um defeito de render, ou a ausência de Chromium para medi-lo, nunca reabre essa promessa, porque só existe algo para renderizar depois que o arquivo já está no disco. [`gate/cdp.cjs`](gate/cdp.cjs) é a única dependência: um cliente CDP sem npm, sobre o WebSocket e o fetch que o próprio Node já tem, contra qualquer Chromium que `npx playwright install chromium` ou `npx puppeteer browsers install chrome` tenha deixado no cache da máquina.

Chamar o portão sozinho, sobre um arquivo já construído, também funciona:

```bash
node gate/render.cjs /tmp/exemplo.html --out /tmp
```

## O tema

Um tema é uma **folha de tokens**, e a lista de nomes é fechada: superfície, tinta, tinta secundária, acento, duas cores de conteúdo, três hairlines, raio, três fontes, e a escala tipográfica. [`themes/base/tokens.css`](themes/base/tokens.css) é o único lugar onde eles são declarados.

**Toda medida tipográfica é uma porcentagem da altura do palco** — display 11%, título 7%, frase de apoio 4,2%, corpo 2,8%, e um piso de 2,2% abaixo do qual nenhum texto desce. Um deck é projetado numa resolução que ninguém informa de antemão; tamanho em pixel é tamanho certo num projetor só.

`base` é duas coisas ao mesmo tempo, de propósito: é a estrutura que todo tema herda — palco, padrões, escala — e é um tema completo e sem marca. Um deck construído nele prova que o padrão se sustenta sozinho.

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
| quiser a folha de contato ou o laudo das seis réguas de render | [`gate/render.cjs`](gate/render.cjs) |
| for escolher um padrão para um slide, com slots, papéis e orçamento | [`CATALOG.md`](CATALOG.md) |
| quiser ver os sete padrões de poucas palavras numa fonte só | [`examples/few-words.deck.html`](examples/few-words.deck.html) |
| quiser ver os quatro padrões que carregam uma série numa fonte só | [`examples/evidence.deck.html`](examples/evidence.deck.html) |
| quiser ver colunas, comparação e lista com ícones numa fonte só | [`examples/side-by-side.deck.html`](examples/side-by-side.deck.html) |
| for escolher um ícone, ou conferir a licença do conjunto | [`themes/base/icons/`](themes/base/icons/) |
| for escolher a forma de um gráfico, ou ver as seis numa fonte só | [`examples/charts.deck.html`](examples/charts.deck.html) |
| quiser saber como um gráfico é desenhado, ou por que um rótulo não coube | [`compiler/charts.py`](compiler/charts.py) |
| for desenhar uma figura sob medida, ou embutir uma imagem por caminho | [`examples/figure.deck.html`](examples/figure.deck.html) |
| quiser saber por que uma figura foi recusada, ou o que é embutido dela | [`compiler/figures.py`](compiler/figures.py) |

A suíte que mede este compilador **mora fora desta árvore** e não é lida nem rodada por quem executa a skill: ela é do workspace irmão, e o que a skill publica não carrega o peso dela.
