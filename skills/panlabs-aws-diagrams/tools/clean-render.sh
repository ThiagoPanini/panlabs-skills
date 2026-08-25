#!/usr/bin/env bash
# Kills what an aborted render left behind, without touching an X server that is not ours.
#
# It exists because a hung `drawio` is NOT harmless: after half a dozen of them,
# files that used to render start failing, and the bisection blames the wrong
# file. Every render measurement in this prototype starts here.
set -uo pipefail

# The trailing `-` in the pattern is not decoration — it is the same scar that
# `render.sh` describes in prose and that this script still carried in code.
#
# `pkill -f` matches against the WHOLE command line, so the pattern without the
# `-` also matched anyone who merely RECEIVED the binary path as an argument:
# `./tests/run.sh /…/squashfs-root/drawio` is one of those. A suite calling
# another and passing the binary along killed the called suite mid-cleanup — it
# printed "suite green" and died of SIGKILL right after, and the caller's
# `pipefail` translated that into a red with not one line of error. Found while
# composing the #22 suite on top of the #12 one.
#
# A render process of ours ALWAYS has a flag after the path (`-x -f png …`, or
# `--type=…` on the Electron children). Whoever only carries the path as an
# argument, does not. That is the difference the pattern now demands.
pkill -9 -f 'squashfs-root/drawio -' 2>/dev/null || true

# only the Xvfb instances raised by xvfb-run (they carry -auth /tmp/xvfb-run.*);
# a pre-existing X server on the machine has no such flag and stays out
pgrep -a Xvfb 2>/dev/null | grep -F 'xvfb-run' | awk '{print $1}' | xargs -r kill -9 2>/dev/null || true

sleep 1
for lock in /tmp/.X*-lock; do
  [ -e "$lock" ] || continue
  n="${lock#/tmp/.X}"; n="${n%-lock}"
  pgrep -a Xvfb 2>/dev/null | grep -q ":$n " || rm -f "$lock"
done
rm -rf /tmp/xvfb-run.* 2>/dev/null || true

echo "xvfb alive: $(pgrep -c Xvfb 2>/dev/null || echo 0)   drawio alive: $(pgrep -cf 'squashfs-root/drawio' 2>/dev/null || echo 0)"
