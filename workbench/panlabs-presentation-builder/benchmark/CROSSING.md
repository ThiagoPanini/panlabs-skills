# As duas travessias, comando a comando

**A skill atravessou a própria jornada nova duas vezes, no mesmo tema e pelas duas pontas da entrada** — o [#240](https://github.com/ThiagoPanini/panlabs-skills/issues/240). O turno 0 de cada uma está em [`SURVEY-RICH.md`](SURVEY-RICH.md) e [`SURVEY-THIN.md`](SURVEY-THIN.md); aqui ficam os comandos que rodaram, o que cada laudo disse, e as quatro da lista visual respondidas olhando a folha de contato.

**Nada disto é versionado**, e a razão é a do [#62](https://github.com/ThiagoPanini/panlabs-skills/issues/62): render commitado que ninguém compara não é evidência, envelhece em silêncio. O que fica na árvore são as duas **fontes** — `matt-pocock.deck.html` e `matt-pocock-thin.deck.html` — e estes registros. Os artefatos nascem em `../renders/crossing-rich/` e `../renders/crossing-thin/`, e refazê-los é rodar os comandos abaixo da raiz da skill.

## A entrada rica

```bash
python3 compiler/build.py ../../workbench/panlabs-presentation-builder/benchmark/matt-pocock.deck.html <fora>/matt-pocock.html
python3 compiler/build.py <fora>/matt-pocock.storyboard.md <fora>/matt-pocock.esqueleto.html --skeleton
python3 compiler/build.py ../../workbench/panlabs-presentation-builder/benchmark/matt-pocock.deck.html <fora>/matt-pocock.md --article
```

| artefato | veredito |
| --- | --- |
| o deck, 21 slides | **19 réguas do dialeto verdes, 7 do render verdes** |
| o esqueleto do turno 1, e a folha dele | **7 réguas verdes** |
| o artigo do turno 3 | **19 réguas verdes**, com 5 `.svg` ao lado |

**A lista visual do turno 2, respondida olhando a folha:**

1. *três slides de texto seguidos sem um momento* — **não achei.** As corridas mais longas são de dois: o 3 e o 4, depois o 17 e o 19, e entre elas sempre cai um divisor, uma citação ou um gráfico.
2. *capítulo sem pico* — **não achei.** O trecho 01 tem a citação de tela cheia do slide 7; o 02, a figura do pipeline no 11 e as métricas no 14; o 03, o fecho do 21.
3. *a assinatura onde a direção prometeu* — **está.** A direção promete «o divisor numerado que volta três vezes», e ele volta nos slides 5, 10 e 15, sempre com o mesmo par de número e nome. **Ela não é de slide, é de trecho** — e foi este deck que mostrou que a pergunta precisava ser «onde a direção prometeu» e não «em todos», porque cobrar os vinte e um slides de um motivo declarado por trecho é pedir o que ninguém prometeu. O `SKILL.md` foi corrigido por causa disto.
4. *algum slide que lê como pilha* — **não achei.** O mais denso é o 12, a tabela de comandos e artefatos, e ele tem cabeçalho, duas colunas e cinco linhas: é tabela, não pilha.

## A entrada rala

```bash
python3 compiler/build.py ../../workbench/panlabs-presentation-builder/benchmark/matt-pocock-thin.deck.html <fora>/matt-pocock-thin.html
python3 compiler/build.py <fora>/matt-pocock-thin.storyboard.md <fora>/matt-pocock-thin.esqueleto.html --skeleton
python3 compiler/build.py ../../workbench/panlabs-presentation-builder/benchmark/matt-pocock-thin.deck.html <fora>/matt-pocock-thin.md --article
```

| artefato | veredito |
| --- | --- |
| o deck, 21 slides | **19 réguas do dialeto verdes, 7 do render verdes** |
| o esqueleto do turno 1, e a folha dele | **6 de 7 verdes** — `occupancy` vermelha nos dois `two-columns`, e isso é o esqueleto trabalhando: ver abaixo |
| o artigo do turno 3 | **19 réguas verdes**, com 2 `.svg` ao lado |

**As sete idas e voltas de máquina, que não chegaram a ninguém.** O primeiro laudo recusou em quatro réguas de uma vez e cada recusa nomeou o conserto: `share` aceita de duas a três fatias e elas somam 100 (eram quatro, somando 37); `inline-metrics` não tem `mark=`; `table` quer um `<table>` e `timeline` quer um `<ol>`; os ícones têm de existir no Lucide vendorizado, e `01`, `02`, `03`, `04` não existem. Depois disso, duas rodadas de calibragem entre o teto de palavras de um padrão e o piso de ocupação do palco — que é o vão em que este deck de fato se escreveu.

**O esqueleto previu o slide vazio, com o número exato.** Ele reprova `occupancy` nos dois `two-columns` com **37,6%**, e 37,6% é precisamente o que o slide 3 do deck real media antes de eu alongá-lo. É o turno 1 fazendo o que o #237 pediu dele: o defeito de composição aparece no ensaio, onde consertá-lo custa uma linha da tabela, e não no deck.

**A lista visual do turno 2, respondida olhando a folha — e duas acharam defeito:**

1. *três slides de texto seguidos sem um momento* — **não achei.** A corrida mais longa é 17 e 18, e o 19 é a afirmação de tela cheia.
2. *capítulo sem pico* — **achei, e consertei.** O trecho 01 ia do 6 ao 8 com três slides de informação e nenhum que segurasse o palco sozinho. Entrou uma afirmação de tela cheia fechando o trecho — «Metade do repositório permanece deliberadamente invisível para quem instala o plugin» —, e o deck passou de 20 para 21 slides. Os momentos foram de quatro para cinco, e `standard` admite até cinco.
3. *a assinatura onde a direção prometeu* — **achei, e consertei a promessa.** A direção dizia «sob todo slide que carrega número», e o slide da linha do tempo carrega `#237`, `#238` e `#246` sem linha de fonte — o padrão `timeline` não tem slot de fonte para carregar. A promessa passou a ser «sob todo slide que põe uma **medida** no palco», que é o que o deck cumpre: um identificador de issue não é uma medida.
4. *algum slide que lê como pilha* — **não achei.** O 18, a lista de quatro itens, é o mais carregado e cada item tem ícone e uma linha.

## O que as duas juntas mediram

**A jornada não muda de forma quando o material acaba.** O mapa é a mesma tabela nas duas; o que muda é qual coluna trabalha. Na rica, as seis linhas fecharam com o material na mão e **nenhuma pesquisa foi lançada**; na rala, quatro linhas vieram vazias, **duas pesquisas correram em segundo plano** e três perguntas foram para o primeiro bloco. Nas duas, **um bloco só** — o segundo nunca existiu, porque a pesquisa mudou números e não mudou a tese.

**E a travessia pagou por si.** Ela corrigiu duas coisas que nenhuma régua pegaria: a lista visual do `SKILL.md`, que cobrava a assinatura «em todos» quando a direção de arte pode prometê-la por trecho; e a promessa de assinatura do próprio deck rala, que cobria mais slides do que o padrão consegue assinar.
