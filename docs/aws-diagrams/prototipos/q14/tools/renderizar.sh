#!/usr/bin/env bash
# Renderiza as duas paginas de saida/varejo.drawio.
#
# O binario headless e dependencia de DESENVOLVIMENTO (premissa 8 do #1) — a
# skill publicada nao o invoca. Aqui ele e banco de provas: sem render nao da
# para saber se o desenho saiu certo, e o #17 aprendeu isso do jeito caro (24
# checagens estaticas verdes e o PNG mostrando o icone errado).
#
# Cada pagina e recortada para um arquivo de uma pagina so antes de renderizar.
# Nao e capricho: o `-p N` sobre o arquivo de duas paginas carrega as duas na
# memoria, e nesta maquina isso e a diferenca entre sair e o OOM killer levar o
# electron embora sem mensagem nenhuma.
set -u
cd "$(dirname "$0")/.."

DRAWIO="${DRAWIO:-$HOME/.local/opt/drawio/squashfs-root/AppRun}"
ESCALA="${ESCALA:-2}"

if [ ! -x "$DRAWIO" ]; then
  echo "  draw.io headless ausente em $DRAWIO — pulando o render."
  exit 0
fi

node tools/_recortar.cjs || exit 1

render() {  # <entrada> <saida>
  rm -f "$2"
  xvfb-run -a "$DRAWIO" -x -f png -s "$ESCALA" --no-sandbox --disable-gpu -o "$2" "$1" >/dev/null 2>&1
  if [ -f "$2" ]; then
    echo "  ✓ $2  ($(stat -c%s "$2") bytes)"
  else
    echo "  ✗ $2 nao saiu — no WSL2 sob pressao de memoria o electron e morto sem aviso; tente de novo com ESCALA=1"
  fi
}

render saida/_p0.drawio saida/1-logica.png
render saida/_p1.drawio saida/2-tecnica.png
rm -f saida/_p0.drawio saida/_p1.drawio
