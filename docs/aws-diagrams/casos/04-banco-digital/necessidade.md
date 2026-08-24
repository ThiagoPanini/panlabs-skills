# Caso 4 · Banco digital — segregação regulatória

**Gênero** `L1` → `T5` multi-account · **caminho de layout** contas, modo
integração · **entrada** `sessao@1` — **este caso roda o ARCO INTEIRO**

## O que o usuário disse

> "O BACEN não aceita que quem opera seja quem audita. Hoje é tudo uma conta só e
> na última inspeção isso virou apontamento. A gente precisa separar, mas o time
> de risco não pode esperar cópia de dado: se o limite de crédito for de ontem, o
> produto não funciona. E a trilha tem que durar 5 anos sem ninguém poder apagar
> — nem eu."

## O que a sabatina extraiu

6 fatos. Um deles inferido de uma fala solta — *"a gente não pode dar limite com
dado de ontem"* — e é ele que **descarta a candidata B**.

| | tupla difere em | por que caiu |
|---|---|---|
| **A · três fronteiras com leitura cruzada explícita** | — | **escolhida** |
| B · três fronteiras com cópia analítica | `E2` | contradiz o fato confirmado que abriu o projeto |
| C · duas fronteiras, auditoria dentro do analítico | `E5` | é exatamente a segregação que o BACEN cobra; a economia de uma conta não paga o achado de auditoria |

**Revisão de lacunas:** `cross-account-sem-confianca` foi **consertado antes do
desenho** — a leitura passa por papel com confiança declarada, e a fase técnica
desenha o papel como nó `habilita`. A leitura cruzada em si foi **recusada e
aceita** para a v1.

## O que exercita

A troca de vocabulário que a vista técnica compra: as três **fronteiras de
responsabilidade** aprovadas viram três **contas AWS sob unidade organizacional**.
É o caso que provou que `ou` não existia em `sessao@1` — e é o caso que achou a
falha `A5.5` de roteamento. Ver o relatório.
