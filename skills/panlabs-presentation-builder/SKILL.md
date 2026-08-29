---
name: panlabs-presentation-builder
description: Gera uma apresentação HTML autocontida na identidade Panlabs a partir de um `argument.json` — o modelo escreve o argumento como dado, o motor desenha. Use ao pedir uma apresentação, um deck ou slides; ao transformar um texto ou uma proposta em apresentação; e ao retomar um `argument.json` escrito numa sessão anterior.
---

# panlabs-presentation-builder

> **O modelo escreve o ARGUMENTO. O motor desenha a PÁGINA.**

A fronteira não é disciplina, é gramática: o modelo escreve **um arquivo de dado**, `argument.json`, e não existe nele onde escrever uma coordenada, uma classe de CSS, uma cor ou um número de ordem. O motor (`engine/skeleton.html`) já existe, é **copiado byte a byte** para dentro do resultado, e o construtor preenche quatro furos nele.

A razão é medida, não estética. Escrever o markup das seções à mão custa **49 nomes de classe** distintos — não é um contrato, é um segundo framework de CSS para o modelo decorar. Em vez disso o modelo escolhe entre **4 tipos de `beat`** e **8 tipos de `block`**, e o construtor recusa o resto com uma mensagem que nomeia o próprio conserto.

## O que ler antes de escrever

[`VOCABULARY.md`](VOCABULARY.md) é o documento inteiro que você precisa ler para escrever uma apresentação — os quatro `beat`, os oito `block`, os campos de cada um e o que nunca se escreve. Ele é **gerado a partir de [`engine/register.py`](engine/register.py)**, nunca escrito ao lado dele: um nome escrito duas vezes é um nome que diverge, e a prosa que diverge do motor é o modo de falha que este projeto mediu antes de começar.

[`examples/argument.json`](examples/argument.json) é um argumento completo que roda — treze batidas, os oito blocos, a figura grudada trocando no meio. Comece dele.

## Gerar

```bash
cd engine
python3 build.py ../examples/argument.json ~/minha-apresentacao.html
```

Python 3 da casa e nada além dele: sem `pip install`, sem rede, sem CDN. O `.html` que sai **abre offline** — as fontes viajam dentro do arquivo em `data:` URI, e não existe uma única referência externa.

O construtor **valida antes de escrever**. A saída do modelo é dado, então ela pode ser recusada com uma mensagem útil — `REFUSED · beat 7: lit 4 has nothing to light — the figure in force here has 3 lightable part(s)` —, que é o único tipo de falha que vale a pena ter.

## O que o motor garante

O esqueleto é **congelado**: ele entra no resultado literalmente, e nenhuma linha de CSS ou de JS é gerada por apresentação. Isso é o que faz duas apresentações diferentes serem a mesma identidade, e não duas aproximações dela.

A figura grudada no topo pode **trocar no meio do argumento**: qualquer `beat` pode trazer um `figure`, e dali para baixo a faixa desenha esse. O array de batidas continua plano, e o vocabulário não ganha nome nenhum por isso.

## As fontes

Quatro `.woff2` em [`assets/fonts/`](assets/fonts/), todas sob SIL Open Font License 1.1, subsetadas e renomeadas — a procedência de cada uma, o que foi transformado e o texto das licenças estão em [`assets/fonts/NOTICE.md`](assets/fonts/NOTICE.md).

**Três viajam embutidas no esqueleto**, e são as três que o formato usa: display, corpo Light e corpo Black. `hand.woff2` **não é embutida, e isso é decisão e não esquecimento**: o formato não desenha nada à mão. A etiqueta que no deck original era manuscrita virou caixa-alta espacada em corpo Light, e a regra `.kick` do esqueleto diz isso na própria linha. Embuti-la seriam 16 KB de base64 que nenhuma apresentação gerada pinta. Ela fica na árvore, com licença e procedência, para o dia em que alguém devolver a mão ao formato.
