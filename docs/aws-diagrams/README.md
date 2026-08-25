# `panlabs-aws-diagrams` — o registro que não vai dentro da skill

Tudo aqui é sobre a skill [`skills/panlabs-aws-diagrams/`](../../skills/panlabs-aws-diagrams/)
e **nada aqui é a skill**. A separação não é arrumação: o limite de upload de uma
skill é **30 MB descomprimidos**, o empacotador oficial leva o diretório inteiro
menos quatro exclusões fixas, e a árvore da skill chegou a **29 MB** — a 1 MB de
não poder ser publicada. O que quem instala não usa mora aqui.

| | |
|---|---|
| [`prototipos/`](prototipos/) | **Fonte primária, não produção.** Um diretório por pergunta respondida (`q1`…`q22`), 252 arquivos. É onde cada decisão do motor foi medida antes de virar código. Três cópias do `elk.bundled.js` moram aqui, e sozinhas davam 4,8 MB |
| [`corpus/`](corpus/) | O corpus renderizado — 24 modelos em `.drawio` e PNG, mais as variantes de tema. **Reconstrutível**: `tests/rodar.sh` regenera byte a byte, e a igualdade é medida |
| [`casos/`](casos/) | Os casos de uso rodados ponta a ponta contra a skill, cada um com a necessidade em prosa, o modelo, o diagrama e o laudo |
| [`auditoria.md`](auditoria.md) | A auditoria de 2026-08-23: o que foi medido contra a spec de Agent Skills, o que mudou e os cinco defeitos que os casos acharam |
| [`corpus.md`](corpus.md) | O critério do corpus — o que cada modelo prova, e o que falta provar |
| [`recertificacao.md`](recertificacao.md) | A recertificação do motor: o que a união dos dois candidatos mediu, o que caiu e o que sobreviveu |
| [`roteamento.md`](roteamento.md) | O conserto do roteamento de aresta, com o antes/depois em imagem |
| [`decisoes.md`](decisoes.md) | Toda decisão da construção com o gatilho que a reabre — lido para **modificar** a skill, nunca para executá-la |

O registro de engenharia em prosa e o guia de decisões de construção **saíram**
da skill (#36): moravam em `skills/panlabs-aws-diagrams/docs/` e
`skills/panlabs-aws-diagrams/guia/decisoes.md`, apontados pelo `guia/` — e uma
skill que aponta para fora de si mesma quebra na mão de quem a instala, batalha
já travada uma vez neste repositório. A correção desta vez não é mover o alvo e
manter o ponteiro: é **cortar o ponteiro**. Nada em
[`skills/panlabs-aws-diagrams/`](../../skills/panlabs-aws-diagrams/) referencia
os quatro arquivos acima; a direção é uma via só, e é esta página que aponta
para dentro da skill, nunca o contrário.
