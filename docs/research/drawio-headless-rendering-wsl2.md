# Render headless do draw.io no WSL2

> Pesquisa executada em 2026-08-21 contra fontes primárias (`jgraph/drawio-desktop` v31.3.1,
> `rlespinasse/docker-drawio-desktop-headless`, `jgraph/draw-image-export2`, registry do npm)
> **e verificada por execução real neste ambiente**. Todos os comandos e outputs abaixo foram
> de fato rodados; nada é citado de documentação sem teste.

---

## TL;DR

**Funciona.** O caminho 1 (`drawio-desktop` extraído + `xvfb-run`) roda perfeitamente neste
WSL2 e renderiza os stencils `mxgraph.aws4.*` com **fidelidade total** — o glifo λ da Lambda,
o balde do S3 e o ícone de nuvem do grupo VPC aparecem corretamente.

Comando verificado:

```bash
xvfb-run -a /home/paninit/.local/opt/drawio/squashfs-root/drawio \
  -x -f png -o saida.png entrada.drawio \
  --no-sandbox --disable-gpu --disable-update
```

- **Tempo:** ~3,0 s por diagrama (~2,4 s/arquivo em modo batch de pasta)
- **RAM:** ~280 MB RSS
- **Exit code:** 0 em sucesso, 1 em erro (confiável para scripting)
- **Docker:** indisponível neste ambiente (daemon não está rodando, sem sudo sem senha)
- **npm `@drawio/export`:** **não existe** — o pacote nunca foi publicado
- **Renderizador independente de `.drawio`:** **não existe** nenhum que seja fiel

---

## Ambiente verificado

```console
$ uname -a
Linux alienware-x14 6.6.87.2-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC Thu Jun  5 18:30:46 UTC 2025 x86_64 GNU/Linux

$ whoami; id
paninit
uid=1000(paninit) gid=1000(paninit) groups=...,27(sudo),...,1001(docker)

$ which drawio            # NÃO existe
$ which chromium google-chrome   # NÃO existem
$ which xvfb-run
/usr/bin/xvfb-run
$ node --version
v24.18.0
$ python3 --version
Python 3.12.3
$ df -h /home
/dev/sdd  1007G  53G  904G  6% /
```

Fontes disponíveis (importa para fidelidade de texto): **143 fontes**, incluindo
`Liberation Sans`. O draw.io usa `Helvetica` como default, e `fc-match Helvetica`
resolve para `LiberationSans-Regular.ttf` — metricamente compatível. Texto renderiza correto.

---

## Caminho 1 — `drawio-desktop` extraído + `xvfb-run` — ✅ **FUNCIONA**

### Passo 1: descobrir a release mais recente

```bash
curl -sL "https://api.github.com/repos/jgraph/drawio-desktop/releases/latest" -o /tmp/drawio_latest.json
python3 -c "
import json
d=json.load(open('/tmp/drawio_latest.json'))
print('tag:', d.get('tag_name'), '| publicado:', d.get('published_at'))
for a in d.get('assets',[]):
    if 'x86_64' in a['name'] or 'amd64' in a['name']:
        print(f\"{a['name']:44s} {a['size']/1024/1024:7.1f} MB\")
"
```

Output real:

```
tag: v31.3.1 | publicado: 2026-08-21T07:49:15Z
drawio-amd64-31.3.1.deb                          127.7 MB
drawio-x86_64-31.3.1.AppImage                    161.0 MB
drawio-x86_64-31.3.1.rpm                         111.7 MB
```

### Passo 2a: variante AppImage (a pedida — testada e funcionando)

```bash
mkdir -p /home/paninit/.local/opt/drawio-dl
cd /home/paninit/.local/opt/drawio-dl
curl -fL --retry 3 -o drawio-x86_64-31.3.1.AppImage \
  "https://github.com/jgraph/drawio-desktop/releases/download/v31.3.1/drawio-x86_64-31.3.1.AppImage"
```

Output real: `1:10.58 total` (~70 s a ~2,3 MB/s).

