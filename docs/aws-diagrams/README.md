# `panlabs-aws-diagrams` — o registro que não vai dentro da skill

Tudo aqui é sobre a skill [`skills/panlabs-aws-diagrams/`](../../skills/panlabs-aws-diagrams/)
e **nada aqui é a skill**. Só **prosa** mora aqui: o porquê de cada decisão, e o
que foi medido. Nenhum artefato gerado, nenhum código.

| | |
|---|---|
| [`auditoria.md`](auditoria.md) | A auditoria de 2026-08-23: o que foi medido contra a spec de Agent Skills, o que mudou, os cinco defeitos que os casos acharam, e a bateria de seis casos com a cobertura que ela provou |
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

## O que saiu daqui no #62, e por quê

Este diretório também guardava **artefato gerado** — 30 MB dele. O
[#62](https://github.com/ThiagoPanini/panlabs-skills/issues/62) apagou os quatro,
e a razão não foi peso: três dos quatro **afirmavam coisas que tinham deixado de
ser verdade**, e nada media isso.

| o que era | por que saiu | onde reabrir |
|---|---|---|
| `docs/research/` — 460 KB, 8 documentos | **um commit na vida**, o inicial. Já cristalizado em código executável: as 62 da rubrica são `validador/familias/a1..a8`, o catálogo é `catalog/aws4.catalog.json`, os limiares são `validador/limiares.json`. As 154 URLs de fonte primária seguem no git | `git show b7d60c7:docs/research/<arquivo>.md` |
| `prototipos/` — 18 MB, 252 arquivos | **um commit na vida**, o `git mv` do #29. Morto desde então, e sombreava 91 nomes de arquivo da produção: um grep por `dispor.cjs` devolvia 3 candidatos, por `rodar.sh`, 8 | `git show 1d1702a:docs/aws-diagrams/prototipos/…` |
| `corpus/` — 8,4 MB de `.drawio` e PNG | dizia-se **reconstrutível byte a byte, medido**. Não era: 4 de 4 modelos regenerados divergiam, e `tests/rodar.sh` escreve em `saida/` e **nunca leu este diretório**. A afirmação não tinha quem a checasse | `git show 1d1702a:docs/aws-diagrams/corpus/…` |
| `casos/` — 3,2 MB | mesma medição, 4 de 4 divergindo — o caso 2 inclusive, um dia depois de regenerado no #31. O valor já tinha sido colhido: defeitos viraram ticket, repros foram promovidos para `modelo/`. A tabela de cobertura sobreviveu, em [`auditoria.md`](auditoria.md) | `git show 1d1702a:docs/aws-diagrams/casos/…` |

**A lição que fica é sobre evidência versionada.** Render e artefato gerado que
ninguém compara não são evidência — são uma afirmação sobre o passado que
envelhece em silêncio e é lida como verdade sobre o presente. O que prova o
desenho é a régua rodando; o que prova a cobertura é a tabela, que é prosa. Se um
artefato gerado voltar a ser commitado aqui, ele precisa vir com quem o compare —
ou não vem.
