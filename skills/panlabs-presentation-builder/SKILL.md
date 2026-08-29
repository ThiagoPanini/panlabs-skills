---
name: panlabs-presentation-builder
description: Gera uma apresentação HTML de arquivo único na identidade Panlabs, numa jornada de três turnos — um rascunho que aparece antes de qualquer pergunta, uma rodada sobre o que só o humano sabe, e ajuste sob demanda. O modelo escreve o argumento como dado; o motor desenha a página. Use ao pedir uma apresentação, um deck ou slides; ao transformar um texto, uma proposta, uma ata ou um relatório em apresentação; ao encurtar, revisar ou corrigir uma apresentação já gerada; e ao retomar um `argument.json` escrito numa sessão anterior.
---

# panlabs-presentation-builder

> **O modelo escreve o ARGUMENTO. O motor desenha a PÁGINA.**

A fronteira não é disciplina, é gramática: o modelo escreve **um arquivo de dado**, `argument.json`, e não existe nele onde escrever uma coordenada, uma classe de CSS, uma cor ou um número de ordem. O motor (`engine/skeleton.html`) já existe, é **copiado byte a byte** para dentro do resultado, e o construtor preenche quatro furos nele.

A razão é medida, não estética. Escrever o markup das seções à mão custa **49 nomes de classe** distintos — não é um contrato, é um segundo framework de CSS para o modelo decorar. Em vez disso o modelo escolhe entre **4 tipos de `beat`** e **8 tipos de `block`**, e o construtor recusa o resto com uma mensagem que nomeia o próprio conserto.

O que sai é **um `.html` de arquivo único que abre offline**: as fontes viajam dentro dele em `data:` URI, o CSS e o JS são inline, e não existe uma única referência externa. Ele rola — não há página, não há «próximo», existe mais texto abaixo —, com um desenho grudado no topo que muda conforme o texto passa.

Os comandos abaixo rodam a partir da **raiz da skill — o diretório onde este próprio `SKILL.md` está**. Instalada, essa raiz é `~/.claude/skills/panlabs-presentation-builder/`; na árvore de desenvolvimento é `skills/panlabs-presentation-builder/`. **Nada é gravado dentro desta árvore**: o argumento e a apresentação nascem no temporário do sistema ou onde o usuário pedir.

Python 3 da casa e nada além dele: sem `pip install`, sem rede, sem CDN.

## A jornada

Três turnos: **rascunho, rodada, ajuste** — e o primeiro é o que **aparece na tela**, não o que pergunta.

**Por que o rascunho vem antes da pergunta, e por que isso é decisão e não pressa.** Este produto é visual, e a régua deste esforço inteiro é que **o usuário reage a artefato; ele não responde a prosa**. O preço é assimétrico: pergunta respondida no escuro é a pergunta cara, e apresentação errada que aparece em trinta segundos é barata de corrigir. E não é hipótese — três apresentações inteiras foram geradas e o olhar do dono derrubou, olhando, a premissa que governava o formato; nenhuma quantidade de prosa a teria derrubado.

**A forma de três turnos é emprestada da `panlabs-aws-diagrams`, e a ordem é invertida de propósito.** Lá o primeiro turno pergunta, porque nenhuma checagem geométrica sabe se a arquitetura desenhada existe: a pergunta guarda o fato. Aqui o fato vem com o material, e **não sobra pergunta de forma para fazer** — há um formato, uma identidade e um acento, o esqueleto é congelado, e não existe onde responder «prefere outra cor». Uma rodada antes do rascunho compraria atraso e nada mais.

### Turno 1 · O rascunho

**Reconheça a porta antes de escrever qualquer coisa.** Três entram por lugares diferentes:

| entrada | o que fazer |
|---|---|
| prosa, documento, ata, relatório, anotação | nada — é este turno |
| um `argument.json` de uma sessão anterior | construa direto, e **pare**: a jornada acabou |
| só um pedido, sem material nenhum (*«faça uma apresentação»*) | construa `examples/argument.json`, **mostre a forma**, e peça o material apontando para ela |

**Escreva o argumento.** Ele é uma coluna que desce: um `frame` abre, cada `claim` carrega uma afirmação, um `block` traz a evidência que sustenta a afirmação anterior, e um `ask` fecha pedindo alguma coisa. **Uma seção, no máximo um bloco** — a prosa de um `claim` sozinha já enche a zona de leitura, e afirmação sem bloco continua legítima. O vocabulário inteiro, campo a campo e teto a teto, está em [`VOCABULARY.md`](VOCABULARY.md); a forma de cada `items` está em [`examples/argument.json`](examples/argument.json), que é um argumento completo de treze batidas com os oito blocos.

