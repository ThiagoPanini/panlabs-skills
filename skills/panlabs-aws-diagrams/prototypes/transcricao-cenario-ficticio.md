# Protótipo — o protocolo de sabatina rodado ponta a ponta

> **Descartável.** Protótipo do ticket [#15](https://github.com/ThiagoPanini/panlabs-skills/issues/15).
> Cenário fictício. Serve para reagir ao *ritmo* do protocolo, não para virar código.
> A máquina por trás está em [`sabatina.html`](./sabatina.html).

**Cenário.** Rede varejista, 300 lojas. Pedido inicial do usuário — vago de propósito,
como pedido real costuma ser.

---

## Fase 0 · Entrada

> **Usuário:** Preciso de um diagrama. A gente recebe arquivo de venda de 300 lojas todo dia
> e queria um painel pra diretoria. Já tenho a ata da reunião de kickoff, segue anexo.

> **Skill:** Li a ata. Extraí quatro fatos — **todos marcados como inferidos**, nenhum vale até
> você confirmar, porque fato inferido errado vira mentira no desenho:
>
> | Fato | De onde | Trecho |
> |---|---|---|
> | Lote agendado (diário) | ata | *"os arquivos caem de madrugada"* |
> | Objeto / data lake | ata | *"joga tudo no S3 e depois a gente vê"* |
> | Multi-conta | ata | *"a conta de dados é separada da conta das aplicações"* |
> | ~~Serverless~~ | ata | *"acho que dava pra fazer com Lambda"* — **linguagem hedge, entra como opção, não como fato** |
>
> Também **estacionei** dois nomes de serviço que você citou — `Lambda`, `S3`. Eles não entram
> agora: estamos na vista lógica, e misturar serviço com capacidade quebra `A1.10`
> (um nível de abstração). Volto com eles na fase técnica.

*Observação de projeto: a ata **acelerou** a sabatina — 3 dos 5 eixos vieram pré-preenchidos —
mas **não baixou a régua**. A régua é `A1`, e ela cobra confirmação.*

---

## Fase 1 · Sabatina lógica — rodada 1

A rodada inteira de uma vez, cada pergunta com recomendação. Só os **eixos de forma** —
os cinco que mudam o desenho.

> ❓ **Q1 — Postura de computação.** A ata diz "dava pra fazer com Lambda", mas isso era
> chute de reunião. Processar 300 arquivos/dia é *lote*, não *evento*: serverless, contêiner
> agendado, ou serviço gerenciado sem compute próprio?
> ➡️ **Gerenciado sem compute.** 300 arquivos/dia não justifica você operar runtime.
>
> ❓ **Q2 — Estilo de integração.** Lote agendado (confirma a ata), ou os arquivos chegam a
> qualquer hora e você quer reagir à chegada?
> ➡️ **Lote agendado**, se a diretoria olha o painel de manhã.
>
> ❓ **Q3 — Estado e dados.** Volume por dia, e por quanto tempo o histórico precisa viver?
> ➡️ **Objeto/data lake** com camada analítica por cima.
>
> ❓ **Q4 — Exposição de rede.** As lojas entregam por onde — internet pública, link dedicado,
> ou alguém deposita num bucket?
> ➡️ **Privado**, com ponto de entrega controlado.
>
> ❓ **Q5 — Topologia de contas.** A ata fala em conta de dados separada. Quais contas existem
> hoje, e qual manda em qual?
> ➡️ **Multi-conta**: `lojas` (aterrissagem) → `dados` (processamento) → `analytics` (consumo).

> **Usuário:** Q1 ok. Q2 na verdade tem loja que manda fora de hora e a diretoria reclama que o
> painel tá velho. Q3 uns 4GB/dia, guardar 5 anos por causa de auditoria. Q4 as lojas mandam por
> SFTP hoje. Q5 isso, três contas mesmo.

---

## Fase 2 · Rodada 2 — sondas condicionais

Nenhuma destas foi perguntada na rodada 1: **cada uma foi destravada por uma resposta**.
Perguntar antes seria adivinhar.

> ❓ **Q6 — (destravada por Q2).** "Manda fora de hora" + "painel velho" contradiz *lote diário*.
> O gatilho é a **chegada do arquivo**, não o relógio?
> ➡️ **Sim** — troca lote agendado por assíncrono-por-evento. Muda o desenho.
>
> ❓ **Q7 — (destravada por Q3: retenção 5 anos + auditoria).** Auditoria impõe
> **residência** de dados, imutabilidade (WORM), ou chave gerenciada por você?
> ➡️ Assumo **região única + chave gerenciada por você**; corrija se houver norma escrita.
>
> ❓ **Q8 — (destravada por Q4: SFTP).** SFTP é requisito **das lojas** (não dá pra mudar o
> cliente) ou é só o que existe hoje?
> ➡️ Se é das lojas, o SFTP vira componente do desenho, não detalhe.
>
> ❓ **Q9 — (destravada por Q5: multi-conta).** Quem **inicia** a travessia entre contas —
> `dados` puxa de `lojas`, ou `lojas` empurra?
> ➡️ **`dados` puxa.** Direção de aresta é `A1.7`, e a errada inverte a leitura de confiança.

> **Usuário:** Q6 sim, é por chegada. Q7 não tem norma escrita, mas chave nossa sim. Q8 é das
> lojas, não muda. Q9 dados puxa.

---

## Fase 3 · Parada

> **Skill:** Paro de perguntar aqui. Não é julgamento meu — rodei `A1` contra o modelo:
>
> ```
> A1.4 todo elemento nomeado ........ ok
> A1.5 todo elemento tipado ......... ok   (5/5 eixos de forma confirmados)
> A1.6 toda aresta rotulada ......... ok
> A1.7 toda aresta unidirecional .... ok   (Q9 fixou a direção)
> A1.10 um nível de abstração ....... ok   (estacionamento segurou Lambda e S3)
> A2.1 complexidade ≤ 6 na legenda .. ok   (5 entradas)
> → frontier vazia
> ```
>
> Toda pergunta que eu fizesse agora seria sobre fato que **o desenho não usa**.

*Observação de projeto: é aqui que o protocolo se distingue de um questionário. Ele não tem
uma lista fixa de N perguntas — ele para quando a checagem para de falhar.*

---

## Fase 4 · Candidatas

Três. Cada par difere em **pelo menos um eixo de forma** — e eu digo qual. Sem matriz de
estrelas: estrela convida a tirar média, e média destrói decisão.

### A · "Só chegou, já processou"
`gerenciado sem compute` · `evento` · `data lake` · `privado` · `multi-conta`
- **Compra:** painel fresco minutos após a loja enviar; zero runtime seu.
- **Paga:** custo por evento imprevisível em dia de pico; depuração de fluxo assíncrono é chata.
- **Escolha se** "painel velho" é a dor principal da diretoria.
- **Errada se** o volume por loja crescer 10× — aí o custo por evento passa o de lote.

### B · "Micro-lote de 15 minutos"
`gerenciado sem compute` · `lote agendado` · `data lake` · `privado` · `multi-conta`
> Difere de **A** no eixo **integração**.
- **Compra:** custo previsível, reprocessamento trivial, uma janela pra consertar arquivo torto.
- **Paga:** até 15 min de atraso — a reclamação da diretoria volta menor, não some.
- **Escolha se** auditoria e reprocessamento pesam mais que frescor.
- **Errada se** alguém prometeu "tempo real" pra diretoria.

### C · "Transformação na borda"
`contêineres` · `evento` · `relacional gerenciado` · `privado` · `conta única`
> Difere de **A** em **computação**, **estado** e **contas**.
- **Compra:** lógica de negócio complexa por loja em código comum; consulta relacional direta.
- **Paga:** você opera cluster; colapsa as três contas e perde a fronteira de auditoria.
- **Escolha se** a transformação por loja for regra de negócio pesada, não parsing.
- **Errada se** a separação de contas for exigência de compliance — e a ata sugere que é.

> ➡️ **Recomendo A.** A dor declarada é frescor, e o eixo `contas` da ata sobrevive.
> **C** está no páreo só se a transformação por loja for muito mais complexa do que a ata sugere.

> **Usuário:** É a A mesmo.

---

## Fase 5 · Revisão de lacunas

Roda **depois** do modelo montado e **antes** do layout — porque estas não são respostas a
perguntas, são **propriedades emergentes do grafo**. Não dá pra perguntar "tem SPOF?".

> ⚠️ **SPOF** — o endpoint SFTP é o único caminho de entrada, sem par.
> ⚠️ **DLQ ausente** — caminho por evento sem destino para arquivo que falha o parse.
> ⚠️ **TRUST** — `dados` puxa de `lojas` sem papel de acesso cross-account declarado.
> ⚠️ **Retenção** — 5 anos declarado, mas nenhuma regra de ciclo de vida no modelo.
>
> Cada uma é **relato + proposta**. Nenhuma entra no desenho sem você decidir.

> **Usuário:** DLQ e trust põe. O SFTP redundante fica pra fase 2, não tenho budget agora.
> Ciclo de vida põe.

> **Skill:** Registrado. O diagrama **não** vai mostrar SFTP redundante — desenha o que existe.
> A recusa vai para as notas do diagrama:
>
> > *SPOF conhecido e aceito: ponto de entrada SFTP sem par (decisão de orçamento, 2026-08).*

*Observação de projeto: esta é a regra que segura o produto inteiro. `B2` da rubrica diz que
**nenhuma checagem geométrica sabe se a arquitetura desenhada existe**, e o substituto que a
literatura propõe — diff contra IaC — o mapa colocou fora de escopo. Logo a sabatina é a
**única** guarda de veracidade do conteúdo. Se a skill "consertar" o SPOF calada, ela produz
um diagrama bonito de uma arquitetura que não existe — e nada a jusante pega isso.*

---

## Fase 6 · Entrega da vista lógica e transição

> **Skill:** Vista lógica pronta — capacidades e fluxos, **zero nome de serviço AWS**.
> Ao aprovar, mudo para a vista técnica, e aí o estacionamento volta:
> `Lambda` e `S3` reaparecem como **sugestões inferidas** contra as capacidades
> *processar-na-chegada* e *reter-objeto* — para você confirmar, não para eu assumir.
>
> *(Como a vista aprovada persiste entre sessões é decisão do ticket
> [#14](https://github.com/ThiagoPanini/panlabs-skills/issues/14), não desta.)*

---

## O que este protótipo demonstrou

| Afirmação | Onde aparece |
|---|---|
| A sabatina para sozinha, por checagem e não por julgamento | Fase 3 |
| Material de entrada acelera sem baixar a régua | Fase 0 |
| Nome de serviço prematuro não se perde nem contamina | Fase 0 → 6 |
| Sonda condicional só entra quando destravada | Fase 2 |
| Candidatas genuinamente distintas, com o eixo nomeado | Fase 4 |
| A competência de consultor é análise de grafo, não pergunta | Fase 5 |
| Recusa do usuário é registrada, não silenciada | Fase 5 |

## O que ele NÃO demonstrou

- Que os **cinco eixos** são os certos — só que cinco eixos *bastam para este caso*.
- Que **três** é o número certo de candidatas.
- Comportamento com usuário que responde "não sei" em eixo de forma.
- Material de entrada que **contradiz** o que o usuário diz depois.
