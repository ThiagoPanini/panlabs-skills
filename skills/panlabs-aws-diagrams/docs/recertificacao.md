# A recertificação do #23 — o que a união mediu

Registro da consolidação pedida pelo
[#23 · A árvore de produção: um motor só, recertificado](https://github.com/ThiagoPanini/panlabs-skills/issues/23).

O ticket nasceu de uma frase: *"as duas suítes estão verdes, cada uma contra o seu
próprio motor; ninguém rodou a união"*. Este documento é o que a união disse.

---

## 1. A escolha do motor, por medição

O ticket registra a hipótese e não a compra: *"o provável é o do #13 — é o mais
novo, é o mais rico"*. **A medição derruba a hipótese**, e o motivo é de
genealogia: `q13/motor` não é o motor mais novo, é um **fork do motor do #11
tirado em `daf4bc4`**, antes de o #12 existir. O que ele tem a mais é a camada de
tema; o que ele não tem é multi-conta inteiro.

`tools/medir-antes-depois.cjs` e o script de medição rodaram a **união dos checks
dos quatro protótipos** (25 checagens do #11, #12, #14 e #18) contra os dois
candidatos, cada um posto no lugar do outro:

| candidato | vermelhos | onde |
|---|---|---|
| **motor do #11** (com #12 e #22) | **3 de 25** | os três na camada de sessão do #14 — o manifesto (vermelho por construção) e duas checagens caindo pela **mesma** causa: `selar espera uma pagina, veio 4` |
| motor do #13 (com o tema) | **8 de 25** | o #12 inteiro: o esquema recusa `ou`/`habilita`, `derivar` não tem `obter`, a travessia não roda, o determinismo não roda, mais o manifesto |

E o tamanho dos dois deltas a partir do ancestral comum (`q11/motor@daf4bc4`)
confirma a direção do enxerto:

| arquivo | delta do **tema** (#13) | delta do **multi-conta** (#12) |
|---|---|---|
| `derivar.cjs` | 0 | 296 |
| `dispor.cjs` | 109 | 600 |
| `emitir.cjs` | 0 | 49 |
| `gerar.cjs` | 62 | 102 |
| `planejar.cjs` | 156 | 555 |
| `resolver.cjs` | 78 | 0 |
| `validar.cjs` | 14 | 16 |
| `esquema.json` | 1 | 13 |
| **total** | **420** | **1631** |

> **Decisão.** O motor do #11/#12/#22 é o **tronco**; a camada de tema do #13 foi
> **enxertada** nele. Não é "escolher um e jogar o outro fora" — é enxertar o
> delta menor no tronco maior, que é 4× a decisão contrária em linhas e a única
> das duas que não exige rederivar nada.
>
> Três arquivos saíram inteiros de um lado só, e isso não é sorte: `derivar.cjs`
> e `emitir.cjs` o tema **não tocou** (0 linhas), e `resolver.cjs` o #12 **não
> tocou** (0 linhas). O enxerto de verdade foi em `dispor`, `planejar`, `gerar`,
> `validar` e no esquema.

---

## 2. O que a união achou — e não teria achado separada

Sete achados. Nenhum deles é acusável a uma das metades: **todos só aparecem
quando as duas rodam juntas**.

### 2.1 `selar` morria com 1+N páginas — e derrubava a sessão inteira

O #14 mediu contra um motor em que `gerar` = uma página. O #12 acrescentou a
decomposição estrutural do `D2` (consolidada + uma por conta), e a vista técnica
de um modelo multi-conta passou a ser 1+N páginas de uma chamada só. `selar`
lançava `selar espera uma pagina, veio 4` e a sessão 2 morria.

Correção em `sessao/gravar.cjs`: sela **todas** as páginas, uma cópia do selo por
página — que é literalmente o que o #14 já tinha decidido, e que a implementação
só sabia fazer para N=1. `costurar` também: a regex gulosa juntava as N páginas
de uma execução num pedaço só.

### 2.2 A impressão de aparência media serialização, não ordem z

Consequência da anterior. `impressaoDeAparencia` guardava o **índice na lista
plana** como `ordemZ`. No mxGraph, z-order é a ordem dos filhos **dentro do pai**.
Enquanto o motor tinha um caminho só os dois números andavam juntos; com o
caminho multi-conta o motor emite por blocos e o codec do próprio draw.io
reescreve em profundidade.

**Medido:** abrir e salvar a vista técnica de três contas troca **22 posições na
lista plana e ZERO na ordem de irmãos**, nos **7 pais**. Com o índice absoluto,
um arquivo que ninguém tocou lia como `remanejado` — a skill avisando "regerar
apaga o seu ajuste" sobre um ajuste que não existe.

Corrigido para posição entre irmãos. O caso de controle continua guardado
(`check-impressao.cjs` move uma célula entre irmãos e exige `remanejado`), e o
esquema adotado voltou aos **10/10** que o #14 tinha medido.

### 2.3 Os quatro estilos do #12 sumiriam no deck escuro

`planejar.cjs` do #12 trazia quatro estilos escritos à mão — rótulo de OU,
barramento, stub e habilitador de permissão — com hex dentro. No branco não
custava nada. Medido no deck escuro do #13:

| estilo | literal do #12 | contra `#1C1C1C` | por token |
|---|---|---|---|
| `S_OU` | `#232F3E` | **1,26:1** | `#FFFFFF` — 17,04:1 |
| `S_BARRAMENTO` | `#232F3E` | **1,26:1** | `#EDEDED` — 14,56:1 |
| `S_STUB` | `#232F3E` | **1,26:1** | `#EDEDED` — 14,56:1 |
| `S_HABILITA` | `#5A6C86` | 3,18:1 | `#B4B4B4` — 8,22:1 |

E o achado de brinde é o que torna a troca barata: **no tema `claro` os quatro
literais reconstroem token a token**. `#232F3E` é `tinta.forte` e `aresta.cor`;
`#5A6C86` é `tinta.fraca`; `#FFFFFF` é `tinta.halo`; `13 pt` é `texto.grupo + 1`;
`1.6` é `aresta.espessura`. O #12 já estava usando os tokens do #13 — escrevendo
os valores deles à mão. `tests/check-tokens-do-12.cjs` mede, chave por chave; o
único acréscimo é `fontFamily`, que é token de verdade.

### 2.4 `A4.1` media o motor contra ele mesmo

O limiar `paddingDeGrupo` do validador (#18) valia **12 px** — o mesmo `PAD = 12`
que o motor do #11 usava. Nesse regime a checagem não media nada: o motor passava
porque o número tinha saído dele.

Com a grade base 8 do tema, a medição fica sem margem: com limiar 12, `A4.1`
acusa **77 ocorrências em 14 dos 15 modelos**, e **todas reportam exatamente 8
px**; com limiar 8, acusa **zero**. Nenhuma é contenção defeituosa.

Calibrado para 8, com o `porque` escrito — que era o campo que o próprio #18
deixou vazio como pedido de medição. E 8 não foi escolhido para o teste passar:
`passoDaGrade` e `folgaEntreCaixas` **já valiam 8** na mesma tabela. Os três
números passam a concordar em vez de um contradizer os outros dois.

### 2.5 `E8` proibia uma família inteira para dizer uma coisa

`check-travessia.cjs` do #12 reprovava `jumpStyle` junto com losango e porta. O
`E8` do #6 fala de **marcador na fronteira da conta**; `jumpStyle` no mxGraph é o
salto que uma aresta dá ao cruzar **outra aresta**. Enquanto o motor nunca emitia
`jumpStyle`, proibir a família era o jeito barato de escrever "sem cerimônia". O
tema tem `aresta.saltos` com default `arc`, e a regra larga passou a reprovar o
que o `E8` não proíbe.

Estreitada para o que o `E8` diz. Afrouxar o token seria obedecer ao teste.

### 2.6 O tema repintava um ícone monocromático por um dígito

`A2.3` (cor de ícone não alterada) pegou: o catálogo entrega `Users` com
`#232F3D` e a constante `NORMATIVO.claro.mono` diz `#232F3E`. Na tela é a mesma
tinta; na checagem é o tema alterando cor de ícone.

A correção é o que o #13 já queria dizer: **o tema inverte, não reafirma**. No
deck claro o catálogo já é a variante clara, e o `fillColor` fica intocado. Só o
deck escuro inverte.

> **Fica aberto, e é da rubrica, não daqui:** no deck **escuro** o `A2.3`
> continua acusando, e está certo — a inversão monocromática é exatamente
> "alterar a cor do ícone". A AWS publica dois decks e o draw.io entrega uma
> variante só; a checagem foi escrita sem esse caso. Resolver é decisão do #8.

### 2.7 A bisseção não sabia ficar vermelha

`bissecar-modelo.cjs` saía 0 sempre — era ferramenta de diagnóstico lida à mão.
Dentro de uma suíte é um verde que não afirma nada, e o `render.sh` que ela chama
nem estava na árvore, então **todos** os recortes "falhavam" e a suíte seguia.
Agora sai 1 quando acha, e distingue "o motor recusou" de "render pulado por não
haver draw.io".

---

## 3. As correções do mapa

O ticket pede que toda conclusão geométrica que não sobreviver esteja registrada.
São três, e todas são de **identidade byte a byte**.

### 3.1 ⛔ `web-multi-az` **não** sai mais byte a byte idêntico (#12)

Morreu, e não por acidente: a árvore de produção carrega a grade base 8 do #13, e
o próprio #13 mediu que **dez tokens de métrica movem coordenada**. Medido:

| | motor do #11 | produção |
|---|---|---|
| células com geometria | 21 | 21 |
| **que mudaram de posição** | — | **20** |
| página | 542×904 | 528×877 |
| bytes | 15 398 | 17 162 |

A conclusão do #12 que **sobrevive** é a que interessava: sem passo numerado, a
AZ fica com a coluna. `check-determinismo.cjs`, `check-gatilhos.cjs` e
`check-travessia.cjs` continuam verdes contra a árvore nova.

### 3.2 ⛔ "o motor do #11 não mudou um byte" (#14)

Morreu — e já estava morta em `main` **antes** deste ticket: o #22 registrou o
mesmo na resolução dele. O que o manifesto media (os bytes do #11 congelados) não
descreve mais nada.

O **mecanismo** sobrevive e continua útil: `tests/check-motor-intocado.cjs`
congela agora os **12 arquivos do motor de produção**, para que a próxima mudança
nele seja deliberada em vez de descoberta.

E a **tese** do #14 sobrevive intacta, agora testada de verdade: servir as duas
vistas continua sendo problema de projeção e não de motor — `check-projecao.cjs`
passa 12/12 contra um motor que cresceu com o #12, o #13 e o #22.

### 3.3 ✅ O que **sobreviveu** à recertificação

Vale registrar tanto quanto o que caiu:

- **`projetar(técnico, 'lógica') == o aprovado`** — 12/12, com as 12 mutações de
  controle.
- **`AINDA LE COMO INTACTO` depois de o app reescrever** — nas **5** páginas,
  depois da correção 2.2.
- **Nenhuma falha semântica nova.** `tools/medir-antes-depois.cjs` roda os 15
  modelos nos dois motores: **0 modelos em que a lista de falhas semânticas
  mudou**. O enxerto não fez nenhum desenho passar a mentir, nem deixou de
  mentir.
- **13 de 13 modelos perderam uma falha `A7.1`** — o tema sobrescreve o
  `fontColor` cinza `#AAB7B8` que o catálogo entrega no rótulo do VPC e que o #13
  já tinha condenado por 2,06:1. Confirmado no pixel.

---

## 4. O que a recertificação **não** consertou

Duas dívidas, com endereço:

| achado | onde | dono |
|---|---|---|
| `A5.5` ×2 em `web-fluxo-3-az` — duas arestas de gravação atravessam o grupo `app-a`, de onde não saem nem para onde vão. **É semântica**, e é **anterior**: idêntica nos dois motores (`falha=9, A5.5×2` nos dois). Ninguém tinha rodado o validador do #18 contra os modelos do #12. | `tests/check-bons.cjs`, quarentena nomeada | [#24](https://github.com/ThiagoPanini/panlabs-skills/issues/24) |
| `A6.1` em `plataforma-3-contas` — duas arestas saem de `ecs` a 0° uma da outra. Não é semântica. Entrou com a escala nova. | reportado, não trava | [#24](https://github.com/ThiagoPanini/panlabs-skills/issues/24) |

A quarentena é **exata**: o modelo tem de acusar precisamente `A5.5×2`. Uma falha
semântica nova quebra a suíte igual, e quando o #24 consertar a suíte quebra
também — dizendo que a entrada saiu de validade. Quarentena que não sabe expirar
vira desculpa permanente.

E uma divergência que fica **registrada, não resolvida**: o portão de contraste
(`motor/contraste.cjs`) separa **traço** (reprova) de **área** (avisa) desde o
retorno do #13; o validador geométrico (`validador/familias/a7-acessibilidade.cjs`)
ainda trata o quadrado do ícone como traço e reprova em `A7.2`. As duas leituras
convivem na árvore. Resolver é mexer no modelo de severidade da rubrica, o que é
decisão do #8 — o #18 já tinha registrado a mesma fronteira ao pôr o `F1` fora
das 62.

---

## 5. A privacidade do dossiê

O ⚠️ que o mapa carregava sem veredito. Decisão e razão em
[`sessao/publicar.cjs`](../sessao/publicar.cjs); em uma frase:

> **O arquivo que retoma e o arquivo que circula não são o mesmo arquivo.**
> `desenhar` continua gravando o dossiê inteiro — é o arquivo de trabalho.
> `publicar` produz a cópia que sai da casa, sem a deliberação, e o selo dela
> **diz que não retoma**.

A régua: **sai o que é sobre pessoas e sobre caminhos não tomados; fica o que é
sobre a arquitetura desenhada.** Saem as candidatas descartadas, o motivo das
recusas, o estacionamento (que é fala de reunião, com aspas), a procedência
citada dos fatos, quem aprovou e o recorte aprovado. Ficam o modelo, os eixos, a
candidata escolhida, o *que* foi achado, e as impressões — que são o que prova
que o PNG é este arquivo.

Medido em `tests/check-dossie.cjs`, **nos bytes** e não no objeto: frases
plantadas em cada campo, com o controle na outra ponta (as mesmas frases **têm**
de estar no arquivo de trabalho). No `varejo` de três contas a cópia sai com
118 117 bytes contra 151 762.

E um aviso de uma linha, no padrão que o #16 fixou — avisa, nunca bloqueia,
nomeia a saída — sempre que a sessão selada carregar deliberação.

---

## 6. Como rodar

```bash
cd skills/panlabs-aws-diagrams
./tests/rodar.sh                       # a união, 8 camadas
node tools/medir-antes-depois.cjs      # o mesmo modelo nos dois motores
node motor/gerar.cjs modelo/web-multi-az.json --saida saida/x.drawio
node sessao/publicar.cjs saida/varejo.drawio
```

A camada 7 precisa do draw.io headless (#9/#10) e é **dependência de
desenvolvimento** (premissa 8): sem o binário, avisa e segue.
