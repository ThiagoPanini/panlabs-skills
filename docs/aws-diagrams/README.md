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

O registro de engenharia em prosa — o critério do corpus, a recertificação do
motor, o conserto do roteamento — ficou **dentro** da skill, em
[`skills/panlabs-aws-diagrams/docs/`](../../skills/panlabs-aws-diagrams/docs/).
São 412 KB e o [`guia/`](../../skills/panlabs-aws-diagrams/guia/) aponta para
eles: uma skill que aponta para fora de si mesma quebra na mão de quem a instala,
e essa batalha já foi travada uma vez neste repositório.
