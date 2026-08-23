# panlabs-aws-diagrams — a árvore de produção

Motor determinístico `IR → layout → mxGraph XML` para diagramas AWS no draw.io,
com validador geométrico, camada de tema e persistência de sessão.

> **Isto ainda não é a skill publicada.** O `SKILL.md` e as `references/` — o
> documento que um agente lê — são o
> [#25](https://github.com/ThiagoPanini/panlabs-skills/issues/25). Aqui está o
> **código** que ele vai descrever, consolidado pelo
> [#23](https://github.com/ThiagoPanini/panlabs-skills/issues/23).

```bash
node motor/gerar.cjs modelo/web-multi-az.json --saida saida/x.drawio
node motor/gerar.cjs modelo/pedidos-serverless.json --tema escuro --explicar
node motor/gerar.cjs modelo/x.json --portao veracidade   # recusa o desenho que mente
node sessao/publicar.cjs saida/varejo.drawio             # a cópia que circula
./tests/rodar.sh                                          # a régua inteira
./tools/medir-candidatos.sh                               # a medição que escolheu o motor
```

## A ideia em uma frase

> **O agente escreve o QUE existe. O motor calcula ONDE fica.**

E a fronteira não é disciplina, é gramática: **`esquema.json` não tem nenhuma
propriedade que nomeie posição, tamanho, distância ou direção.** Não existe onde
escrever uma coordenada. `tests/check-fronteira-modelo.cjs` confere isso
mecanicamente, com experimento de controle.

## A árvore

| | |
|---|---|
| **`esquema.json`** | **O contrato.** `modelo@1` — o IR que o agente escreve. Único, e na raiz de propósito: é de quem escreve o modelo, e o motor é só o primeiro leitor. |
| `motor/` | O pipeline. `gerar` › `validar` › `resolver` › `derivar` › `dispor` › `planejar` › `emitir` › `conferir`, mais o portão de contraste. |
| `validador/` | As 62 checagens da rubrica (#8) viradas código (#18) — 60 no validador obrigatório, 2 no render. É **portão**, não otimizador. |
| `tema/` | O vocabulário FECHADO de estilo (#13) e os quatro temas. `esquema.json` aqui é `tema@1` — outro contrato, outro público. |
| `sessao/` | Vista lógica → vista técnica, o `.drawio` como formato de persistência (#14), e a cópia publicável (#23). `esquema.json` aqui é `sessao@1`. |
| `catalog/` | 403 service icons + 606 resource icons do draw.io 31.3.1, com o delta de correções escrito à mão (#17). |
| `modelo/` | O corpus. `modelo@1` na raiz, `modelo/recusa/` para o que o motor **deve** recusar, `modelo/sessao/` para `sessao@1`. |
| `tests/` | A união das suítes, em 8 camadas. |
| `tools/` | Bisseção, render, as duas medições (candidatos, antes/depois), as sessões de demonstração. `drawio.cjs` é o único lugar que sabe onde o binário mora. |
| `saida/` | O que o motor produziu, e o render como prova. |
| `prototypes/` | **Fonte primária, não produção.** Um diretório por pergunta respondida. Nada da árvore de produção alcança daqui — e há checagem disso. |

## Três contratos, um arquivo cada

O #23 pedia "um único `esquema.json`", e o que ele nomeava eram **dois arquivos
declarando o mesmo `$id` com conteúdo divergente**. Isso acabou. Sobram três
contratos, cada um num arquivo só:

| `$id` | arquivo | quem escreve |
|---|---|---|
| `panlabs-aws-diagrams/modelo@1` | `esquema.json` | o agente, na sabatina |
| `panlabs-aws-diagrams/tema@1` | `tema/esquema.json` | quem configura a identidade visual |
| `panlabs-aws-diagrams/sessao@1` | `sessao/esquema.json` | a camada de sessão, entre duas conversas |

`tests/check-esquema-unico.cjs` trava as três coisas: nenhum `$id` repetido, o
`modelo@1` na raiz, e é **esse** arquivo que o motor abre (medido, não afirmado).

## Os três caminhos de layout, e quem escolhe

Não é opção do agente — cai do modelo:

| | gatilho | quem manda |
|---|---|---|
| **contas** | ≥2 nós `tipo: conta` | o motor na grade de contas; o ELK dentro de cada conta |
| **grade** | ≥2 AZs distintas **e** algum papel de subnet em ≥2 AZs (#19) | o motor no `x` das colunas; o ELK dentro da célula |
| **elk** | o resto | o ELK na hierarquia inteira, uma passada |

O eixo da grade sai da regra do #21: **há passo numerado → o fluxo fica com a
horizontal e a AZ vira raia**; não há → a AZ pode ficar com a coluna.

A ordem das linhas sai da regra do #22: **exposição › camada › rótulo**, com a
camada derivada da categoria AWS do que a subnet guarda. Onde o fato falta e a
ordem **é** o desenho, o motor recusa com a lista — e a recusa é para o agente,
não para o humano.

## O que o motor recusa, e por quê

| recusa | porque |
|---|---|
| modelo fora do esquema | o contrato é o contrato |
| XML mal formado | o draw.io renderiza **truncado com código 0** (#19) — quem reclama é o gerador |
| tema que reprova no contraste | rótulo que some não dá erro em lugar nenhum. `--forcar` gera assim mesmo, para o estrago poder ser visto |
| subnet sem camada de rede, no caminho da grade | a ordem das linhas é o desenho, e ordem inventada põe a camada de dados em cima |
| nó que o caminho da grade não modela | omitir em silêncio é `A4.2` da rubrica — o diagrama que mente por ausência |

## O portão, e quando ele barra

O laudo geométrico (#18) sai **sempre**, em `relatorio.geometria` e no
`--explicar`; uma falha semântica vira aviso mesmo sem ninguém pedir. Bloquear é
`--portao <nenhum|veracidade|falha|estrito>`, e o default é `nenhum` porque o
próprio #18 chama `veracidade` de default de **publicação** — publicar não é
desenhar, e recusar desenhar tem hora.

Um laudo **incompleto** nunca passa, em nenhum nível: se uma família de checagem
parou de rodar, o verde não quer dizer nada.

## Zero dependência de rede ou de binário em runtime

Premissa 7 do mapa. O `elkjs` vai embarcado em `motor/vendor/` (1,6 MB) e nada
mais é carregado de fora da árvore — `tests/check-sem-prototipo.cjs` mede isso
com `require.cache`, não com grep.

O draw.io headless é **dependência de desenvolvimento** (premissa 8): a camada 7
da suíte precisa dele e, sem o binário, avisa e segue.

## A dívida, com endereço

- `A5.5` ×2 em `web-fluxo-3-az` — roteamento da grade transposta atravessa um
  grupo alheio. **Semântica**, e anterior à consolidação. Em quarentena nomeada
  no `check-bons.cjs`, dona: [#24](https://github.com/ThiagoPanini/panlabs-skills/issues/24).
- Nenhum diagrama emite **legenda** (`A1.2`/`A1.3` acusam em todo o corpus). O
  #13 registrou que o vocabulário fechado do tema não contrai essa dívida.
- O quadrado do ícone de serviço fica em 2,71:1 contra o tingimento de subnet.
  O portão do #13 avisa (é **área**); o validador do #18 reprova (trata como
  **traço**). As duas leituras convivem — ver `docs/recertificacao.md` §4.

## Onde ler o porquê de cada decisão

O código carrega a razão junto. Onde ela é longa demais para um comentário, o
ponteiro está no cabeçalho do arquivo e no ticket:

[#2](https://github.com/ThiagoPanini/panlabs-skills/issues/2) mxGraph ·
[#3](https://github.com/ThiagoPanini/panlabs-skills/issues/3)/[#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17) catálogo ·
[#4](https://github.com/ThiagoPanini/panlabs-skills/issues/4) estilo ·
[#5](https://github.com/ThiagoPanini/panlabs-skills/issues/5) convenções AWS ·
[#6](https://github.com/ThiagoPanini/panlabs-skills/issues/6)/[#12](https://github.com/ThiagoPanini/panlabs-skills/issues/12) multi-conta ·
[#7](https://github.com/ThiagoPanini/panlabs-skills/issues/7) layout ·
[#8](https://github.com/ThiagoPanini/panlabs-skills/issues/8)/[#18](https://github.com/ThiagoPanini/panlabs-skills/issues/18) rubrica e validador ·
[#11](https://github.com/ThiagoPanini/panlabs-skills/issues/11) motor ·
[#13](https://github.com/ThiagoPanini/panlabs-skills/issues/13) tema ·
[#14](https://github.com/ThiagoPanini/panlabs-skills/issues/14) duas vistas ·
[#15](https://github.com/ThiagoPanini/panlabs-skills/issues/15) sabatina ·
[#16](https://github.com/ThiagoPanini/panlabs-skills/issues/16) context pack ·
[#19](https://github.com/ThiagoPanini/panlabs-skills/issues/19)/[#21](https://github.com/ThiagoPanini/panlabs-skills/issues/21) AZ ·
[#22](https://github.com/ThiagoPanini/panlabs-skills/issues/22) camada de rede ·
[#23](https://github.com/ThiagoPanini/panlabs-skills/issues/23) esta árvore.

**A recertificação — o que a união mediu, o que caiu e o que sobreviveu — está em
[`docs/recertificacao.md`](docs/recertificacao.md).**
