# Fontes — procedência, transformação e licença

Os quatro `.woff2` deste diretório são **obras derivadas** de fontes livres, sob **SIL Open Font License 1.1**. Este arquivo é o que a cláusula 2 da OFL e a FAQ 2.8 pedem de quem **distribui**: o aviso de copyright, o apontador de volta para a Versão Original, e o que exatamente foi transformado.

Versionar estes arquivos em git **é distribuição**, e por isso as condições valem aqui por inteiro — o que não é o caso do `.html` gerado, onde a fonte viaja embutida em `data:` URI e a FAQ 1.11/1.12 classifica o caso como *embedding*, que não exige nada. Mesmo assim o esqueleto abre com o aviso de copyright, porque 400 bytes fazem a discussão inteira parar de importar.

## Por arquivo

| arquivo | Versão Original | versão | transformação | nome novo |
|---|---|---|---|---|
| `display.woff2` | [Anton](https://github.com/googlefonts/AntonFont) | 2.116 | corte de repertório · conversão para woff2 · renomeação | `Panlabs Display` |
| `body-light.woff2` | [Source Sans 3](https://github.com/adobe-fonts/source-sans) | 3.052 | instância do eixo `wght` em **320** · corte de repertório · woff2 · renomeação | `Panlabs Body` 300 |
| `body-black.woff2` | [Source Sans 3](https://github.com/adobe-fonts/source-sans) | 3.052 | instância do eixo `wght` em **900** · corte de repertório · woff2 · renomeação | `Panlabs Body` 900 |
| `hand.woff2` | [Architects Daughter](https://github.com/kimberlygeswein/architects-daughter) | 1.003 | corte de repertório · conversão para woff2 · renomeação | `Panlabs Hand` |

O corte é para os 149 caracteres que o português exige — acentos, `ç`, aspas curvas, travessão e reticências.

Dentro de cada binário os `name` IDs **0** (copyright), **13** (texto da licença) e **14** (URL) foram **preservados intactos**. O texto integral das três licenças está ao lado, em `OFL-Anton.txt`, `OFL-SourceSans3.txt` e `OFL-ArchitectsDaughter.txt`.

## Por que renomeadas

`Source Sans 3` declara **Reserved Font Name** — *"Copyright 2010–2020 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'"*. A cláusula 3 da OFL proíbe uma Versão Modificada de usar o nome reservado, e a FAQ 2.6 é explícita em que **subsetar é modificar**: *"Removing any parts of the font when delivering a webfont to a browser, including unused glyphs and smart font code, is considered modification."* Instanciamos o eixo variável e cortamos o `cmap`, então a saída da FAQ 2.2.1 (WOFF que não conta como modificação) não se aplica.

Anton e Architects Daughter **não declaram nome reservado** e não precisariam ser renomeadas. Foram, por uniformidade — uma regra em vez de uma tabela de exceção — e porque um `@font-face` chamado `Anton` que falhe ao carregar cai em silêncio numa `Anton` instalada no sistema, enquanto um nome próprio falha alto.

## Duas ressalvas

**Estes quatro arquivos não estão sob a licença do repositório.** A cláusula 5 da OFL exige que o Font Software seja distribuído inteiramente sob a OFL e sob nenhuma outra licença. Quando a raiz do repositório ganhar um `LICENSE`, ele não pode parecer engolir este diretório.

**Nada aqui é endosso.** Dizer que estas fontes derivam de Anton, de Source Sans 3 da Adobe e de Architects Daughter de Kimberly Geswein é reconhecimento, e a cláusula 4 o permite. Sugerir aval de qualquer um deles, não — e não há nenhum.