```console
$ stat -c '%s bytes' drawio-x86_64-31.3.1.AppImage
168797606 bytes
$ sha256sum drawio-x86_64-31.3.1.AppImage
407f03edcec02916d02feb38e60d66c76ebe27de8915d646a365e6a22f69a9bb  drawio-x86_64-31.3.1.AppImage
```

**A pegadinha do FUSE se confirmou.** Rodar o AppImage direto falha:

```console
$ chmod +x drawio-x86_64-31.3.1.AppImage
$ ./drawio-x86_64-31.3.1.AppImage --version
dlopen(): error loading libfuse.so.2

AppImages require FUSE to run.
You might still be able to extract the contents of this AppImage
if you run it with the --appimage-extract option.
See https://github.com/AppImage/AppImageKit/wiki/FUSE
for more information
```

Nota sutil: `/dev/fuse` **existe** e `/usr/bin/fusermount3` **existe** neste WSL2.
O que falta é especificamente a **libfuse2** (`libfuse.so.2`) — só a libfuse3 está instalada.
Ou seja, não adianta olhar para `/dev/fuse` para prever se vai funcionar.

Extração (contorna o FUSE, não precisa de root):

```bash
mkdir -p /home/paninit/.local/opt/drawio
cd /home/paninit/.local/opt/drawio
/home/paninit/.local/opt/drawio-dl/drawio-x86_64-31.3.1.AppImage --appimage-extract
```

Output real: `3.314 total` (3,3 s), 127 entradas extraídas, exit 0.

```console
$ du -sh /home/paninit/.local/opt/drawio/squashfs-root
448M    /home/paninit/.local/opt/drawio/squashfs-root
```

**Binário resultante:** `/home/paninit/.local/opt/drawio/squashfs-root/drawio` (216 MB, ELF x86-64)

### Passo 2b: variante `.deb` (alternativa mais enxuta — também testada)

```bash
cd /home/paninit/.local/opt/drawio-dl
curl -fL --retry 3 -o drawio-amd64-31.3.1.deb \
  "https://github.com/jgraph/drawio-desktop/releases/download/v31.3.1/drawio-amd64-31.3.1.deb"
mkdir -p /home/paninit/.local/opt/drawio-deb
dpkg-deb -x drawio-amd64-31.3.1.deb /home/paninit/.local/opt/drawio-deb
```

- Download: **133.862.264 bytes** (~35 MB menor que o AppImage)
- `dpkg-deb -x` **não precisa de root** e **não toca no sistema** (não é `dpkg -i`)
- **Não tem o problema de FUSE** — um passo a menos
- Binário: `/home/paninit/.local/opt/drawio-deb/opt/drawio/drawio`

**Verificado que os dois produzem o PNG byte a byte idêntico:**

```console
$ sha256sum /tmp/drawio-test/out.png /tmp/drawio-test/deb.png | awk '{print $1}' | sort -u | wc -l
1
```

### Passo 3: dependências de sistema

```console
$ ldd /home/paninit/.local/opt/drawio/squashfs-root/drawio | grep -i "not found"
(nenhuma)
$ ldd .../drawio | wc -l
101
```

**Nenhuma dependência faltando neste ambiente.** As 101 libs resolvem, incluindo as que
costumam faltar em imagens enxutas: `libgbm.so.1` ✅, `libasound.so.2` ✅, `libnss3.so` ✅,
`libgtk-3.so.0` ✅, `libatk-1.0.so.0` ✅, `libdrm.so.2` ✅, `libcups.so.2` ✅, `libatspi.so.0` ✅.

Se em outra máquina faltarem, o conjunto mínimo é o que a imagem headless oficial-de-facto
instala (`rlespinasse/docker-drawio-desktop-headless`, `Dockerfile`, branch `v1.x`):

```bash
apt-get install -y xvfb libgbm1 libasound2 dbus dbus-x11
# fontes (mínimo):
apt-get install -y --no-install-recommends fonts-liberation fonts-dejavu-core
# fontes (completo, com CJK):
apt-get install -y --no-install-recommends fonts-liberation fonts-dejavu-core \
  fonts-noto-core fonts-noto-cjk fonts-arphic-ukai fonts-arphic-uming \
  fonts-ipafont-mincho fonts-ipafont-gothic fonts-unfonts-core
```

