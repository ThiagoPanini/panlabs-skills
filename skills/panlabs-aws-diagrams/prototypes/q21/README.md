# ⚠️ Protótipos descartáveis — não é a skill

Desenhos e medições de uma pergunta só, do ticket
[#21 · Eixo da faixa de AZ vs. eixo do fluxo](https://github.com/ThiagoPanini/panlabs-skills/issues/21).
**Nada aqui vira produção.** O que sobrevive é a *decisão*, que fica na resolução do ticket;
estes arquivos ficam como fonte primária.

**Abra `comparacao.html` com duplo clique** — alterna entre os cinco desenhos e traz as duas
varreduras.

## A pergunta

O [#19](https://github.com/ThiagoPanini/panlabs-skills/issues/19) deixou a AZ virar **faixa
derivada** quando a arquitetura afirma redundância zonal, e o protótipo de lá desenhou essas
faixas como **colunas**. O `O1` do [#5](https://github.com/ThiagoPanini/panlabs-skills/issues/5)
— 17 de 24 diagramas oficiais — quer o fluxo correndo **esquerda → direita**. Os dois querem a
mesma horizontal. Nenhuma lâmina do deck decide: nenhuma tem faixa de AZ *e* fluxo numerado.

## O cenário

Um só, nos cinco desenhos: app web 3 camadas, 3 AZs, 5 passos numerados, com Route 53 e S3 fora
da VPC (`O3`), ALB e Auto Scaling group cruzando zona, e RDS primário em 1a com standby em 1b.
Atinge `T1` e `T4` ao mesmo tempo — os dois gêneros que a pergunta afeta.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `modelo.js` | O modelo, um só, compartilhado por geradores e medidores. |
| `motor.js` | Layout, roteamento, medição. **Tudo parametrizado por `axis`** — se trocar de eixo custasse motor novo, este arquivo não existiria. Usa o catálogo do [#17](https://github.com/ThiagoPanini/panlabs-skills/issues/17) para as styles. |
| `gerar.js` | Os cinco `.drawio`. Rodar: `node gerar.js`. |
| `medir-proporcao.js` | Varre 2–4 zonas × 4–11 etapas nos dois eixos e compara com o 16:9 do `O24`. |
| `medir-invariancia.js` | Seis modelos diferentes pelos dois eixos; confere se a rubrica do [#8](https://github.com/ThiagoPanini/panlabs-skills/issues/8) desempata. |
| `medir-ordem.js` | Força bruta nas 6 permutações de raia, nos 2 eixos. |

Renderizar:

```bash
node gerar.js
for f in *.drawio; do
  xvfb-run -a ~/.local/opt/drawio/squashfs-root/AppRun \
    -x -f png -s 2 --no-sandbox -o "${f%.drawio}.png" "$f"
done
```

## Os cinco desenhos

| Arquivo | O que é | A5.5 | proporção |
|---|---|---|---|
| `a-az-coluna-fluxo-vertical` | A leitura da lâmina 9 preservada, fluxo enfiado na vertical | 1 | 0,70 |
| `b-az-linha-fluxo-horizontal` | `O1` preservado, a zona vira raia | 1 | 2,50 |
| `c-fluxo-na-zona-de-referencia` | A saída do [#6](https://github.com/ThiagoPanini/panlabs-skills/issues/6) aplicada a zona: a aresta que cruzaria não é desenhada | 0 | 2,50 |
| `d-az-como-multiplicidade` | Sem faixa; a zona vira texto (`×3, uma por AZ`) | 0 | 6,33 |
| `e-ordem-de-raia-por-busca` | Igual ao B, com a ordem das raias escolhida por varredura | **0** | 2,50 |

## O que as medições disseram

**1. A rubrica não desempata.** Trocar o eixo é transpor a grade, e `A4.2`/`A5.5`/`A5.1`/`A5.7`
são todas de **incidência** — quem toca quem —, que é invariante por transposição. Seis modelos
(leque, convergência, buraco, malha, pulo de etapa, aresta transversal) pelos dois eixos:
**nenhum diverge**. O validador geométrico é cego a esta pergunta. Ela não é sobre o diagrama
mentir; é sobre ele ser lido.

**2. A proporção decide, 24 de 24.** Com fluxo numerado, a dimensão ordenada tem 5–11 posições
(`O22`) e a paralela tem 2–4. Contra o 16:9 que o `O24` mediu em 12 de 12 PDFs, o fluxo na
horizontal vence em **todas** as 24 combinações realistas. Sem exceção.

**3. E vira empate exatamente no regime da lâmina 9.** Sem fluxo numerado, com as "etapas"
sendo só camadas de sub-rede, 3 AZ × 2 camadas é o único caso em que a coluna de AZ ganha
(1,76 contra 0,90). O deck não estava errado — estava num regime onde a contagem não força nada.

**4. O cruzamento que sobra é de ordem de raia, não de eixo.** Varrendo as 6 permutações nos 2
eixos, o piso de `A5.5` é **zero nos dois**. Ordenar é barato (`n!` com n de 2 a 4). E cuidado
com heurística: "põe o alvo da convergência no meio" apenas **troca** um cruzamento por outro —
medido, não suposto. Varra, não adivinhe.

## Achados de método (valem para o motor de verdade)

- **O construtor de banda derivada do #19 não mudou** — `unionRect` sobre os membros, sem
  parâmetro de eixo. O que mudou foi a **calha**: o #19 fixou uma constante por família porque
  lá todas as faixas eram colunas lado a lado, dividindo a mesma calha. Com dois eixos possíveis
  aparece o caso que faltava — **duas bandas topando na mesma linha**. A calha só empilha se
  elas se **sobrepõem** no eixo transversal; lado a lado dividem. Sem isso as três faixas de AZ
  saem em escada (visto no render, corrigido).
- **A armadilha do #19 pegou de novo**: um `<b>` cru dentro de atributo XML e o draw.io
  renderizou o arquivo **truncado, sem erro nenhum** — só o título saiu. `gerar.js` agora valida
  antes de gravar. Isso vale para o motor de verdade, como o #19 já tinha avisado.
- **Centrar o ícone importa para medir.** A caixa de span é alta em `H` e larga em `V`; ancorar
  o ícone no topo dava vantagem artificial a um dos eixos e sujou a primeira rodada de números.
- **Aresta que pula etapa precisa desviar pela margem mais próxima da origem.** Desviar pelo
  lado errado atravessa exatamente as faixas que o desvio existia para evitar.