**A figura grudada é um bloco.** Qualquer `beat` pode trazer `figure`, e dali para baixo a faixa do topo desenha esse; `lit` acende as partes dela que aquela batida está discutindo. Trocar a figura no meio não é decoração: um argumento com dois assuntos e uma figura só **mente em algum trecho** — só muda qual.

**Grave o argumento fora desta árvore e construa:**

```bash
python3 engine/build.py /tmp/proposta.argument.json /tmp/proposta.html
```

O construtor **valida antes de escrever**, e recusa com uma mensagem que nomeia o próprio conserto — `REFUSED · beat 7: lit 4 has nothing to light — the figure in force here has 3 lightable part(s)`. Recusa é ida e volta de máquina: conserte o argumento e rode de novo, sem trazer isso para o humano.

**Nunca invente um fato em silêncio.** Faltou um número, uma data, um nome? Ou ele vira **chute declarado** — você desenha com ele e diz, neste turno, qual foi e de onde saiu — ou o material inteiro está faltando, e aí é a terceira linha da tabela acima. Nas duas saídas alguma coisa aparece na tela antes de qualquer pergunta.

**Fecha quando** o `.html` existe e você entregou, no mesmo turno: o caminho do arquivo, os chutes que declarou, e o que ficou de fora por falta de material.

### Turno 2 · A rodada

**Uma rodada, inteira de uma vez, cada pergunta numerada e com a sua recomendação — e cada uma apontando para um trecho do arquivo que já existe.** *«Na batida 4 eu afirmei que a fila dobrou em março; confirma?»* é uma pergunta barata. A mesma pergunta antes do rascunho é cara, porque quem responde não sabe ainda o que ela decide.

**Não se pergunta sobre forma.** Nem cor, nem fonte, nem layout, nem «quantos slides»: o esqueleto é congelado e não existe onde responder. Pergunta de forma é pergunta que esta skill não tem vocabulário para atender, e fazê-la ensina o usuário que existe uma alavanca que não existe.

O que se pergunta é **fato e argumento**: o número que você não tinha, a afirmação que você inferiu, o que a plateia já sabe e não precisa ouvir, e o que a apresentação está pedindo no fim.

**Este turno pode ser uma linha.** Se o rascunho não inferiu nada e não sobrou pergunta de fato, diga isso e vá para o ajuste — turno que existe para ser cumprido é cerimônia.

**Fecha quando** a rodada saiu inteira e numerada. Uma rodada, e só: o que não foi perguntado agora vira chute declarado no próximo rascunho, nunca uma segunda rodada.

### Turno 3 · O ajuste

Sob demanda, quantas vezes o usuário quiser. A primeira versão é um começo, não um veredito.

Corrija o `argument.json` e rode o mesmo comando com o mesmo destino: o arquivo é reescrito no lugar, e o mesmo argumento produz o mesmo `.html` — não há relógio na saída, então duas construções seguidas não diferem em um byte.

**Estourou um teto de caracteres? Vira mais um `block`.** Nunca texto compactado, nunca letra menor: os tetos são medidos contra a zona de leitura, e comprimir só troca um estouro visível por uma página ilegível.

**Fecha quando** o usuário parar de pedir ajuste. Não há portão aqui, e é de propósito: turno que fecha por checagem é turno que discute com quem está pedindo.

## O que o modelo escreve

[`VOCABULARY.md`](VOCABULARY.md) é o documento inteiro que você precisa ler para escrever uma apresentação — os quatro `beat`, os oito `block`, os campos de cada um, os tetos de caracteres e o que nunca se escreve. Ele é **gerado a partir de [`engine/register.py`](engine/register.py)**, nunca escrito ao lado dele: um nome escrito duas vezes é um nome que diverge, e prosa que diverge do motor é o modo de falha que este projeto mediu antes de começar — 469 KB de documentação que não conseguiam seguir 164 KB de template.

Por isso **a prosa aponta para o registro em vez de resumi-lo**, e por isso não há aqui uma cópia da tabela de blocos: o resumo é a coisa que diverge.

## O que o motor recusa, e por quê

Recusa alto em vez de desenhar errado, e toda recusa nomeia o próprio conserto.

