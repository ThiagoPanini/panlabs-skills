#!/usr/bin/env bash
# Renders several .drawio files, CLEANING the environment between one and the next.
#
# Cleaning between renders is not optional hygiene: an aborted render leaves a
# live process behind, and the next render inherits a saturated machine and fails
# for a reason that has nothing to do with the file. Without it, the measurements
# are not comparable.
#
#   tools/render-batch.sh a.drawio b.drawio ...
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
failed=0

for d in "$@"; do
  "$HERE/clean-render.sh" >/dev/null 2>&1
  png="${d%.drawio}.png"
  if "$HERE/render.sh" "$d" "$png" 2>&1 | tail -3; then :; else failed=1; fi
done

"$HERE/clean-render.sh" >/dev/null 2>&1
exit "$failed"
