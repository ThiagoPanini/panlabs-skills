# Caso 5 · Rede de farmácias — novo canal digital

**Gênero** `L1` blocos lógicos · **caminho de layout** ELK ·
**entrada** `modelo@1` direto, `vista: "logica"`

## O que o usuário disse

> "Semana que vem eu apresento o canal digital para o comitê. Tem o jurídico
> nessa sala, tem o diretor comercial, tem o farmacêutico-responsável. Se eu
> chegar com um slide cheio de Lambda e DynamoDB eu perco a sala nos primeiros
> dois minutos. Eu preciso mostrar **o que o sistema faz** e **quem é dono de
> quê** — a parte técnica a gente discute depois com o time."

## O que a sabatina extraiu

Três fronteiras de responsabilidade com dono nomeado: **Venda** (produto digital),
**Receita e conformidade** (farmácia clínica), **Entrega** (logística).

**Nenhum nome de serviço AWS entrou.** É a vista de que a premissa 2 fala: ela
existe para ser mostrada a gente não-AWS.

## O que exercita

`vista: "logica"` com `tipo: "bloco"`, agrupamento por fronteira de
responsabilidade, sem passo numerado (o eixo cai em coluna), e a nota de premissa
regulatória (Portaria 344) presa a um bloco.

**Este é o caso mais limpo do lote** — 5 falhas, todas no piso conhecido, zero
falha semântica, zero sobreposição de rótulo.
