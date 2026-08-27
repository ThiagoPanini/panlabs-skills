# O context pack corporativo

Como a skill é alimentada com a arquitetura de referência de uma empresa, e como isso restringe o que ela propõe.

> **Isto é contrato, não script.** Não há código de produção que leia o pack: o extrator e o aplicador ficaram em `prototypes/q16/`, e a árvore de produção não alcança `prototypes/` de propósito. **Você lê o pack e escreve o modelo de acordo.** O canal que leva o conflito até o desenho — `notes[].origin = "assumption"` — esse sim existe no esquema.

## Onde ele mora

```
.aws-context/
  premissas.md          # obrigatório para o diretório contar como pack
  exemplos/
    *.drawio            # zero ou mais
```

Descoberto por convenção a partir da raiz do projeto sendo diagramado, pelo mesmo mecanismo que já resolve arquivos de convenção neste repositório. **Override explícito vence a descoberta**: se o usuário aponta um caminho na invocação (*"usa o context pack em `~/acme/padrao-arquitetura/`"*), esse caminho vale e descoberta nenhuma acontece — cobre o caso comum de o pack viver num repositório central de arquitetura, fora do repositório do diagrama.

**Diretório vazio não é pack.** `.aws-context/` sem `premissas.md` nem `exemplos/*.drawio` conta como ausência, não como pack vazio — senão a skill "acha" que foi configurada por um diretório esquecido.

## Prosa vira restrição. Exemplo vira preferência de estilo. Nunca o contrário.

Esta assimetria é o centro do contrato, e não é cosmética.

A prosa é **autoria intencional** — alguém decidiu escrever *"zero subnet pública"* porque é regra. Um `.drawio` de exemplo é **uma amostra, n=1**: *"este diagrama não tem subnet pública"* não licencia concluir *"esta empresa proíbe subnet pública"*. O desenho pode ser de um workload que não precisava de uma. Tratar ausência-em-amostra como proibição universal é a mesma indução frágil que a engenharia reversa fora de escopo cometeria.

| | prosa (`premissas.md`) | exemplo (`exemplos/*.drawio`) |
|---|---|---|
| proibir ou exigir serviço | sim | não |
| ditar topologia de rede | sim | não |
| filtrar ou reescrever o modelo | sim | **nunca** |
| preferir uma variante visual | não é o formato para isso | sim |
| como se extrai | seções conhecidas, por heading | divergência de estilo contra o que o catálogo desenharia sozinho |

Do `.drawio` de exemplo, leia **só divergência de estilo**: a célula real usa uma cor, largura de traço ou variante de ícone diferente do que `node catalog/aws-shapes.cjs <nome>` produz para o mesmo nome. Isso é seguro de generalizar porque **não é uma amostra estatística — é a empresa escolhendo desviar** do catálogo AWS puro, e um desvio observado uma vez já prova que ele existe. Uma ausência não prova proibição; um desvio prova desvio.

> Cuidado de bancada, medido: `Private subnet` e `Public subnet` compartilham o mesmo `grIcon` no catálogo e **só a cor as separa**. Comparar sem desambiguar pela cor produz divergência falsa.

## O que o pack restringe

| dimensão | fonte | como toca o modelo |
|---|---|---|
| catálogo de serviços (proibidos / obrigatórios) | prosa | filtra ou insere `nodes[].service` |
| topologia de rede obrigatória | prosa | reescreve `nodes[].access`; insere ou remove nós de rede |
| nomenclatura | prosa | reescreve `nodes[].label` |
| padrões de segurança | prosa | quando falta um fato, vira `notes[]` — nunca reescreve calado |
| estilo visual da casa | exemplo | ajusta a camada de resolução — nunca `nodes[]`, nunca topologia |

**Fora do alcance das duas fontes, por desenho: layout e geometria.** Nenhuma tem vocabulário para isso — a mesma fronteira que o modelo já defende. Um context pack que tentasse ditar posição estaria pedindo a pergunta errada.

## Sem pack: convenção oficial, um aviso, nunca bloqueia

Siga a convenção AWS oficial e avise **uma linha, uma vez por sessão** — não por diagrama:

> Nenhum context pack encontrado em `.aws-context/` — usando convenção AWS oficial. Se sua empresa tiver premissas (ex.: Transit Gateway obrigatório, zero subnet pública), aponte um diretório e elas passam a valer.

**Nunca bloqueia.** O usuário real pode não ter esse material, e isso não pode travar nada.

