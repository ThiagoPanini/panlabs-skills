#!/usr/bin/env bash
# Answers ONE question — is a render already on this machine? — before layer 7
# spends its own budget finding out the slow way.
#
#   tools/detect-neighbor.sh
#
#   exit 0, silent     nobody found
#   exit 1, on stdout  the process line(s) found — one per match
#
# #128 fixed the leak (a killed render used to leave a whole Chromium and an
# Xvfb behind), which is what let contention COMPOUND — but a second suite
# starting clean, on a machine another session is already rendering on, was
# never the leak's fault. #128's own measurement caught it directly: three
# sessions of this repository rendering at once, the `drawio` process count
# reaching 36, and one worktree's `render.sh` running in the very instant
# another worktree's round-trip failed on the same model. #141 is this file:
# it does not stop two suites from racing the same machine, it makes the
# racing LEGIBLE before the race produces an unexplained red.
#
# The shapes below are `clean-render.sh`'s, turned into a question instead of
# a kill: a REAL render always carries CLI flags after the binary path, and an
# `Xvfb` raised by `xvfb-run` always carries `-auth /tmp/xvfb-run.*` on its
# command line. Anything that only CARRIES the path as someone else's
# argument — `tests/run.sh` itself (`$DRAWIO` is its own trailing argument),
# `check-fingerprint.cjs "$DRAWIO"`, this very script resolving `$DRAWIO` — has
# no flag after it and does not match. That is the same scar `clean-render.sh`
# already names for `pkill -f`: the pattern without a trailing flag also
# matches whoever merely received the path as an argument, and killed the
# CALLER instead of the render.
#
# ⚠️ THAT IS THE WHOLE ANSWER TO "does detection count the current execution's
# own processes" — it does not, and not because anything here filters a PID
# out. `tests/run.sh` calls this script as the LITERAL FIRST LINE of layer 7 —
# before its own render-contract proofs, `check-render-verdict.cjs` included,
# which genuinely drives `xvfb-run`. Nothing above that line has rendered
# anything, so the pattern only matches a render IN PROGRESS, and there is no
# such thing yet for THIS run to match. Whatever it finds is, by construction,
# somebody else's.
set -uo pipefail

# Same resolution order `render.sh` and `tests/run.sh` already use — this file
# has no argument slot of its own, only the env var the suite exports.
DRAWIO="${DRAWIO:-$HOME/.local/opt/drawio/squashfs-root/drawio}"

found=""

xvfb="$(pgrep -a Xvfb 2>/dev/null | grep -F 'xvfb-run')"
[ -n "$xvfb" ] && found="${found}${xvfb}"$'\n'

drawio="$(pgrep -af "${DRAWIO} -" 2>/dev/null)"
[ -n "$drawio" ] && found="${found}${drawio}"$'\n'

[ -z "$found" ] && exit 0
printf '%s' "$found"
exit 1
