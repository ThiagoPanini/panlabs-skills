# O deck do PDI, destilado — o material de referência de `panlabs-presentation-builder`

A identidade que a skill `panlabs-presentation-builder` reproduz foi medida num `.pptx` de 108 slides. Este diretório é o que sobra dele quando você tira o que não cabe num repositório e o que não é seu para publicar: **1,6 MB** que respondem, sem o `.pptx` e sem a sessão que o abriu, as duas perguntas que todo ticket do [mapa #90](https://github.com/ThiagoPanini/panlabs-skills/issues/90) faz — *como era o slide original deste arquétipo?* e *que valor exato a identidade usa aqui?*

O original tem 79 MB e é `gitignore`d em `tmp/`. Nada aqui depende dele para ser **lido**; tudo aqui depende dele para ser **regerado** — e a diferença importa, porque é a única coisa neste diretório que ainda pode se perder. Ver [Regerar](#regerar).

## A fronteira do material — leia antes de citar um número de slide

Os 108 slides não são um corpo só, e tratá-los como um corpo produz medição errada. A primeira leitura da identidade fez exatamente isso e creditou 11,5% dos caracteres a `Arial`, uma fonte com **zero caractere** nos slides do autor.

| faixa | o que é | serve para |
|---|---|---|
| **1–49** | **autorais** — o deck que o autor escreveu | tudo. É a identidade |
| **50–84** | arquétipos do template Slidesgo, na mesma identidade escura, com conteúdo *lorem* | nada, hoje. Não está aqui — ver [O que não está aqui](#o-que-não-está-aqui) |
| **85–108** | páginas meta do Slidesgo em azul-marinho `#0d2440` | nada. Fora da identidade |

A faixa é **re-derivada a cada build**, não copiada: `tools/build_reference.py` varre os 108 slides atrás da assinatura do template (*Mercury*, *Venus*, *Saturn*, *slidesgo*, *lorem*…) e imprime o resultado antes de escrever qualquer arquivo. Na última execução: **0 de 49** slides autorais com assinatura, **17 de 35** na faixa Slidesgo escura, **5 de 24** na meta — e a primeira assinatura aparece no slide **56**. Se um dia esses números mudarem, a fronteira mudou e este README está errado.

Uma correção ao que o mapa registra: **83 e 84 já são páginas meta** (`ALTERNATIVE RESOURCES`, `RESOURCES`), não arquétipos. A fronteira útil da faixa do meio termina antes deles.

## O que está aqui

| arquivo | o que é |
|---|---|
| `slides/slide-NN.webp` | **37 dos 49 slides autorais**, 1600×900, WebP *lossless* — pixel idêntico ao que o PowerPoint exportou, com as regiões fotográficas redigidas |
| `slides.json` | o **esqueleto dos 49**, inclusive os 12 que não têm imagem aqui: caixa, papel, geometria, corpo em pt e contagem de caracteres. Nenhuma letra de texto |
| `runs.json` | os **1 140 runs com texto**, com a cadeia de herança de fonte já resolvida (`run → pPr → lstStyle → placeholder do layout → master → txStyles → fontScheme`). Nenhuma letra de texto — só o que ela mede |
| `tokens.json` | cor, fonte, escala, grade, traço e sombra, cada um derivado do OOXML nesta execução |
| `tokens.css` | o subconjunto que uma folha de estilo consome direto, como custom properties |
| `texture/texture-{a,b,c}.svg` | os **três motivos** da textura topográfica, em 38 KB de SVG |
| `tools/` | os programas que produziram tudo acima, o que exporta os PNGs do PowerPoint, e o que **confere** se o corpus é o que este README diz |

### Conferir em vez de acreditar

O argumento inteiro para pôr isto num repositório público é que a redação funciona. `tools/verify_redaction.py` é o que permite checar em vez de tomar a minha palavra:

```bash
python3 tools/verify_redaction.py .                       # as três que só precisam do corpus
python3 tools/verify_redaction.py . /caminho/dos/PNGs     # as cinco
```

Na última execução, as cinco verdes:

```
. nenhum slide retido virou arquivo -- 12 retidos, 37 publicados, soma 49
. todo slide é 1600x900
. nem slides.json nem runs.json têm campo de texto
. fora da redação, o WebP é idêntico ao PNG do PowerPoint -- maior diferença de canal = 0
. dentro do bloco, nada do original sobrevive -- 37 slides varridos
```

A quarta é a que vale mais: **maior diferença de canal = 0** diz que, fora dos blocos, o WebP é o pixel exato que o PowerPoint escreveu. Não é aproximação nem "visualmente igual" — é o mesmo byte, e é por isso que uma prova de fidelidade lado a lado ([#96](https://github.com/ThiagoPanini/panlabs-skills/issues/96)) pode usar estes arquivos como original.

**Nada aqui é transcrito.** Todo número em `tokens.json` sai do OOXML na execução que o escreveu. Token copiado de um ticket é uma segunda cópia de uma medição, e a cópia é a que envelhece sem ninguém perceber — que é o mesmo argumento pelo qual `scripts/check-skills.sh --list` é a lista das regras e nenhum documento guarda outra.

### As duas redações, e por que elas existem

Este repositório é **público**. O deck é o plano de desenvolvimento individual do autor: carrega o rosto dele, o rosto e o nome de colegas, a escada de promoções dentro de um empregador nomeado. Duas redações, ambas declaradas em `tools/build_reference.py` num lugar só, para que a próxima sessão possa alargá-las ou apertá-las editando um dicionário e rodando de novo.

**1. Toda região fotográfica vira bloco hachurado.** O corpus precisa da posição e do tamanho do painel, não do conteúdo dele — e a **premissa 3 do mapa tira fotografia do v1 inteiro**, então um bloco chapado é referência *mais* fiel ao que a skill vai construir do que a foto seria. O bloco é desenhado visivelmente como redação, com etiqueta, para ninguém o confundir com um elemento de desenho do deck.

Foto se distingue de ícone pela fração da largura que ocupa, e o vão é largo: nos 49 autorais o **ícone mais largo mede 0,0764** e a **foto mais estreita, 0,2172**. O limiar está em 0,15, no meio do vão, e o build imprime os dois extremos a cada execução — se eles se aproximarem, o critério parou de valer.

**2. Um slide cujo texto carrega fato interno de emprego não entra.** Um raster não se redige no nível do run. São 12 slides, e eles continuam contribuindo o esqueleto em `slides.json` e os runs em `runs.json`, que não têm texto.

| slide | por que ficou de fora |
|---|---|
| 6, 7, 8 | histórico de promoções e bonificações |
| 9 | escada de promoções com códigos internos de posição |
| 25–30 | nomes de iniciativas internas |
| 33 | KR citando unidade organizacional interna |
| 49 | organograma com nome, foto e cargo de terceiros |

**O que essa retenção custa, dito sem maquiagem.** Os slides 24→30 são o painel mensal com abas `JAN`…`DEZ` e um *segmented control* — o "estado de aba dentro do slide" que o mapa lista em *Não especificado ainda*. O estado **vazio** dele sobrevive no slide 24; os seis estados **preenchidos**, não. Se #98 decidir que o arquétipo de aba entra no v1, o caminho é [regerar](#regerar) local, não este diretório.

## O que não está aqui

**Os 35 slides da faixa Slidesgo escura (50–84).** São 4,1 MB de páginas de template com conteúdo *lorem*, e não são a identidade — a premissa 5 do mapa diz que o que a identidade fixa vem dos autorais. Um catálogo de layouts do Slidesgo dentro da árvore convida a skill a copiar a forma do Slidesgo, que é exatamente o que a leitura do `slideless` recomendou recusar. Regeráveis, se #98 pedir.

**O `.pptx` e os 71 MB de mídia dele.** O arquivo tem 79 MB — 2,5× o teto de 30 MB que `scripts/checks/weight.sh` cobra, e `.gitignore` não protege, porque o empacotador oficial também não o lê. Ele não sobe para um *release* deste repositório por uma razão que não é tamanho: **o repositório é público, e um release é público**.

**Nome semântico para os hexes de acento.** `tokens.css` nomeia os **quatro papéis de superfície** que a premissa 5 fixa — `--pdi-surface`, `--pdi-ink`, `--pdi-card`, `--pdi-ink-pure` — e o build **falha** se o deck deixar de carregar qualquer um deles, porque aí a premissa parou de descrever o material. Os acentos saem como hex cru de propósito: [#100](https://github.com/ThiagoPanini/panlabs-skills/issues/100) mediu os cinco, reprovou quatro por contraste ou separação, recomendou trocá-los, e **essa recomendação espera o olhar do dono**. Batizar `#7634D2` de `--pdi-analytics` aqui seria decidir isso por baixo.

## Regerar

Tudo neste diretório sai de dois insumos: o `.pptx` descompactado e os PNGs que o PowerPoint exporta.

```bash
# 1. os PNGs, via COM do PowerPoint no Windows -- ver o cabeçalho do script,
#    que explica por que WSL precisa copiar o arquivo para um caminho do Windows.
powershell.exe -File "$(wslpath -w tools/export_slides.ps1)" \
  -Source 'C:\...\pdi.pptx' -Out 'C:\...\pdiexport'

# 2. descompactar o .pptx (é um zip)
unzip -q pdi.pptx -d /tmp/pdi-ooxml

# 3. o corpus
python3 tools/build_reference.py /tmp/pdi-ooxml /caminho/dos/PNGs .
python3 tools/extract_texture.py /tmp/pdi-ooxml ./texture
```

`build_reference.py` depende só de Pillow e da biblioteca padrão; `extract_texture.py`, só da padrão. Nenhum dos dois lê arquivo que uma sessão passada tenha deixado por aí — a cadeia de herança de fonte é resolvida ali dentro, não carregada de um `runs.json` anterior.

**LibreOffice não serve para o passo 1.** Ele substitui as duas fontes corporativas que carregam 82,5% dos caracteres, e aí o render mede uma fonte que ninguém tem — que é precisamente o defeito que este corpus existe para não cometer.

**Alargar as redações** é editar `WITHHELD` (o dicionário de slides retidos) ou `PHOTO_MIN_W` em `tools/build_reference.py`, e rodar de novo. As duas listas estão no topo do arquivo, juntas, por isso.

## Conferência contra o mapa

O build reproduz os números que o [mapa #90](https://github.com/ThiagoPanini/panlabs-skills/issues/90) registra, o que é a prova de que a cadeia de herança portada para cá é a mesma que os mediu:

| medida | mapa | este build |
|---|---|---|
| runs com texto visível | 1 140 | **1 140**, zero sem fonte resolvida |
| corpo `Itau Display Pro Light` | 75,1% | **75,1%** |
| ênfase `Itau Display Black` | 7,4% | **7,4%** |
| numeral de seção | 33,3% da altura | **33,33%** (135 pt) |
| H1 herói · H1 canônico · H2 · H3 | 11,9 · 8,9 · 6,9 · 5,9% | **11,90 · 8,89 · 6,91 · 5,93%** |
| margem simétrica | 7,874% / 92,126% | **7,874%** (34 formas) / **92,126%** (25) |
| traço universal | 0,75 pt | **0,75 pt**, 135 formas |
| sombra | `0 1.5pt 4.5pt` α .32, variante .50 | **idêntica**, 81 e 12 formas |
| motivos da textura | 3, em 18 colocações | **3, em 18 colocações** (21, 25 e 37 traços) |

Duas diferenças que **não** são divergência, e que vão confundir quem comparar sem ler isto:

- **Contagem de formas na grade.** O mapa diz 125 formas na margem esquerda; aqui são 34. O mapa contou os 108 slides e toda profundidade de aninhamento; este build conta **só os autorais e só formas de primeiro nível**. Forma dentro de `<p:grpSp>` tem coordenada no espaço do grupo, não no do slide — lê-la como fração do slide é o que transforma a margem real num histograma de ruído.
- **Anton.** O mapa diz 13,8%; aqui, 11,8%. O mapa mediu por run; este build mede por caractere sobre os autorais.