Isto **diverge** do precedente de silêncio que este repositório fixa para arquivos de contexto ausentes (*"se não existe, prossiga em silêncio, não sugira criar"*), e a diferença não é capricho: lá a ausência custa vocabulário subótimo numa conversa. Aqui a ausência produz um diagrama que **parece** a arquitetura de referência da empresa — mesmos ícones, mesma disciplina visual — e ignora uma premissa que existe e que ninguém contou à skill. Quem aponta SPOF não pode calar sobre isso.

## Conflito: obedece a premissa e sinaliza

Quando a arquitetura tecnicamente melhor viola uma premissa corporativa. Três posturas possíveis, e só uma sobrevive:

- *obedece calado* — perde o rastro. Alguém aprova achando que foi decisão técnica quando foi imposição corporativa, e a próxima pessoa que perguntar *"por que Transit Gateway aqui?"* não acha resposta no diagrama.
- *apresenta as duas como equivalentes* — isso é o **protocolo de candidatas**, e lá as opções divergem em eixo de forma **em aberto**. Uma premissa corporativa não é eixo em aberto: é coisa que a empresa **já pagou** — revisão de compliance, contrato com auditor. Tratar como escolha do momento dilui o motivo de haver um pack.
- **obedece e sinaliza** — a única que sobra, e não é invenção nova: é a mesma régua da revisão de lacunas (*relata e nunca conserta calado*), com a fonte da lacuna trocada.

### A régua entre reescrever e só sinalizar

**Reescreve** quando o pack dá a regra de violação **e** o fato de substituição. *"Zero subnet pública"* sozinha não bastaria — viraria o quê? Com *"egress via Transit Gateway"* ao lado, a substituição está definida.

**Só sinaliza** quando obedecer exigiria inventar um fato que nem o modelo nem o pack respondem — *qual* chave KMS usar.

Medido contra um modelo real que violava a premissa de propósito (subnet pública mais NAT gateway): 12 notas `origin: "assumption"` — 2 remoções, 2 inserções de Transit Gateway e 7 renomeações mecânicas do lado que reescreve, mais 3 sinais de segurança sem tocar o grafo.

### Onde a premissa fica escrita

| | onde | por quê |
|---|---|---|
| a frase curta que aparece no desenho | `notes[]` com `origin: "assumption"` | `notes[].text` é **desenhado** — citação inteira empilha caixa em cima de ícone |
| a premissa citada por inteiro | **no próprio `premissas.md`** | é a fonte da verdade, e já está versionada |

> ⚠️ O contrato original mandava guardar a citação em `dossier.contextPack`. Medido: `model@1` aceita (`dossier` é `additionalProperties: true`), mas **`session@1` recusa** — o dossiê de sessão tem lista fechada de seis campos. Como o pack é um arquivo versionado, guardar a citação dentro do `.drawio` seria uma segunda cópia que dessincroniza; a nota curta mais o ponteiro para o pack basta. Se um dia a citação precisar viajar, o campo tem de nascer em `session/schema.json`.

## Como o pack nasce, na primeira vez

**Não há entrevista dedicada. Captura preguiçosa, no ponto onde o conflito já aparece.**

Uma sabatina extra só para levantar os padrões da empresa foi cogitada e descartada por dois motivos:

1. **Prazo errado.** Pedir a alguém que recite toda a política de rede de memória, fora do contexto de um diagrama concreto, é o inverso de chamar o usuário para o gosto irredutível. Ninguém lembra *"zero subnet pública"* até ver uma subnet pública no desenho.
2. **O ponto de captura certo já existe** — é o conflito acima. Quando você sinaliza uma tensão e o usuário responde *"sim, aqui é sempre assim"*, essa resposta **é** uma premissa nova. Ofereça persistir ali: crie `.aws-context/premissas.md` se não existir, ou acrescente uma linha na seção certa.

O primeiro diagrama numa empresa sem pack sai assim mesmo. O pack **acumula** uma regra confirmada por vez.

## Uma armadilha registrada e não consertada

Reescrita de nomenclatura por AZ (`acme-app-1a` vs `acme-app-1b`) apaga o sinal que o motor usa para reconhecer redundância zonal: `label` faz dois trabalhos — texto exibido **e** chave de papel. O caminho de layout muda de **grade** para **elk** mesmo a arquitetura continuando zonalmente redundante.

Se o pack impõe sufixo de AZ no rótulo, confira o `path` que `engine/generate.cjs` imprime na última linha ao gravar (`path "grade"` ou `path "elk"`) antes de aceitar o desenho.
