# Contrato do context pack corporativo

Resolve o ticket
[#16 · Contrato do context pack corporativo](https://github.com/ThiagoPanini/panlabs-skills/issues/16).
As seis perguntas do ticket, na ordem em que ele as fez.

## 1 · Formato e local

**Um diretório, descoberto por convenção, com override explícito na invocação.**

```
.aws-context/
  premissas.md          # obrigatório para o diretório "contar" como pack
  exemplos/
    *.drawio             # zero ou mais
```

- **Descoberta**: mesmo mecanismo de `CONTEXT.md`/`docs/adr/` que `docs/agents/domain.md`
  já define para este repo — busca por nome convencional a partir da raiz do
  projeto sendo diagramado. Reaproveitar o mecanismo em vez de inventar um
  segundo é o próprio ponto: a skill já sabe procurar arquivo de convenção.
- **Override**: se o usuário aponta um caminho na invocação ("usa o context
  pack em `~/acme/padrao-arquitetura/`"), esse caminho vale, descoberta
  nenhuma acontece. Cobre o caso comum de o pack viver fora do repo do
  diagrama — num repo central de arquitetura, por exemplo.
- **Diretório, não arquivo único**: premissas de empresa real passam de uma
  página (a sintética deste protótipo já tem 4 seções) e um exemplo de
  referência é um artefato binário-ish separado por natureza. Forçar os dois
  num arquivo só sub-representaria um dos dois.
- **Diretório vazio ≠ pack**: presença de `.aws-context/` sem `premissas.md`
  nem `exemplos/*.drawio` conta como ausência (§4), não como pack vazio —
  evita a skill "achar" que foi configurada por um diretório esquecido.

## 2 · O que se extrai de prosa vs. de `.drawio`

**Prosa vira restrição. Exemplo `.drawio` vira preferência de estilo. Nunca o contrário.**

A prosa é **autoria intencional** — alguém decidiu escrever "zero subnet
pública" porque é regra. Um `.drawio` de exemplo é **uma amostra, n=1** —
"este diagrama não tem subnet pública" não licencia concluir "esta empresa
proíbe subnet pública": seria generalizar de uma amostra que pode não ter
subnet pública por acaso (o desenho é de um workload que não precisa de
uma), não por norma. Tratar ausência-em-amostra como proibição universal é
o tipo de indução frágil que a engenharia reversa fora de escopo do mapa
também erraria — por isso a distinção importa, e não é cosmética.

O que cada fonte pode legitimamente afirmar:

| | Prosa (`premissas.md`) | Exemplo (`exemplos/*.drawio`) |
|---|---|---|
| Pode **proibir/exigir** serviço | sim | não |
| Pode **ditar topologia** de rede | sim | não |
| Pode **filtrar/reescrever** o IR (§aplicar) | sim | não, nunca |
| Pode **preferir** uma variante visual | não é o formato certo pra isso | sim |
| Prova extraída por | seções conhecidas, parseadas por heading | delta de style vs. o que o catálogo (#17) desenharia sozinho |

Concretamente, do `.drawio` de exemplo o extrator só lê **divergência de
estilo**: a cell real usa uma cor, largura de traço, variante de ícone
diferente do que `cat.grupo()`/`cat.servico()` (#17) produziriam para o
mesmo nome. Isso é seguro de generalizar porque não é uma amostra estatística
— é a empresa **escolhendo desviar** do catálogo AWS puro, e um desvio
observado uma vez já é prova de que ele existe (diferente de uma ausência,
que não prova proibição). `extrair.cjs` implementa isso: reconstrói a style
canônica de cada shape usada no exemplo e reporta toda chave onde o valor
real diverge — nunca decide topologia ou catálogo a partir do desenho.

Achado de bônus, rodando o extrator contra o exemplo deste protótipo: uma das
divergências que ele haveria de achar numa empresa real é **exatamente** a
que o [#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17) deixou
aberta de propósito — o `fontColor` cinza do grupo VPC (`#AAB7B8`, quase
ilegível em fundo claro). O context pack não é só consumidor de decisão de
estilo; é uma fonte de insumo legítima para o ticket que a decide de vez
(referenciado no mapa como "#13", ainda não aberto).

## 3 · Dimensões que o context pack restringe

| Dimensão | Fonte | Como toca o IR (#11) |
|---|---|---|
| Catálogo de serviços (proibidos / obrigatórios) | prosa | filtra/insere `nos[].servico` |
| Topologia de rede obrigatória | prosa | reescreve `nos[].acesso`, insere/remove `nos[]` de rede (NAT, TGW) |
| Nomenclatura | prosa | reescreve `nos[].rotulo` |
| Padrões de segurança | prosa | quando falta um fato (qual CMK), vira `notas[]` — nunca reescreve calado (§5) |
| Estilo visual da casa | exemplo `.drawio` | ajusta a camada de **resolução** (#17/#13) — nunca `nos[]`, nunca topologia |

**Fora do alcance do context pack, por desenho**: layout (`elkjs`, #7) e
geometria. Nenhuma das duas fontes tem vocabulário pra isso — mesma fronteira
que o #11 já defende ("o agente nunca escreve coordenada"). Um context pack
que tentasse ditar posição estaria pedindo a pergunta errada.

## 4 · Comportamento sem context pack

**Segue com a convenção AWS oficial (#5/#8) como default — e avisa uma vez, sem bloquear.**

Isto **diverge** do precedente que `docs/agents/domain.md` já fixa para
`CONTEXT.md` ("se não existe, prossiga em silêncio, não sugira criar"). A
diferença não é capricho: a ausência de `CONTEXT.md` no pior caso custa
vocabulário subótimo numa conversa. A ausência de context pack, no pior caso,
produz um diagrama que **parece** a arquitetura de referência da empresa
(mesmos ícones AWS, mesma disciplina visual) mas ignora uma premissa que
existe e que ninguém contou à skill — e a premissa 1 do mapa não deixa a
skill ser consultor por metade: se ela sabe que pode estar desassistida,
avisar é a mesma obrigação que a leva a apontar SPOF.

O aviso é **uma linha, uma vez por sessão**, não repetido por diagrama:

> Nenhum context pack encontrado em `.aws-context/` — usando convenção AWS
> oficial. Se sua empresa tiver premissas (ex.: Transit Gateway obrigatório,
> zero subnet pública), aponte um diretório e elas passam a valer.

Nunca bloqueia — a premissa 10 do mapa é explícita: o usuário real não tem
esse material hoje, e isso "não bloqueia nada e não deve travar a construção".

## 5 · Conflito: a melhor arquitetura técnica viola uma premissa corporativa

**Obedece a premissa e sinaliza — nunca em silêncio, nunca "as duas opções" como equivalentes.**

Três posturas possíveis, e por que só uma sobrevive:

- *Obedece calado* — perde o rastro. Alguém aprova um diagrama achando que
  foi decisão técnica quando foi imposição corporativa; a próxima pessoa que
  questionar "por que TGW aqui?" não acha resposta no diagrama.
- *Apresenta as duas como opções equivalentes* — isso é o protocolo de
  **candidatas** do [#15](https://github.com/ThiagoPanini/panlabs-skills/issues/15),
  e ali as opções divergem em **eixo de forma** escolhido durante a sabatina.
  Uma premissa corporativa não é um eixo de forma em aberto — é uma coisa que
  a empresa **já pagou** (revisão de compliance, contrato com auditor). Tratar
  como escolha do momento dilui o proposito de ter um context pack.
- **Obedece e sinaliza** — a única que sobra, e não é invenção nova: é a
  **mesma régua** que o [#15 Fase 5](https://github.com/ThiagoPanini/panlabs-skills/issues/15)
  já fixou pra revisão de lacunas ("relata e nunca conserta calado"), só que
  a fonte da lacuna agora é o context pack em vez da análise de grafo pós-modelo.
  O canal também já existe no esquema do #11:
  `notas[].origem` tem o valor **`"premissa"`**, lado a lado com
  `"achado-recusado"` — o schema já antecipava este ticket.

**A régua de quando reescrever de fato vs. só sinalizar**: reescreve quando o
context pack fornece **tanto a regra de violação quanto o fato de
substituição** — "zero subnet pública" sozinha não bastaria (viraria o quê?),
mas com "egress via Transit Gateway" ao lado, a substituição está definida.
Só sinaliza quando obedecer exigiria inventar um fato que nem o modelo nem o
context pack respondem — qual chave KMS usar é o exemplo medido em `aplicar.cjs`
§6. Ver esse arquivo para os dois casos rodando contra um modelo real.

**Detalhe prático que `aplicar.cjs` errou na primeira tentativa, vale
registrar aqui**: `notas[].texto` é o que o motor (#11 `planejar.cjs`)
**desenha** — vira caixa de legenda, presa ao nó se `sobre` estiver presente.
A citação completa da premissa não cabe ali; a primeira versão colava o texto
inteiro e o render saiu com caixas de nota se empilhando em cima dos ícones.
O esquema do #11 já tem o lugar certo pra isso: `dossie` é opaco ao motor —
o texto que vira desenho fica curto (uma frase), e a premissa citada por
inteiro vai para `dossie.contextPack`, que persiste no arquivo sem nunca
virar traço.

## 6 · Como o context pack nasce, na primeira vez

**Não há entrevista dedicada. Captura preguiçosa, no mesmo ponto onde o conflito já aparece.**

Cogitado e descartado: uma sabatina extra só pra "levantar os padrões da
empresa" antes do primeiro diagrama. Rejeitado por dois motivos:

1. **Prazo errado** — pedir a alguém pra recitar toda a política de rede da
   empresa de memória, fora do contexto de um diagrama concreto, é o inverso
   do que a premissa 11 do mapa protege ("usuário chamado pro gosto
   irredutível, não pra catalogar shape"). Ninguém lembra "zero subnet
   pública" até ver uma subnet pública no desenho.
2. **Já existe o ponto de captura certo** — é exatamente o `⚠️ conflito` de
   §5. Quando a skill sinaliza uma tensão e o usuário responde "sim, aqui é
   sempre assim", essa resposta **é** uma premissa nova. A skill oferece
   persistir ali: cria `.aws-context/premissas.md` se não existir, ou
   acrescenta uma linha na seção certa. Mesma filosofia que
   `docs/agents/domain.md` já usa pro par `CONTEXT.md`/`docs/adr` —
   `/domain-modeling` "cria preguiçosamente quando termos ou decisões de
   fato se resolvem", não antes.

Primeiro diagrama numa empresa sem pack ainda sai — nunca bloqueia (§4). O
pack **acumula** uma regra confirmada por vez, do mesmo jeito incremental que
este próprio mapa acumula decisão por ticket.