### Comando de export verificado

```bash
DRAWIO=/home/paninit/.local/opt/drawio/squashfs-root/drawio

xvfb-run -a "$DRAWIO" \
  -x -f png -o /caminho/saida.png /caminho/entrada.drawio \
  --no-sandbox --disable-gpu --disable-update
```

Output real:

```
[16660:0821/105440.211735:ERROR:dbus/bus.cc:405] Failed to connect to the bus: ... (11 linhas de ruído)
/tmp/drawio-test/aws-test.drawio -> /tmp/drawio-test/out.png
```

Resultado: `out.png`, 13.336 bytes, **364x244**, PNG RGB 8-bit.

Versão confirmada pelo próprio binário:

```console
$ xvfb-run -a "$DRAWIO" --version
31.3.1
```

### Flags do CLI (fonte primária)

Extraídas de `src/main/args.js` da tag `v31.3.1` **e conferidas** contra o `--help` do binário
extraído — batem exatamente. As que interessam:

| Flag | Descrição | Verificado |
|---|---|---|
| `-x, --export` | ativa modo de export | ✅ |
| `-f, --format <fmt>` | `pdf\|svg\|png\|jpeg\|jpg\|xml\|html` — **default `pdf`** | ✅ png/svg/pdf |
| `-o, --output <path>` | arquivo **ou pasta** de saída | ✅ |
| `-s, --scale <n>` | escala o diagrama | ✅ `-s 2` → 725x485 |
| `--width <px>` | ajusta à largura, preserva aspecto | ✅ `--width 1000` → 1000x669 |
| `--height <px>` | ajusta à altura, preserva aspecto | — |
| `-b, --border <px>` | borda ao redor (**default 0**) | ✅ `-b 20` → 404x284 |
| `-t, --transparent` | fundo transparente (PNG/SVG) | ✅ vira PNG **RGBA** (colortype 6) |
| `-p, --page-index <n>` | seleciona página, **1-based** | ✅ `-p 1` = primeira |
| `--size <diagram\|page>` | `diagram` (default, corta no conteúdo) ou `page` | ✅ `page` → 852x1102 |
| `-a, --all-pages` | todas as páginas (PDF e HTML) | — |
| `-g, --page-range <de>..<até>` | faixa de páginas, 1-based, só PDF | — |
| `-l, --layers <i,j,k>` | seleciona layers | — |
| `--crop` | corta o PDF no tamanho do diagrama | ✅ PDF gerado |
| `-q, --quality <n>` | qualidade JPEG (default 90) | — |
| `-e, --embed-diagram` | embute o XML no PNG/SVG/PDF | — |
| `--theme <dark\|light\|auto>` | tema do export | — |
| `-r, --recursive` | recursivo em subpastas | — |
| `-u, --uncompressed` | XML/SVG sem compressão | — |
| `--layout <nome\|json>` | aplica layout antes do export | — |
| `--disable-update` | desliga auto-update | ✅ |

Detalhe do parser (`args.js`): **flags desconhecidas são silenciosamente descartadas**
(`if (!def) { i++; continue; }`). Por isso passar flags do Chromium como `--disable-gpu`
ou `--no-sandbox` não quebra nada — elas passam direto para o Electron.

### Pegadinhas — testadas uma a uma

**1. `xvfb-run` é OBRIGATÓRIO.** Sem `DISPLAY` o processo aborta com core dump:

```console
$ env -u DISPLAY "$DRAWIO" -x -f png -o b.png aws-test.drawio --no-sandbox
[20383:...:ERROR:ui/ozone/platform/x11/ozone_platform_x11.cc:257] Missing X server or $DISPLAY
[20383:...:ERROR:ui/aura/env.cc:246] The platform failed to initialize.  Exiting.
timeout: the monitored command dumped core
```

Nenhum arquivo é gerado. Não existe modo `--headless` que dispense o X virtual.

