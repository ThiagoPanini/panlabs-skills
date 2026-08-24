# Caso 3 · Cooperativa agrícola — telemetria de silos

**Gênero** `L2` → `T3` event-driven · **caminho de layout** ELK ·
**entrada** `sessao@1` — **este caso roda o ARCO INTEIRO, os sete passos**

## O que o usuário disse

> "A gente perdeu 4,1 milhões na safra passada com grão embolorando dentro do
> silo. Tem sensor lá dentro desde 2023, mas o dado só serve para o relatório do
> mês seguinte. Eu quero saber que vai estragar antes de estragar. O técnico
> precisa ser avisado — se ele chegar em 15 minutos, ele salva. E o cooperado
> quer ver o painel dele, mas isso é semanal, ninguém abre todo dia. Ah, e a
> gente não tem time de infra: são dois desenvolvedores meio período."

## O que a sabatina extraiu

7 fatos, 2 deles inferidos do material e confirmados em bloco. Três nomes de
serviço foram ditos cedo demais (**IoT Core**, **Timestream**, **QuickSight**) e
foram para o **estacionamento** — voltam na fase técnica como sugestão a
confirmar, não como fato.

**Três candidatas**, diferindo em eixo de forma:

| | tupla difere em | por que caiu |
|---|---|---|
| **A · leque assíncrono por evento** | — | **escolhida** |
| B · cadeia síncrona única | `E2` | o painel semanal é o ramo mais lento e o menos crítico; pô-lo na mesma cadeia do alerta de 15 min inverte a prioridade |
| C · lote de hora em hora | `E2`, `E5` | o requisito de 15 min é o motivo do projeto; um lote horário o contradiz na primeira linha |

**Revisão de lacunas:** dois achados. `spof` em `receber-leitura` foi **consertado
antes do desenho** (o sensor rebufferiza 6 h). `assincrono-sem-dlq` no ramo do
painel foi **recusado pelo usuário** e virou nota — o elo que faz *"conhecido e
aceito"* sobreviver até o desenho.

## O que exercita

O arco inteiro: sabatina → candidatas → lacunas → aprovação (`aprovar.cjs`) →
elaboração técnica (`retomar.cjs --delta`) → publicação (`publicar.cjs`). Leque
assíncrono com fila morta em dois ramos e ausente no terceiro. **E achou um
defeito de contrato** — ver o relatório.