| recusa | porque |
|---|---|
| `beat` ou `block` com nome que não existe | o vocabulário é fechado, e a mensagem lista os que existem |
| campo obrigatório faltando, ou chave desconhecida | o contrato é o contrato — a mensagem lista as chaves conhecidas |
| qualquer tag que não `<b>`, ou `style=` / `class=` em texto | geometria não atravessa esta costura; `<span style=…>` é geometria vestida de prosa |
| `lit` apontando para parte que a figura em vigor não tem | o índice era legal acima da troca de figura e deixou de ser abaixo dela — a página mentiria em silêncio |
| bloco sem partes acendíveis usado como `figure` | a faixa desenharia algo que nenhuma batida consegue acender |
| figura que nenhuma batida chega a olhar | são bytes na faixa que nunca pintam, e nada na tela mostraria isso |
| ícone que o motor não tem | `<use>` apontando para nada desenha nada, sem erro nenhum |
| marcador do esqueleto que aparece zero ou duas vezes | o furo deixou de ser um furo, e o resultado sairia com um comentário HTML no lugar do conteúdo |

## O que o motor garante

O esqueleto é **congelado**: ele entra no resultado literalmente, e nenhuma linha de CSS ou de JS é gerada por apresentação. Isso é o que faz duas apresentações diferentes serem a mesma identidade, e não duas aproximações dela — medido, o arquivo que sai é mais de 90% esqueleto copiado.

O número de ordem de uma batida **não existe no markup**: é derivado. Inserir uma batida no meio não renumera nada, porque não há nada para renumerar.

A figura grudada pode **trocar no meio do argumento**, e o array de batidas continua plano — sem invólucro, sem nome novo no vocabulário.

## As fontes

Quatro `.woff2` em [`assets/fonts/`](assets/fonts/), todas sob SIL Open Font License 1.1, subsetadas e renomeadas — a procedência de cada uma, o que foi transformado e o texto das licenças estão em [`assets/fonts/NOTICE.md`](assets/fonts/NOTICE.md).

**Três viajam embutidas no esqueleto**, e são as três que o formato usa: display, corpo Light e corpo Black. `hand.woff2` **não é embutida, e isso é decisão e não esquecimento**: o formato não desenha nada à mão. A etiqueta que no deck original era manuscrita virou caixa-alta espaçada em corpo Light, e a regra `.kick` do esqueleto diz isso na própria linha. Embuti-la seriam 16 KB de base64 que nenhuma apresentação gerada pinta. Ela fica na árvore, com licença e procedência, para o dia em que alguém devolver a mão ao formato.

## Instalar

```bash
bash tools/install.sh
```

Expõe a skill nos dois caminhos que a casa usa — `~/.agents/skills/<nome>` apontando para o repositório, e `~/.claude/skills/<nome>` apontando para o primeiro —, e no fim **roda um comando da skill a partir de cada um**, que é o que prova que ela funciona instalada e não só aqui. `--check` confere sem escrever nada; `--force` substitui um diretório de verdade.

Instalar é **apontar, não copiar**: a skill instalada é sempre a que está no repositório, em vez de uma fotografia dela que envelhece em silêncio. E o link **nunca aponta para um worktree** — worktree é apagado junto com a sessão que o criou, e o que sobra é um link quebrado sem nada avisando, com a skill sumindo do harness. Rodando de dentro de um, o instalador resolve o checkout principal e aponta para lá, dizendo em voz alta que fez isso.

## A régua

A suíte que mede este motor **mora fora desta árvore** e não é lida nem rodada por quem executa a skill: ela é do workspace irmão, em seis camadas — as réguas provando que sabem ficar vermelhas, o esqueleto congelado, as seis famílias da arquitetura, as nove do portão estático, as dez do portão de render sobre um Chromium de verdade, e as dez da porta de entrada, que medem este documento e a instalação. O que a skill publica não carrega o peso de nada disso.

Uma suíte verde não substitui abrir o `.html` e olhar: o corpus desta família tem caso de checagem estática verde com o desenho errado na tela.

## Onde está o resto

| leia quando | |
|---|---|
| for escrever ou corrigir um argumento | [`VOCABULARY.md`](VOCABULARY.md) |
| precisar da forma de um campo, ou de um argumento inteiro que roda | [`examples/argument.json`](examples/argument.json) |
| quiser saber por que um nome é aquele nome, e qual teto ele carrega | [`engine/register.py`](engine/register.py) |
| a licença ou a procedência de uma fonte estiver em questão | [`assets/fonts/NOTICE.md`](assets/fonts/NOTICE.md) |
