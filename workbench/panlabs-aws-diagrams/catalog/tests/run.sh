#!/usr/bin/env bash
# End-to-end catalog suite.
#
#   ./tests/run.sh [drawio-repo] [drawio-binary]
#
# Two layers, and the difference between them matters:
#
#   1. check-catalog     — static, no rendering. Runs on any machine.
#   2. render + verify    — needs draw.io headless. This is a DEVELOPMENT
#      DEPENDENCY: the published skill doesn't render anything. If the binary
#      doesn't exist, the suite warns and passes only the static layer, instead
#      of failing.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CATALOG_DIR="$(dirname "$HERE")"
REPO="${1:-/tmp/drawio}"
DRAWIO="${2:-$HOME/.local/opt/drawio/squashfs-root/drawio}"

failed=0

echo "== 1. static checks =="
if [ -d "$REPO" ]; then
  node "$CATALOG_DIR/tools/check-catalog.cjs" "$REPO" || failed=1
else
  echo "   (draw.io repo missing at $REPO — round-trip skipped)"
  node "$CATALOG_DIR/tools/check-catalog.cjs" || failed=1
fi

echo
echo "== 2. sample =="
node "$CATALOG_DIR/tools/render-sample.cjs" || failed=1

echo
echo "== 3. render + pixel verification =="
if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless not found at $DRAWIO — render skipped."
  echo "   (development dependency: draw.io Desktop AppImage + xvfb;"
  echo "    tools/drawio.cjs is the one that knows where the binary lives)"
else
  xvfb-run -a "$DRAWIO" -x -f png -s 2 --no-sandbox --disable-gpu \
    -o "$HERE/sample.png" "$HERE/sample.drawio" 2>/dev/null
  python3 "$CATALOG_DIR/tools/verify-render.py" "$HERE/sample.png" "$HERE/sample.manifest.json" || failed=1
fi

echo
if [ "$failed" -ne 0 ]; then
  echo "SUITE RED"
  exit 1
fi
echo "suite green"
