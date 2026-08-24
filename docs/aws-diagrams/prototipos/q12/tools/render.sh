#!/usr/bin/env bash
# Render de um .drawio, silenciando o ruído de dbus do WSL2 e falhando rápido.
#
#   tools/render.sh entrada.drawio saida.png [formato]
#
# Duas coisas aqui não são zelo, são cicatriz:
#
# 1. O TIMEOUT. Quando o Chromium headless levanta `UnknownVizError`, o draw.io
#    não encerra: o erro vira `UnhandledPromiseRejection` e o binário fica
#    pendurado para sempre. Sem timeout, uma falha de render trava a suite.
#
# 2. O `--kill-after` + `setsid`. `timeout` mata o `xvfb-run`, NÃO os filhos
#    dele. Cada render que estourava deixava um `Xvfb` e um `drawio` vivos, e
#    depois de meia dúzia deles a máquina satura e ARQUIVOS BONS PASSAM A
#    FALHAR — o que envenena qualquer bisseção. Matar o grupo inteiro é o que
#    mantém as medições comparáveis entre si.
set -uo pipefail

ENTRADA="$1"
SAIDA="$2"
FORMATO="${3:-png}"
DRAWIO="${DRAWIO:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
LIMITE="${LIMITE:-40}"

[ -x "$DRAWIO" ] || { echo "draw.io headless ausente em $DRAWIO"; exit 3; }

extra=()
[ "$FORMATO" = png ] && extra=(-s 2)

rm -f "$SAIDA"
saida_log="$(timeout --kill-after=5 --signal=TERM "$LIMITE" \
  setsid xvfb-run -a "$DRAWIO" -x -f "$FORMATO" "${extra[@]}" \
  --no-sandbox --disable-gpu -o "$SAIDA" "$ENTRADA" 2>&1)"
codigo=$?

# NÃO tente uma rede de segurança com `pkill -f "$(basename "$ENTRADA")"`:
# o nome do arquivo aparece na linha de comando de QUEM CHAMOU este script, e
# o pkill mata o chamador junto. Custou uma bisseção inteira em silêncio — o
# lote parava na terceira linha sem erro nenhum. Limpeza de sobra é trabalho do
# `limpar-render.sh`, que sabe distinguir o que é nosso.

if [ ! -s "$SAIDA" ]; then
  echo "✗ $(basename "$ENTRADA") não rendeu (código $codigo)"
  echo "$saida_log" | grep -vi 'dbus\|trace-warnings' | tail -5
  exit 1
fi
echo "✓ $(basename "$SAIDA")  $(stat -c %s "$SAIDA") bytes"
