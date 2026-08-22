# ⚠️ Protótipos descartáveis — não é a skill

Medição e desenhos de uma pergunta só, do ticket
[#19 · Interseção AZ × VPC](https://github.com/ThiagoPanini/panlabs-skills/issues/19).
**Nada aqui vira produção.** O que sobrevive é a *decisão*, que fica na resolução do ticket;
estes arquivos ficam como fonte primária da medição.

**Abra `comparacao.html` com duplo clique** — alterna entre os cinco desenhos.

## A medição (refeita do zero, não herdada do #5)

| Arquivo | O que é |
|---|---|
| `medir-ooxml.py` | Extrai toda caixa de `ppt/slides/*.xml`, **resolvendo as transformadas de grupo aninhado** (`chOff`/`chExt`), e converte EMU → polegadas. Uso: `python3 medir-ooxml.py <dir-ooxml> saida.json`. |
| `classificar-pares.py` | Classifica **todo par** de caixas de grupo em contém / cruza / disjunto, por assinatura de cor+traço (não por texto — na lâmina 21 a caixa de AZ não tem rótulo próprio). |

Fontes baixadas na hora (não versionadas, ~19 MB):

```
https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Microsoft-PPTx-toolkits_07312026.1c286c4a809a3cf2902c88ff63bf7dd1fa3cd55d.zip
https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/samples/attachment.zip
```

**Resultado:** as coordenadas do #5 batem casa decimal por casa decimal. E aparece o que o #5
não contou: **ASG cruza AZ 4×**, mais que AZ×VPC (3×) — o cruzamento é uma *classe*, não um
caso especial da AZ. Na SRA (arquitetura real publicada) há **zero caixas de AZ**.

## Os desenhos

| Arquivo | O que é |
|---|---|
| `gerar-candidatos.js` | A, B e C — árvore estrita · cruzamento · AZ omitida. Cenário 2 VPCs × 3 AZs. |
| `gerar-banda-derivada.js` | B′ — a banda vira **união calculada dos membros**, com membership **assimétrica** (inspeção só em 1a/1b) e um ASG cruzando as 3 AZs. Mostra as colisões de rótulo **em bruto**. |
| `gerar-calhas.js` | B″ — as mesmas bandas com as **quatro calhas**. Zero colisão, nada ajustado à mão. |

Rodar: `node gerar-*.js` e depois
`xvfb-run -a ~/.local/opt/drawio/squashfs-root/AppRun -x -f png -s 2 --no-sandbox -o X.png X.drawio`.

> ⚠️ Armadilha custosa: `value="…<br>…"` cru é **XML inválido** e o draw.io renderiza o
> arquivo truncado **sem erro nenhum** — o primeiro render saiu com a VPC vazia. Todo valor
> passa por `esc()`. Isso vale para o motor de verdade.

## A pergunta que os cinco respondem

O agrupamento de rede da AWS não é uma árvore. O motor precisa sair da árvore para honrar isso?

**Resposta medida: não.** Em B, as subnets continuam filhas da VPC e a faixa de AZ é *irmã*,
desenhada antes (atrás). A árvore de contenção segue `Cloud › VPC › Subnet` — o que o mxCell e
o elkjs querem. O que muda é o **IR**: a AZ deixa de ser container e vira **dimensão** da subnet.
