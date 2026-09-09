# As duas faces do tema

A identidade da `panlabs-docs` é escrita em **Inter** para tudo e **Paper Mono** para metadado, e as duas viajam **dentro** de cada deck construído: `compiler/fonts.py` lê o [`faces.json`](faces.json) ao lado, transforma cada `.woff2` num `data:` URI e escreve o `@font-face` na folha do tema. Nada aqui é buscado em tempo de instalação nem em tempo de construção, e a página que sai não faz uma requisição por causa de tipografia — que é a promessa inteira de um deck que abre com o cabo puxado.

**A origem é a docs, não o upstream.** Os dois arquivos saem de `static/fonts/Inter-Variable.woff2` e `static/fonts/PaperMono-Variable.woff2` da `panlabs-docs`, que já são os arquivos que o site auto-hospeda. Um deck no tema `panlabs` e uma página da documentação pintam com os mesmos contornos porque partem do mesmo binário, e não porque duas pessoas escolheram a mesma fonte no Google Fonts.

**O corte, e por que ele existe.** A Inter da docs pesa 175 020 bytes e a Paper Mono 39 836; embutidas inteiras, as duas custariam 286 KB de base64 em **todo** deck, e o base64 infla um terço sobre o arquivo cru. Cortadas ao repertório de `faces.json` custam 54 104 e 19 912 bytes — 98 KB de base64, um terço do preço. O repertório é fixo e não depende do deck: um subconjunto por deck tornaria a saída do compilador diferente a cada palavra trocada, e o `SKILL.md` promete que duas construções da mesma fonte não diferem em um byte.

**O repertório é a INTERSEÇÃO dos dois cmaps, e é por isso que ele é uma régua.** As 159 posições em `faces.json` são as que **as duas** faces carregam. O subsetter descarta em silêncio o que a fonte de origem não tem — a Inter da docs é um subconjunto `latin + latin-ext` e não traz `← → ≠ ≤ ≥ ✓`, embora traga `↑ ↓ −` —, então pedir um caractere e recebê-lo são coisas diferentes. Quem escrever `→` num slide receberia o substituto do sistema, sem aviso e sem rede para culpar; a régua `theme-repertoire` do laudo recusa a construção antes disso, e nomeia o caractere.

**Quatro caracteres ficam fora do repertório e mesmo assim são pintados** — os que o próprio palco imprime como mobília, listados em `stageOnly`. Eles não passam por régua nenhuma do laudo, porque não vêm de nenhum deck; a razão de cada um estar seguro é uma linha aqui, e um quinto aparecendo em `compiler/stage.html` reprova o verificador de fontes até alguém escrever a dele.

| | onde | por que está seguro |
|---|---|---|
| `←` `→` | os nomes das teclas no painel de ajuda | saem em `.keys dt`, que é `var(--font-mono)`, e a Paper Mono os carrega — a Inter da docs, cortada em `latin + latin-ext`, não |
| `⌫` | o mesmo painel, na tecla que volta | idem |
| `U+200A` | o fio de espaço entre o número da página e o total | é espaço, não tem tinta nenhuma: o que a face substituta fornece é o avanço, e mais nada |

**Os nomes são os que o upstream deu.** `Inter Variable` e `Paper Mono`, lidos do `name` ID 1 de cada binário e escritos assim no `@font-face` e nos tokens do tema. Nenhuma das duas declara Reserved Font Name — está lido dos bytes e registrado em [`OFL.txt`](OFL.txt) —, então renomear seria permitido; não é feito porque o nome é o que a régua `platform-font` do portão de render compara com o que de fato pintou, e três nomes iguais em três lugares é uma peça a menos para sair de sincronia.

**Refazer o corte** — quando a docs trocar um arquivo de fonte, ou quando o repertório precisar de um caractere novo. `pyftsubset` é ferramenta de desenvolvimento e não entra nesta árvore: o `.woff2` chega aqui pronto. Num ambiente virtual descartável, com `fonttools` e `brotli` instalados, o corte é `Subsetter` com `flavor="woff2"`, `name_IDs=["*"]`, `notdef_outline=True` e a lista de features abaixo, sobre os `unicodes` do repertório:

```
kern liga clig ccmp mark mkmk locl rlig calt tnum
cv02 cv03 cv04 cv11 ss01 ss02 ss03 zero case frac
salt dlig subs sups numr dnom
```

**A Paper Mono leva três caracteres a mais** — `← → ⌫`, os da tabela acima. Ela sai com 162 posições e a Inter com 159; a interseção continua sendo 159, que é o que `faces.json` publica como repertório e o que o laudo cobra de um deck.

**`cv02`, `cv03`, `cv04` e `cv11` são a identidade e não decoração**: são os alternates que a docs liga em `font-feature-settings` — o 4, o 6 e o 9 abertos e o `a` de um andar. Cortadas fora do subconjunto, a linha de CSS que as pede continua lá sem fazer nada, e o deck pinta uma Inter que não é a da casa.

Depois do corte, confira: `node workbench/panlabs-presentation-builder/tests/check-fonts.cjs` relê os cmaps dos dois binários, cobra a interseção contra o `faces.json`, cobra o corpus contra a interseção e relê o nome reservado.
