# O portão prototipado do #93 — resgatado de um diretório temporário

Este material é o protótipo do [#93](https://github.com/ThiagoPanini/panlabs-skills/issues/93): as checagens que medem um `.html` autocontido sem abrir o browser, as que precisam abrir, um cliente CDP sem dependência de `npm`, e o checksum de sfnt. Ele **não é a suíte** — a suíte estática é o [#156](https://github.com/ThiagoPanini/panlabs-skills/issues/156) e a de render é o [#157](https://github.com/ThiagoPanini/panlabs-skills/issues/157). É o insumo dos dois.

Ele morava em `/home/paninit/.claude/jobs/86e0faa0/tmp/t93/`, um diretório temporário de job que **some sozinho quando o job é limpo**. O [#154](https://github.com/ThiagoPanini/panlabs-skills/issues/154) o tirou de lá porque era o único insumo da fila que podia desaparecer sem ninguém decidir nada.

`comment-93.md` é o laudo inteiro e é o que se lê primeiro: as onze checagens candidatas, as **cinco que morreram** — nenhuma por deixar defeito passar, todas por falso positivo contra trabalho legítimo do corpus real do #94 — e as que sobraram, com o estrago concreto que cada uma pega.

## O que veio

| arquivo | o que é |
|---|---|
| `comment-93.md` | o laudo: o que é medível, o que é ilusão de medida, e por que cinco candidatas foram reprovadas |
| `check-static.sh` | as checagens que leem o arquivo sem abrir browser — referência que sai da máquina, `@font-face` sem `data:`, esqueleto vazio |
| `sfnt.cjs` | o checksum por tabela de sfnt, 30 linhas e nenhuma biblioteca de fonte: pega base64 corrompido que **toda checagem sintática deixa passar** |
| `cdp.cjs` | o cliente CDP direto, sem `puppeteer` e sem `npm install` |
| `check-render.cjs` | o que só o render responde — a face que de fato pintou, texto invisível, colapso de escala |
| `check-drawing.cjs` · `check-bleed.cjs` | conector que aponta para o nada, rosca que não fecha, sangria |
| `probe-*.cjs` · `histogram.cjs` | as sondas que produziram os números do laudo |
| `build.py` | o gerador do corpus sintético: um deck canônico mais uma variante por defeito plantado |
| `drawings/` | a rosca que fecha e a que mente — as fixtures da checagem de coerência entre rótulo e dado |

## O que ficou para trás, e por quê

**`decks/` (6,1 MB).** São saída de `build.py`, regeneráveis por inteiro. Seis megabytes de bytes deriváveis não entram em git.

**`fonts/` (300 KB — `Anton-Regular.ttf`, `Barlow-Light.ttf`, `Barlow-ExtraBold.ttf`).** Duas razões. A primeira é que `Barlow` foi **superada**: o [#91](https://github.com/ThiagoPanini/panlabs-skills/issues/91) mediu doze candidatas depois disto e fixou `Source Sans 3`, então este corpus já nasce numa identidade que não é mais a vigente. A segunda é que `.ttf` versionado em git **é distribuição** de fonte, e distribuição sob OFL cobra aviso, cópia da licença e apontador para a Versão Original — a fatura que a árvore da skill paga em `skills/panlabs-presentation-builder/assets/fonts/NOTICE.md`, e que não vale a pena pagar de novo por um corpus superado.

**`planted/` (três `.html`, 340 KB) — e esta é a que importa.** As três fixtures de defeito plantado do render **não entram neste repositório em hipótese nenhuma**: elas foram geradas sobre o deck real do PDI e carregam a história de carreira do autor — cargos, datas, áreas e o nome dele. A premissa 15 do mapa existe exatamente para isto: **o repositório é público e o deck é material pessoal.** O critério do #154 fala da árvore da skill, mas a razão que ele dá é o repositório ser público, e a razão vale para o `workbench/` igual.

Elas foram para `~/panlabs-prototipos/t93-planted/`, que é durável e privado — o mesmo lugar onde moram os outros protótipos desta família. Saíram do temporário de job, que era o que o ticket cobrava, sem serem publicadas.

Quem for escrever o #157 não perde nada: plantar defeito de sangria, de colisão e de ícone preenchido é barato, e o alvo certo é **o motor de verdade** — o esqueleto congelado — e não um deck de 2025 numa identidade que o #91 já substituiu. Se ainda assim quiser olhar as originais, elas estão no caminho acima.

Note a assimetria de licença, que não é descuido: `.woff2`/`.ttf` versionado é **distribuição** de fonte e cobra aviso; um `.html` que **embute** a fonte em `data:` URI não é — é o que a OFL-FAQ 1.11 e 1.12 separam, e é a mesma razão pela qual o `.html` que a skill gera não carrega texto de licença nenhum.

Para regenerar o corpus: ponha as três `.ttf` do Google Fonts num `fonts/` ao lado e rode `python3 build.py`. Mas prefira não — o #156 e o #157 plantam defeito contra o **motor de verdade**, o esqueleto congelado em `skills/panlabs-presentation-builder/engine/skeleton.html`, e não contra este corpus.
