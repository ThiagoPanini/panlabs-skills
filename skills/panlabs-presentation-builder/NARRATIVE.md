# A doutrina narrativa

**Este documento é a metade da skill que nenhum comando reprova.** O compilador conta palavras, compara dois `pattern=` e lê um título contra uma lista fechada; ele não sabe dizer que a tensão chegou tarde demais, que o deck tem seis provas e nenhum plano, ou que a plateia saiu sem saber o que se espera dela. O que está aqui é o que decide isso, e é o que você aplica no **turno 1** — quando a história ainda é um parágrafo e corrigi-la custa uma linha.

Os números não estão aqui. O orçamento de cada padrão, os slots de cada um e a lista fechada de títulos que reprovam moram no [`CATALOG.md`](CATALOG.md), que é gerado do registro que o compilador de fato consulta. Uma segunda cópia deles aqui seria a cópia que envelhece.

## Um argumento por slide, e nada se perde

**Um slide diz uma coisa.** Se ele diz duas, ou são dois slides, ou uma das duas não era o ponto. A plateia lê um slide em cinco segundos e escuta você pelos outros cinquenta; o que está no telão é o que ela precisa **ver** para acompanhar o que você **fala**, e nada além.

Isso corta muito material, e é aqui que a maior parte dos decks se perde: o texto que sobra volta em fonte menor. **Ele não volta.** O que não cabe no slide vai para o `<notes>` daquele slide, que não tem teto de palavras, não conta no orçamento e não chega ao palco — é um painel que só quem apresenta abre. O que não cabe no deck inteiro vira a **lista do que ficou fora**, que o turno 2 entrega junto com o arquivo.

**Nada do material original se perde, e nada dele é jogado no telão para provar isso.** As duas metades dessa frase são a mesma regra.

## O arco padrão, e as quatro variantes

Toda `<section>` carrega um `arc=` além do `pattern=`: o padrão diz que forma o slide tem, a função diz para que ele está ali. O arco padrão tem seis funções, nesta ordem:

| `arc=` | o que esse trecho faz |
| --- | --- |
| `context` | põe a plateia no mesmo lugar que você — o mínimo, e nunca a história do mundo |
| `tension` | mostra o que está errado, ou o que vai custar caro; sem isto o resto é informação |
| `thesis` | a frase que o deck existe para dizer, e a única que a plateia deve levar embora |
| `evidence` | as provas: os números, os casos, as figuras. É a parte que estica |
| `plan` | o que se faz com isso, em passos que alguém consegue começar amanhã |
| `call` | o fecho, que volta à tese e **pede alguma coisa** |

**O fecho é obrigatório**, e o compilador reprova sem ele. Um deck que acaba na última prova é um deck de que a sala sai sem saber o que se espera dela.

As quatro variantes abaixo são o mesmo arco com pesos diferentes. Escolha pelo gênero do pedido, e diga qual escolheu no turno 1:

- **kickoff** — apresentar um time, um produto ou uma iniciativa que está começando. `context` curto, `tension` forte, `plan` longo. A plateia não precisa de provas ainda; ela precisa entender por que isto existe e o que vem depois.
- **proposta** — pedir uma decisão, um orçamento ou um sim. `tension` e `evidence` carregam o deck, `plan` é o pedido em passos, e o `call` nomeia a decisão que se espera **na sala**, não depois dela.
- **resultado com dados** — contar o que aconteceu. `evidence` é a maior parte, e é onde moram os gráficos; a `thesis` vem **antes** dos números e não depois, porque um número sem tese é um número que cada um lê como quiser.
- **aula** — ensinar alguma coisa. `context` e `evidence` alternam em ciclos curtos, `tension` é a pergunta que abre cada ciclo, e o `plan` vira o que a pessoa faz sozinha depois.

**Nenhuma delas é uma ordem fixa de slides.** `evidence` pode voltar depois do `plan`, e a `tension` pode abrir o deck. O que a variante decide é onde o peso cai.

## O título é uma tese

**Todo título afirma alguma coisa.** «Três times perderam a janela» é um título; «Visão geral» é o nome de uma pasta. A régua é mecânica e o compilador a aplica: um slot de papel **afirmação** que diga só uma categoria reprova a construção, contra a lista fechada do [`CATALOG.md`](CATALOG.md).

A régua pega os casos óbvios. O que ela não pega é o título que tem verbo e não diz nada — «O time evoluiu», «Os resultados foram bons». **Um título-tese tem um verbo ou um número, e some se você o apagar**: se o slide continua fazendo sentido sem o título, o título não estava dizendo nada.

## O respiro

Um deck em que todo slide é denso não tem ritmo, tem volume. **Entre os slides densos vão slides de poucas palavras** — uma afirmação de tela cheia, uma pergunta-pivô, um divisor, um número gigante. Eles não carregam informação nova; eles dão à plateia o segundo em que ela alcança você.

Duas réguas que o compilador aplica saem daqui. **Nenhum padrão se repete em slides consecutivos**, porque dois slides da mesma forma são lidos como um slide que não avançou — e num gráfico a **forma** é o `type=`, então barra depois de linha passa e barra depois de barra não. E **a escala de momentos** que a direção declara é cobrada contra a contagem: um momento é um slide que segura o palco sozinho, e um deck que promete `sober` e entrega seis picos é um deck sem respiro nenhum.

## A duração dimensiona o deck

**Um slide por minuto de fala**, como ponto de partida. Vinte minutos são vinte slides, não quarenta — e não oito. É a régua mais grosseira deste documento e a que mais erra na prática, porque um respiro leva dez segundos e um gráfico leva três minutos; ela existe para você **começar** do número certo e ajustar contando os momentos, não para ser obedecida na contagem final.

O que ela impede é o erro que não tem conserto em sala: chegar aos vinte minutos no slide nove.
