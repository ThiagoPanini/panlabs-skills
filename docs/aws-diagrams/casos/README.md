# Os casos de uso — a skill rodando contra arquiteturas que não existiam antes

Seis cenários escritos do zero, nenhum deles fixture da skill. Cada diretório
carrega a **necessidade em prosa** (o que o usuário diria), o **modelo**, o
**`.drawio` gerado**, o **PNG renderizado** e o **laudo** das 62 checagens.

O critério é o do [`corpus.md`](../corpus.md) §5, primeira linha: *validar o arco
contra a própria fixture dele não mede nada.*

| | caso | gênero | caminho | entrada | falhas | semânticas | veredito |
|---|---|---|---|---|---|---|---|
| 1 | [Rede de clínicas · prontuário](01-telemedicina/) | `T1` | grade | `modelo@1` | 11 | **0** | desenha, com sobreposição de rótulo |
| 2 | [Marketplace de ingressos](02-ingressos/) | `T4` | grade | `modelo@1` | 10 | **0** | achou defeito, **corrigido**: faixa engolia não-membro ([#31](https://github.com/ThiagoPanini/panlabs-skills/issues/31), ver `corpus.md` §14) |
| 3 | [Cooperativa · telemetria de silos](03-silos/) | `L2`→`T3` | ELK | `sessao@1` · **arco inteiro** | 6 / 7 | **0** | os 7 passos fecham |
| 4 | [Banco digital · segregação](04-banco-digital/) | `L1`→`T5` | contas | `sessao@1` · **arco inteiro** | 6 / 14 | **1** ⛔ | **acha defeito**: `A5.5` para ator externo ([#32](https://github.com/ThiagoPanini/panlabs-skills/issues/32)) |
| 5 | [Rede de farmácias · vista lógica](05-farmacias-logica/) | `L1` | ELK | `modelo@1` | 5 | **0** | o mais limpo do lote |
| 6 | [Secretaria · inventário 8 contas](06-educacao-inventario/) | `T5` | contas | `modelo@1` | 2 | **0** | qualidade de publicação |

*Falhas* conta as 62 checagens estáticas; o piso conhecido (`A1.2`, `A1.3`,
`A1.11`, mais `A1.5`/`A1.12` quando há nota presa a nó, `A7.2`, `A7.4`, `A3.9`,
`A4.5`, `A3.7`, `A5.7`) responde pela maioria delas em todo caso. *Semânticas* é
o que importa: são as quatro de **tolerância zero**, e é o que `--portao
veracidade` recusa.

## O que o lote provou

**Os sete gêneros e os três caminhos de layout rodam.** `L1`, `L2`, `T1`, `T3`,
`T4` e `T5` (nos dois modos, integração e inventário) saíram desenho. Os três
caminhos — `grade`, `elk`, `contas` — foram exercitados.

**O arco inteiro fecha em caso novo.** Os casos 3 e 4 rodaram os sete passos:
sabatina com fatos e procedência, três candidatas com tupla que não colapsa,
revisão de lacunas com achado consertado e achado recusado, aprovação com recorte,
elaboração técnica por delta, conferência byte a byte, e cópia publicada com a
deliberação podada.

**A guarda de aprovação funciona, e foi testada por acidente.** No caso 3, o delta
técnico trazia uma nota que também entra na vista lógica. O passo 6 saiu com
código 2: *"a elaboração técnica mudou o que foi aprovado. Isso exige aprovação
nova, não um desenho novo."* Foi um erro meu, e a skill pegou.

**Quatro defeitos, e três deles só o olho ou o caso novo achavam.** Estão nos
tickets [#30](https://github.com/ThiagoPanini/panlabs-skills/issues/30),
[#31](https://github.com/ThiagoPanini/panlabs-skills/issues/31) (**corrigido** —
ver `corpus.md` §14),
[#32](https://github.com/ThiagoPanini/panlabs-skills/issues/32) e
[#33](https://github.com/ThiagoPanini/panlabs-skills/issues/33). O
[#30](https://github.com/ThiagoPanini/panlabs-skills/issues/30) é o mais caro: a
grade recusa todo nó fora da VPC, e CDN + WAF na frente de VPC multi-AZ é a
arquitetura de referência mais copiada da AWS.

## Como reabrir qualquer um deles

Todo comando roda da raiz da skill (`skills/panlabs-aws-diagrams/`).

```bash
# um caso de modelo direto
node motor/gerar.cjs   ../../docs/aws-diagrams/casos/05-farmacias-logica/modelo.json --saida /tmp/x.drawio
node tools/check-geometria.cjs ../../docs/aws-diagrams/casos/05-farmacias-logica/modelo.json
node tools/revisar-lacunas.cjs ../../docs/aws-diagrams/casos/05-farmacias-logica/modelo.json

# um caso de arco inteiro
node tools/aprovar.cjs ../../docs/aws-diagrams/casos/03-silos/sessao-logica.json \
     --por "conselho da cooperativa" --em 2026-08-23 --saida /tmp/silos.drawio
node tools/retomar.cjs /tmp/silos.drawio --delta ../../docs/aws-diagrams/casos/03-silos/elaboracao.json
node sessao/publicar.cjs /tmp/silos.drawio --saida /tmp/silos.publicado.drawio
```
