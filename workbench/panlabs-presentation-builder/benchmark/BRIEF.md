# O brief do benchmark

**Este é o pedido que foi entregue à skill, e nada mais.** Ele existe escrito porque um benchmark cujo pedido só existiu numa conversa não é um benchmark: ninguém consegue repetir a prova, e ninguém consegue dizer se o deck respondeu ao que foi pedido ou ao que o agente quis responder. O que a skill devolveu a partir daqui está em [`matt-pocock.deck.html`](matt-pocock.deck.html), e o que sustenta cada número está em [`DATA.md`](DATA.md).

O ticket é o [#220](https://github.com/ThiagoPanini/panlabs-skills/issues/220), e a spec é a [#207](https://github.com/ThiagoPanini/panlabs-skills/issues/207).

**O deck construído não está versionado, e refazê-lo é um comando.** `bash ../tools/render-examples.sh` reconstrói os três decks do corpus — os dois exemplos da árvore e este — em `../renders/`, cada um com o seu storyboard e a sua folha de contato. O que a `.gitignore` guarda dali é a medição do [#62](https://github.com/ThiagoPanini/panlabs-skills/issues/62): render commitado que ninguém compara não é evidência, envelhece em silêncio. E a camada 1 da suíte constrói esta fonte a cada rodada, então uma fonte que parar de compilar reprova antes de alguém abrir o navegador.

## O pedido

Uma apresentação sobre o framework de desenvolvimento com IA do Matt Pocock — o conjunto de skills que este repositório e o `panlabs-docs` usam todos os dias —, para **engenheiros que nunca ouviram falar dele**. Vinte minutos ao vivo, em português, no tema `panlabs`. A plateia sabe programar e já usou um agente; ela não sabe o que é uma skill, não sabe o que `/to-spec` faz, e não vai instalar nada durante a apresentação.

A reação que a apresentação quer provocar é uma só: **a pessoa sair querendo rodar `/setup-matt-pocock-skills` no próprio repositório na segunda-feira.**

## O que a apresentação tem de cobrir, em seis partes

1. **O que é o modelo.** Uma skill por tarefa, invocada por `/nome`; o humano decide e o agente apura os fatos; a issue é a memória que atravessa as sessões.
2. **O setup por repositório.** O que `/setup-matt-pocock-skills` escreve, e por que ele roda uma vez só.
3. **O pipeline, com demonstração.** Do grilling em rodadas até o merge, com um caso real: a própria spec que produziu esta apresentação.
4. **As skills de apoio.** O que existe além do fluxo principal, e quando cada coisa é chamada.
5. **O que muda no dia a dia.** Como fica a jornada de quem trabalha assim.
6. **As lições.** O que este conjunto custa, o que ele não faz, e o que só se aprende usando.

## O que não pode faltar

- Os **quatro dados de fonte primária**, cada um com a fonte e a data: os frameworks comparados em contagem e em tamanho, as linhas por `SKILL.md` instalado, as categorias em proporção, e o pipeline como figura desenhada sob medida.
- O nome de cada comando escrito exatamente como se digita.
- Um fecho que peça a decisão **na sala**.

## O que não pode entrar

- Nenhum número que não tenha fonte primária e data — e nenhum número sobre produtividade, tempo de sessão ou «antes e depois», que ninguém mediu.
- Nenhuma promessa sobre o que o framework faz pela velocidade de quem o usa.
- Nenhuma captura de tela de terminal.