**2. `--no-sandbox` NÃO foi obrigatório aqui — mas mantenha.** Testei sem, e funcionou:

```console
$ xvfb-run -a "$DRAWIO" -x -f png -o c.png aws-test.drawio --disable-update
/tmp/drawio-test/aws-test.drawio -> /tmp/drawio-test/c.png   # exit 0, PNG gerado
```

Motivo: o `chrome-sandbox` extraído fica com modo **755, sem setuid** (`stat -c '%a' chrome-sandbox`
→ `755`), então o sandbox SUID não é usado; o kernel do WSL2 permite user namespaces sem
privilégio (`/proc/sys/user/max_user_namespaces` = 31061, sem restrição AppArmor), então o
**sandbox de namespace** funciona.

Mas mantenha `--no-sandbox` mesmo assim, porque:
- como **root** (containers, CI) o namespace sandbox falha e ele vira obrigatório;
- o próprio `electron.js` do drawio-desktop tem código específico para filtrar essa flag da
  lista de arquivos de entrada (`src/main/electron.js`, ~linha 870: *"Remove --no-sandbox arg
  from the paths"*) — ou seja, é a flag **oficialmente esperada**;
- a imagem headless de referência sempre a passa.

Não precisei de `ELECTRON_DISABLE_SANDBOX`. Não vi erro de `libgbm`/`libasound` — as duas
estão presentes.

**3. Ruído de D-Bus vai para o STDOUT, não para o STDERR.** Essa é a pegadinha que mais
atrapalha scripting. Verificado redirecionando para arquivos separados:

```console
$ xvfb-run -a "$DRAWIO" -x -f png -o fs.png aws-test.drawio --no-sandbox \
    >/tmp/drawio-test/o.txt 2>/tmp/drawio-test/e.txt
$ wc -l /tmp/drawio-test/o.txt /tmp/drawio-test/e.txt
12 o.txt      # 11 linhas de erro de D-Bus + 1 linha de sucesso
 0 e.txt      # stderr VAZIO
```

Consequências: `2>/dev/null` **não** limpa a saída, e **não dá para detectar erro pelo stderr**.
Filtre o stdout:

```bash
xvfb-run -a "$DRAWIO" -x -f png -o saida.png entrada.drawio \
  --no-sandbox --disable-gpu --disable-update 2>&1 | grep -v 'ERROR:dbus'
```

Envolver com `dbus-launch --exit-with-session` reduz de 11 para 4 linhas de ruído, mas não
zera (o barramento **de sistema** exigiria root). Não vale a pena — use `grep -v`.

**4. Exit codes são confiáveis** (use-os em vez do stderr):

| Cenário | Exit | Arquivo gerado | Mensagem (stdout) |
|---|---|---|---|
| arquivo válido | `0` | sim | `entrada.drawio -> saida.png` |
| arquivo inexistente | `1` | não | `Error: input file/directory not found: ...` |
| XML malformado | `1` | não | `Error: Export failed: ...` |

**5. Escreve perfil em `~/.config/draw.io/`** (com ponto — não `drawio`), ~2,1 MB de cache,
cookies e `config.json`. Inofensivo, mas existe.

### Modo batch (pasta inteira, um único processo)

```console
$ xvfb-run -a "$DRAWIO" -x -f png -o /tmp/drawio-batch/out /tmp/drawio-batch/in \
    --no-sandbox --disable-update
/tmp/drawio-batch/in/diag1.drawio -> /tmp/drawio-batch/out/diag1.png
/tmp/drawio-batch/in/diag2.drawio -> /tmp/drawio-batch/out/diag2.png
/tmp/drawio-batch/in/diag3.drawio -> /tmp/drawio-batch/out/diag3.png
/tmp/drawio-batch/in/diag4.drawio -> /tmp/drawio-batch/out/diag4.png
/tmp/drawio-batch/in/diag5.drawio -> /tmp/drawio-batch/out/diag5.png
TOTAL: 11.80 s wall, 329940 KB maxRSS
```

5 arquivos em 11,8 s (2,4 s/arquivo) vs. 3,0 s/arquivo em execuções separadas. Vale a pena
para lotes.

---

## Teste de fidelidade do ícone AWS — ✅ **RENDERIZA CORRETAMENTE**

### Arquivo de teste

Salvo como `aws-test.drawio` — grupo VPC contendo um `resourceIcon` de Lambda e um bucket S3:

```xml
<mxfile host="app.diagrams.net" version="24.0.0">
  <diagram name="Page-1" id="test-page-1">
    <mxGraphModel dx="800" dy="600" grid="0" gridSize="10" guides="1" tooltips="1" connect="1"
                  arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100"
                  math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="vpc1" value="VPC" style="sketch=0;outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;strokeColor=#248814;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#248814;dashed=0;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="360" height="240" as="geometry" />
        </mxCell>
        <mxCell id="lambda1" value="Lambda" style="sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=#F78E04;gradientDirection=north;fillColor=#D05C17;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda;" vertex="1" parent="vpc1">
          <mxGeometry x="60" y="70" width="78" height="78" as="geometry" />
        </mxCell>
        <mxCell id="s3a" value="S3 Bucket" style="sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=#7AA116;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;aspect=fixed;pointerEvents=1;shape=mxgraph.aws4.bucket;" vertex="1" parent="vpc1">
          <mxGeometry x="210" y="70" width="78" height="78" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### Evidência 1 — análise de cor da marca

```
total px 88816 | unique colors 2009

--- brand-color pixel counts (tol 28) ---
  Lambda fill  #D05C17 (laranja):   2844 px  PRESENTE
  Lambda grad  #F78E04 (âmbar)  :   2940 px  PRESENTE
  S3 fill      #7AA116 (verde)  :   1008 px  PRESENTE
  VPC stroke   #248814 (verde)  :   1687 px  PRESENTE
```

As 2009 cores únicas incluem toda a rampa do gradiente (`#DD6D10`, `#E5770C`, `#EB7F09`,
`#EF8407`, `#F38905`...) — ou seja, `gradientColor` + `gradientDirection=north` foram
efetivamente aplicados, não um preenchimento chapado de fallback.

