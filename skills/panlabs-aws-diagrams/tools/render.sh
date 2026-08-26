#!/usr/bin/env bash
# Renders one .drawio, silencing WSL2's dbus noise and failing fast.
#
#   tools/render.sh input.drawio output.png [format]
#
# Two things here are not diligence, they are scars:
#
# 1. THE TIMEOUT. When headless Chromium raises `UnknownVizError`, draw.io does
#    not exit: the error becomes an `UnhandledPromiseRejection` and the binary
#    hangs forever. With no timeout, one render failure freezes the suite.
#
# 2. `--kill-after` + `setsid`. `timeout` kills `xvfb-run`, NOT its children.
#    Every render that blew up left an `Xvfb` and a `drawio` alive, and after
#    half a dozen of those the machine saturates and GOOD FILES START FAILING —
#    which poisons any bisection. Killing the whole group is what keeps the
#    measurements comparable to each other.
set -uo pipefail

INPUT="$1"
OUTPUT="$2"
FORMAT="${3:-png}"
# the path has ONE owner: `tools/drawio.cjs`. Here, only the same resolution order.
DRAWIO="${DRAWIO:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
LIMIT="${LIMIT:-40}"

[ -x "$DRAWIO" ] || { echo "draw.io headless missing at $DRAWIO"; exit 3; }

extra=()
[ "$FORMAT" = png ] && extra=(-s 2)

rm -f "$OUTPUT"
render_log="$(timeout --kill-after=5 --signal=TERM "$LIMIT" \
  setsid xvfb-run -a "$DRAWIO" -x -f "$FORMAT" "${extra[@]}" \
  --no-sandbox --disable-gpu -o "$OUTPUT" "$INPUT" 2>&1)"
code=$?

# DO NOT try a safety net with `pkill -f "$(basename "$INPUT")"`: the file name
# appears on the command line of WHOEVER CALLED this script, and pkill kills the
# caller along with it. It cost a whole bisection in silence — the batch stopped
# at the third line with no error at all. Cleaning up leftovers is
# `clean-render.sh`'s job, and it knows how to tell ours apart.

if [ ! -s "$OUTPUT" ]; then
  echo "✗ $(basename "$INPUT") did not render (code $code)"
  echo "$render_log" | grep -vi 'dbus\|trace-warnings' | tail -5
  exit 1
fi
echo "✓ $(basename "$OUTPUT")  $(stat -c %s "$OUTPUT") bytes"
