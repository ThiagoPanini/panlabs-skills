# ⚠️ Protótipo descartável — não é a skill

Código e desenhos de uma pergunta só, do ticket
[#22 · Ordem de leitura das camadas de rede](https://github.com/ThiagoPanini/panlabs-skills/issues/22).
**Nada aqui vira produção.** O que sobrevive é a decisão; estes arquivos são a prova executável.

Abra [`comparacao.html`](comparacao.html) para ver os quatro desenhos juntos.

## A decisão

**Derivar primeiro; declarar só quando falta evidência.** A interface do IR ganha o campo
semântico opcional `camada: "borda" | "aplicacao" | "dados"` na subnet. Ele não é posição:
não aceita número, linha, coordenada nem `ordem`.

O motor ordena pela tupla:

1. exposição — pública antes de privada;
2. camada — borda → aplicação → dados → indefinida;
3. rótulo normalizado e `id` — apenas desempate determinístico entre iguais.

Para uma subnet privada sem `camada`, o motor consulta a categoria dos serviços no catálogo do
[#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17):

| evidência do catálogo | camada derivada |
|---|---|
| `network_content_delivery` | borda |
| `compute`, `containers`, `serverless`, `front_end_web_mobile` | aplicação |
| `database`, `storage` | dados |

Só entram categorias com sinal forte. Uma categoria visual da AWS não é automaticamente uma
camada arquitetural. Zero evidência ou evidências de mais de uma camada produzem
`indefinida`, colocada depois das camadas conhecidas, com aviso. O agente pode então preencher
`camada` como escape semântico. Isso preserva máximo AFK no caso comum e não inventa resposta
no caso ambíguo.

Uma subnet pública continua no topo mesmo que contenha um banco: exposição é o primeiro
critério, como o ticket já fixou. Esse conflito é assunto do consultor/validador, não motivo
para esconder a exposição no layout.

## Por que esta interface

- Campo obrigatório faria a sabatina perguntar o que o catálogo já sabe na maioria dos casos.
- Inferência sem escape falha justamente nas subnets vazias e mistas.
- Distância da borda não existe no caminho sem arestas.
- `ordem: 2` faria o IR escolher geometria e atravessaria a fronteira do #11.

`camada` acrescenta um fato de arquitetura pequeno; a implementação de classificação, fallback,
aviso e ordenação fica escondida atrás de `gerar(modelo)`. O caller não precisa conhecer a
paleta do catálogo nem o algoritmo de layout.

## As quatro provas

| modelo | ordem emitida | origem |
|---|---|---|
| `App subnet · Data subnet` | App, Data | EC2=`compute`; RDS=`database` |
| `Web subnet · Data subnet` | Web, Data | ECS=`containers`; Aurora=`database` |
| `Ingest subnet · Core subnet` | Ingest, Core | Lambda=`compute`; DynamoDB=`database` |
| `Subnet vazia · Data subnet` | Data, vazia | RDS=`database`; vazia=`indefinida` + aviso |

O quarto desenho mostra o fallback sem escape. O teste separado também prova que
`camada: "aplicacao"` posiciona uma subnet vazia antes de dados e remove o aviso.

## Arquivos

| arquivo | função |
|---|---|
| `camadas.cjs` | classificação por exposição/catálogo e ordenação determinística |
| `gerar.cjs` | interface pública `gerar(modelo)` e emissor draw.io |
| `modelo/*.json` | as quatro entradas da prova |
| `saida/*.{drawio,png}` | XML e render reais |
| `tests/ordem-integracao.test.cjs` | comportamento observado na geometria pública |
| `tests/rodar.sh` | testes, sintaxe, regeneração e render oportunista |

Rodar tudo:

```bash
./tests/rodar.sh
```