### Evidência 2 — geometria do stencil no SVG

Exportando o mesmo arquivo em SVG (`-f svg`), o resultado tem **11 atributos `d` de path e
apenas 1 `<rect>`** (o fundo). Os três maiores paths correspondem aos três stencils:

| Tamanho do `d` | Início | O que é |
|---|---|---|
| 5960 chars | `M 277.9 112.77 L 278.3 109.82 C 281.46 111.75 ...` | balde do S3 |
| 2362 chars | `M 10.59 6.65 C 10.53 6.65 10.48 6.65 ...` | ícone de nuvem do grupo VPC |
| 966 chars | `M 85.67 137.97 L 71.83 137.97 L 87.13 105.99 L 94.06 120.26 Z ...` | **glifo λ da Lambda** |

O path de 966 chars fica em x≈71–94, y≈102–138 — exatamente dentro da caixa do ícone Lambda.
Se o stencil não existisse, haveria um `<rect>` a mais e nenhum desses paths.

### Evidência 3 — experimento de controle (o teste decisivo)

Rendeirizei o **mesmo** diagrama trocando só `resIcon=mxgraph.aws4.lambda` por
`resIcon=mxgraph.aws4.THIS_DOES_NOT_EXIST`, e contei os pixels brancos (o glifo) dentro da
caixa do ícone:

```
out.png        lambda-box white(glyph) px =  324/6084 (5.3%)   <- stencil real
control.png    lambda-box white(glyph) px =    0/6084 (0.0%)   <- stencil inexistente
```

Visualmente: o real mostra o λ branco desenhado sobre o quadrado laranja com gradiente;
o controle mostra **exatamente a "caixa vazia"** — o quadrado laranja sem glifo nenhum.

**Conclusão: o render é fiel.** A inspeção visual do PNG confirma VPC com ícone de nuvem+cadeado
verde no cabeçalho, tile laranja com λ branco rotulado "Lambda", e balde verde rotulado
"S3 Bucket", com tipografia correta.

---

