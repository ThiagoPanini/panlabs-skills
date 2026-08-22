#!/usr/bin/env bash
# Render dos .drawio para PNG, com a pegadinha que custou uma hora anotada.
#
#   ./tools/renderizar.sh [binario-drawio]
#
# ⚠️ UM DE CADA VEZ — E LIMPE OS PENDURADOS ANTES.
#
# A pesquisa do #9 deixou "concorrência não testada" como incerteza. Está testada,
# e o resultado é pior do que "fica lento":
#
#   Duas exportações headless simultâneas nesta máquina PENDURAM. O sintoma é
#
#       UnhandledPromiseRejectionWarning: Error: UnknownVizError
#       [ERROR:gpu_process_host.cc] GPU process isn't usable. Goodbye.
#
#   com código de saída 0 ou 1 e nenhum PNG. E o pior vem depois: `timeout` mata o
#   `xvfb-run`, não os filhos Electron. Eles ficam em STAT S, 0% de CPU, por tempo
#   indeterminado — medi 508 s num export que leva 4 s — e PENVENENAM TODA
#   TENTATIVA POSTERIOR, inclusive as sequenciais. Depois de ceifá-los, o mesmo
#   comando que falhava 5 vezes seguidas passou de primeira.
#
# Portanto: sequencial, e com uma varredura de pendurados na entrada. O
# `--user-data-dir` próprio é higiene barata (o default é UM só para toda a
# máquina), mas sozinho NÃO resolve — quem resolve é não deixar processo pendurado.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q13="$(dirname "$AQUI")"
DRAWIO="${1:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
PERFIL="$(mktemp -d -t drawio-q13-XXXXXX)"
trap 'rm -rf "$PERFIL"' EXIT

if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless não encontrado em $DRAWIO — render pulado."
  echo "   (premissa 8 do mapa: o renderizador é dependência de DESENVOLVIMENTO)"
  exit 0
fi

# ceifa export pendurado de qualquer rodada anterior (ver o comentário acima)
pendurados=$(ps -o pid,etimes -C drawio --no-headers 2>/dev/null | awk '$2>180 {print $1}')
if [ -n "$pendurados" ]; then
  echo "   ceifando $(echo "$pendurados" | wc -l) processo(s) draw.io pendurado(s) há mais de 3 min"
  echo "$pendurados" | xargs -r kill -9 2>/dev/null
  sleep 2
fi

falhou=0
for d in "$Q13"/saida/*.drawio; do
  # A variante animada NÃO vai para PNG. O #4 mediu e o #11 confirmou que
  # `flowAnimation` vira tracejado ESTÁTICO no PNG, sem erro nenhum — um PNG dela
  # seria prova falsa. Vai para SVG, e o que se confere é o `@keyframes`.
  if [[ "$(basename "$d")" == *animado* ]]; then
    svg="${d%.drawio}.svg"
    xvfb-run -a "$DRAWIO" -x -f svg -o "$svg" "$d" \
      --no-sandbox --disable-gpu --disable-update --user-data-dir="$PERFIL" 2>&1 \
      | grep -v 'ERROR:dbus\|NameHasOwner\|Failed to connect to the bus' || true
    if grep -q 'ge-flow-animation' "$svg" 2>/dev/null; then
      echo "   $(basename "$svg") ok (animação presente)"
    else
      echo "   $(basename "$svg") SEM ANIMAÇÃO"; falhou=1
    fi
    continue
  fi
  png="${d%.drawio}.png"
  # `2>/dev/null` NÃO limpa: o #9 mediu que o xvfb-run funde os descritores e as 11
  # linhas de erro de D-Bus saem em stdout. Quem limpa é o grep.
  xvfb-run -a "$DRAWIO" -x -f png -s 2 -o "$png" "$d" \
    --no-sandbox --disable-gpu --disable-update --user-data-dir="$PERFIL" 2>&1 \
    | grep -v 'ERROR:dbus\|NameHasOwner\|Failed to connect to the bus' || true
  if [ -s "$png" ]; then
    echo "   $(basename "$png") ok  ($(stat -c%s "$png") bytes)"
  else
    echo "   $(basename "$png") VAZIO"; falhou=1
  fi
done
exit "$falhou"