## Caminho 2 — Docker — ❌ **INDISPONÍVEL neste ambiente**

O cliente Docker existe, mas **o daemon não está rodando**:

```console
$ docker version
Client: Version: 29.1.3 ...
failed to connect to the docker API at unix:///var/run/docker.sock; check if the path is
correct and if the daemon is running: dial unix /var/run/docker.sock: connect: no such file
or directory
```

Não dá para subir sem intervenção humana:

```console
$ sudo -n systemctl start docker
sudo: a password is required
$ ps -p 1 -o comm=
init(Ubuntu-20.          # não é systemd
$ ls /mnt/wsl/docker-desktop*
no matches found         # sem integração do Docker Desktop
```

Correções às premissas da pergunta, verificadas via API do GitHub:

- **`jgraph/docker-drawio-desktop-headless` não existe** (HTTP 404). Não há imagem headless
  oficial da jgraph.
- **`jgraph/drawio-image-export` não é o nome certo.** O projeto de export server da jgraph é
  **`jgraph/draw-image-export2`** (58 stars, ativo, push 2026-07-01) — *"The 2018 server-side
  PNG/PDF export implementation using Node, Puppeteer and Chrome headless"*. Exige Puppeteer +
  Chrome headless (que **não** existem aqui) e expõe uma API HTTP (`format`, `xml`, `url`,
  `w`, `h`, `bg`, `scale`), não um CLI.
- A imagem headless real, de-facto padrão do ecossistema, é
  **`rlespinasse/docker-drawio-desktop-headless`** (69 stars, ativo, push 2026-08-10).

O `Dockerfile` dela (branch `v1.x`) confirma que a abordagem canônica é **exatamente o caminho 1**:
`debian:trixie` + `apt-get install xvfb libgbm1 libasound2 dbus dbus-x11` + o **`.deb`** do
drawio-desktop + fontes. E o `src/runner.sh` dela é a fonte primária do conjunto de flags:

```bash
"${DRAWIO_DESKTOP_EXECUTABLE_PATH}" "$@" --no-sandbox --disable-gpu \
  --disable-features=VaapiVideoDecoder,VaapiVideoEncoder \
  --disable-accelerated-video-decode --disable-accelerated-video-encode
```

O `entrypoint.sh` sobe `dbus-daemon --system --fork` + `dbus-launch` só para calar o ruído de
D-Bus, e `Xvfb :42 -nolisten unix`. Também define `ELECTRON_DISABLE_SECURITY_WARNINGS=true`
e `DRAWIO_DISABLE_UPDATE=true`.

**Se o Docker for ligado depois**, o comando seria:

```bash
docker run --rm -v "$PWD:/data" rlespinasse/drawio-desktop-headless \
  -x -f png -o /data/saida.png /data/entrada.drawio
```

Não pude testar — daemon indisponível.

---

## Caminho 3 — npm `@drawio/export` — ❌ **NÃO EXISTE**

Consultei o registry do npm diretamente:

```console
@drawio/export             NOT FOUND (Not found)
drawio-export              NOT FOUND (Not found)
drawio-batch               NOT FOUND (Not found)
@jgraph/drawio-export      NOT FOUND (Not found)
drawio                     latest=1.0.7 (2017-11-06) deps=2   <- abandonado há 9 anos
```

Não existe pacote npm publicado para export de draw.io. O `drawio-batch` (citado em vários
tutoriais e GitHub Actions antigos) foi despublicado; o que sobrou são imagens Docker que o
embutem. **Caminho morto** — não há "tamanho de download" a reportar.

---

## Caminho 4 — renderizadores independentes — ❌ **NÃO EXISTEM (de forma fiel)**

Todos os projetos que se anunciam como "standalone" são, na verdade, wrappers em volta do
próprio draw.io:

| Projeto | O que realmente faz |
|---|---|
| `racklet/render-drawio-action` | binário Go que chama a imagem `rlespinasse/drawio-desktop-headless` |
| `Burnett01/actions-drawio` / `burnett0/alpine-drawio-batch` | Node + **Chromium** rodando o webapp do drawio |
| `michaelgrigoryan25/draw.io-export` | Electron + webapp do drawio |
| `jgraph/draw-image-export2` | Node + **Puppeteer/Chrome** + webapp do drawio |
| scripts Python diversos | extraem imagens já embutidas em `.drawio`/`.xml` de biblioteca; **não renderizam shapes** |

### Por que não existe — a arquitetura dos stencils `aws4`

Investiguei o `app.asar` (146 MB) dentro do AppImage. Renderizar
`shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda;` exige **duas peças distintas**:

1. **`drawio/src/main/webapp/shapes/mxAWS4.js`** (11 KB) — classes JS que desenham o *tile*
   com gradiente e delegam para o sub-stencil. Registra exatamente 5 shapes:
   ```
   registerShape(mxShapeAws4ProductIcon.prototype.cst.PRODUCT_ICON,  mxShapeAws4ProductIcon)
   registerShape(mxShapeAws4ResourceIcon.prototype.cst.RESOURCE_ICON, mxShapeAws4ResourceIcon)
   registerShape(mxShapeAws4Group.prototype.cst.GROUP,               mxShapeAws4Group)
   registerShape(mxShapeAws4GroupCenter.prototype.cst.GROUP_CENTER,  mxShapeAws4GroupCenter)
   registerShape(mxShapeAws4Group2.prototype.cst.GROUP2,             mxShapeAws4Group2)
   ```
2. **`drawio/src/main/webapp/stencils/aws4.xml`** (6,5 MB, **1037 `<shape>`**) — a geometria de
   cada ícone de serviço, em formato de stencil mxGraph (`<move>`, `<line>`, `<curve>`).
   Confirmado que `name="lambda"` está lá. Também vem pré-comprimido (deflate+base64) em
   `js/stencils.min.js` sob a chave `f['aws4.xml']`.

Ou seja: um renderizador independente precisaria de um **motor completo de stencils mxGraph**
*mais* uma reimplementação dessas 5 classes JS. Nenhuma ferramenta faz isso. Qualquer coisa que
tente parsear `.drawio` "na mão" vai cair no caso `control.png` acima — **caixa vazia**.

O `aws4.xml` é, em tese, extraível e portável — mas sem o `mxShapeAws4ResourceIcon` você perde
o tile com gradiente e o posicionamento, então a fidelidade continua parcial.

---

## Recomendação final

**Use o caminho 1.** Entre as duas variantes, ambas verificadas e com saída byte a byte idêntica:

| | AppImage | `.deb` |
|---|---|---|
| Download | 168.797.606 B | **133.862.264 B** |
| Passos | baixar → `chmod +x` → `--appimage-extract` | baixar → `dpkg-deb -x` |
| Pegadinha do FUSE | **sim** (precisa extrair) | **não** |
| Portabilidade | qualquer distro | Debian/Ubuntu (precisa de `dpkg-deb`) |
| Extraído | 448 MB | 447 MB |

Para este WSL2 Ubuntu, o **`.deb` é ligeiramente melhor** (menor, uma pegadinha a menos).
O AppImage é a escolha certa se a skill precisar rodar em distro arbitrária.

**Fallbacks, em ordem:**

1. **`.deb` extraído** — se o AppImage falhar (FUSE, ou outra libfuse quebrada).
2. **Docker `rlespinasse/drawio-desktop-headless`** — se/quando o daemon for ligado. É o
   caminho mais reprodutível para CI, porque carrega as fontes junto.
3. **`jgraph/draw-image-export2`** — só se você já tiver Node + Chromium e precisar de um
   *serviço HTTP* em vez de CLI. Mais pesado de montar.
4. Não há caminho 4. Não tente parsear `.drawio` sozinho.

### Sobre a restrição "a skill final não pode exigir binário nenhum"

Isso é consistente com o achado. A separação natural:

- **Runtime da skill:** gerar `.drawio` (XML puro) — **zero dependências**. O `.drawio` é o
  entregável; quem abre é o usuário no app/web, que já tem todos os stencils.
- **Dev-time (aqui):** o drawio-desktop extraído serve para **verificar** que o XML gerado
  renderiza fiel — exatamente o loop que este documento comprova ser viável.

Se em algum momento a skill precisar entregar imagem sem binário, a saída viável é
**`-f svg`**: o SVG exportado já traz a geometria dos stencils embutida como paths
(comprovado acima) e é autocontido, então pode ser gerado uma vez em dev-time e versionado.

---

## Onde ficaram os arquivos

| Caminho | Tamanho | O que é |
|---|---|---|
| `/home/paninit/.local/opt/drawio-dl/drawio-x86_64-31.3.1.AppImage` | 169 MB | AppImage baixado |
| `/home/paninit/.local/opt/drawio-dl/drawio-amd64-31.3.1.deb` | 134 MB | `.deb` baixado |
| `/home/paninit/.local/opt/drawio/squashfs-root/` | 448 MB | AppImage extraído |
| `/home/paninit/.local/opt/drawio/squashfs-root/drawio` | 216 MB | **binário (AppImage)** |
| `/home/paninit/.local/opt/drawio-deb/opt/drawio/drawio` | 216 MB | **binário (`.deb`)** |
| `~/.config/draw.io/` | 2,1 MB | perfil/cache criado em runtime |

Nada foi instalado globalmente. Nenhum `dpkg -i`, nenhum `apt`, nenhum `PATH` alterado,
nenhum arquivo fora de `~/.local/opt/` e `~/.config/`.

**Limpeza total:**

```bash
rm -rf /home/paninit/.local/opt/drawio-dl \
       /home/paninit/.local/opt/drawio \
       /home/paninit/.local/opt/drawio-deb \
       ~/.config/draw.io
```

---

## Incertezas

- **`--no-sandbox` como root não foi testado.** Não há `sudo` sem senha aqui, então não pude
  confirmar empiricamente que ele vira obrigatório sob uid 0. A afirmação vem de fonte
  primária (o código de filtragem em `electron.js` e o `runner.sh` da imagem headless) e do
  fato de o `chrome-sandbox` extraído não ter setuid — mas é inferência, não medição.
- **Docker não foi testado de fato.** O comando `docker run` que sugiro para
  `rlespinasse/drawio-desktop-headless` vem da leitura do repositório, não de execução. O
  `Dockerfile` na `v1.x` fixa `DRAWIO_VERSION="31.1.8"`, defasado da release 31.3.1 de hoje.
- **Fidelidade testada em 3 shapes**, não nos 1037. Testei `aws4.resourceIcon`+`resIcon=lambda`,
  `aws4.bucket` e `aws4.group`+`grIcon=group_vpc`. É uma amostra representativa dos três
  mecanismos distintos (tile+sub-stencil, stencil direto, container com ícone), mas não é
  cobertura exaustiva.
- **Fontes:** este ambiente tem 143 fontes com `Liberation Sans` presente. Numa máquina sem
  `fonts-liberation`, o texto renderizaria com fallback e as métricas mudariam — o diagrama
  sairia diferente. Não testei esse cenário degradado.
- **`--width`/`--height` juntos, `-a`, `-g`, `-l`, `--layout`, `--theme`, `-e`** não foram
  testados; estão documentados a partir de `args.js` v31.3.1 (que confere com o `--help` do
  binário, então a confiança é alta, mas o comportamento não foi observado).
- **O ruído de D-Bus indo para stdout** foi verificado neste ambiente com `xvfb-run`. Não
  descartei que `xvfb-run` esteja mesclando os descritores — o teste isola o comportamento
  do conjunto `xvfb-run` + `drawio`, que é como se usa na prática, mas não prova qual dos dois
  é o responsável.
- **Concorrência não testada.** Usei `xvfb-run -a` (auto servernum), que em tese suporta
  execuções paralelas, mas não rodei dois exports simultâneos para confirmar.
- **`v31.3.1` foi publicada hoje** (2026-08-21T07:49:15Z). É muito nova; não há histórico de
  issues sobre ela. Se aparecer regressão, `v31.1.8` é a versão que a imagem headless usa em
  produção.
