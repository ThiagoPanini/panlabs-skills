#!/usr/bin/env bash
# Renders one .drawio, silencing WSL2's dbus noise and failing fast.
#
#   tools/render.sh input.drawio output.png [format]
#
# ⚠️ THE EXIT CODE ANSWERS ONE QUESTION — WHO ENDED THE PROCESS — AND THAT IS
# THE WHOLE POINT OF #128.
#
#   0  it rendered
#   1  draw.io READ the file and REFUSED it — the DRAWING is the problem
#   3  the headless binary is not installed
#   4  the render never answered — every attempt hung and had to be killed
#
# Until #128 everything that was not a success came out as `1`, and the callers
# had no way to tell the two apart: `bisect-model.cjs` printed the same
# `✗ FAILED` for a diagram draw.io rejects and for a compositor that died on a
# file it had already rendered nineteen times in a row.
#
# Four things here are not diligence, they are scars:
#
# 1. THE TIMEOUT. When headless Chromium raises `UnknownVizError`, draw.io does
#    not exit: the error becomes an `UnhandledPromiseRejection` and the binary
#    hangs forever. With no timeout, one render failure freezes the suite.
#
#    `UnknownVizError` is not draw.io's — it lives in the Electron binary,
#    between `GPUOutOfMemoryError` and `UnrecoverableAccessibilityError`. It is
#    Chromium's compositing process (`viz`) going away, and nothing about the
#    file causes it: #128 measured the SAME bytes coming out as a byte-identical
#    PNG nineteen times out of twenty.
#
# 2. NO `setsid` — and it used to be here, for a reason that was right and an
#    effect that was exactly backwards. `timeout`, without `--foreground`, puts
#    ITSELF in a fresh process group and signals that group as well as the
#    monitored PID. `setsid` moved the render into a NEW session and group, so
#    the group signal landed on a group holding only `timeout`, and the direct
#    signal landed on `xvfb-run` — a `/bin/sh` that dies without touching the
#    `drawio` it spawned. Measured in #128, same probe, same second: WITH
#    `setsid` a killed render left four processes alive and GREW to six two
#    seconds later; WITHOUT it, the tree was back to baseline. So every hang
#    used to leak a whole Chromium and an `Xvfb`, and after half a dozen of
#    those the machine saturates and GOOD FILES START FAILING — the feedback
#    loop that turned a 1-in-20 flake into a red suite one run in three.
#
# 3. ATTEMPTS, AND ONLY FOR THE NON-ANSWER. Retrying a verdict is blind
#    repetition; retrying a hang is the measurement that tells the two apart.
#    #128 measured both ends: the same bytes render 19 times out of 20 and hang
#    on the 20th, while a file draw.io genuinely refuses fails 3 times out of 3,
#    exits ON ITS OWN with code 1, and says `Error: Export failed`. A chosen
#    status is therefore a verdict and is never retried; anything else is a
#    non-answer and is.
#
#    ⚠️ AND THE CLOCK IS A SUSPECT, so the arithmetic is worth writing down. Three
#    attempts put the worst case at `LIMIT × ATTEMPTS` for one file, and #128's
#    own ticket records a suite run blowing a 590s ceiling. It still comes out
#    ahead: before scar 2 was fixed, a "killed" render was not killed — it kept
#    a whole Chromium burning CPU for the rest of the run, so the clock paid for
#    every hang forever instead of for `LIMIT` seconds. Two attempts would put
#    the suite's ~30 renders back at roughly one red in fifty; three put it at
#    one in two thousand, measured against the 2,5% per-render rate of #128.
#
# 4. A RETRY THAT SAVES A RENDER SAYS SO. A flake that is swallowed is a flake
#    nobody ever fixes, and a layer that quietly passes on the second try is
#    the same green-that-asserts-nothing this file already cost once.
set -uo pipefail

INPUT="$1"
OUTPUT="$2"
FORMAT="${3:-png}"
# the path has ONE owner: `tools/drawio.cjs`. Here, only the same resolution order.
DRAWIO="${DRAWIO:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
LIMIT="${LIMIT:-40}"
ATTEMPTS="${ATTEMPTS:-3}"

[ -x "$DRAWIO" ] || { echo "draw.io headless missing at $DRAWIO"; exit 3; }

extra=()
[ "$FORMAT" = png ] && extra=(-s 2)

# DID DRAW.IO ANSWER, OR DID SOMETHING END IT? Only 0–123 is a status the
# program CHOSE. From 124 up, the answer is somebody else's:
#
#   124, 125   `timeout` speaking — its deadline passed, or it failed to run
#   126, 127   the shell speaking — not executable, not found (no `xvfb-run`)
#   128+N      the kernel speaking — killed by signal N: our own SIGKILL at 137,
#              a segfault at 139, an OOM-killed child, a foreign sweep at 143
#
# ⚠️ THE FIRST VERSION OF THIS ASKED ONLY FOR 124 AND 137, and a code review
# found the hole: a stub that raised SIGSEGV came back as
# `REFUSED by draw.io (code 139) — the drawing`, sending the reader to debug a
# model over a dead compositor. The ticket's own measurements name `137` as
# "cheiro de memória"; an OOM that takes a CHILD rather than the wrapper lands
# here too. Asking who chose the number is the version with no hole in it.
answered() { [ "$1" -lt 124 ]; }

log_tail() { grep -vi 'dbus\|trace-warnings' | tail -5; }

# DO NOT try a safety net with `pkill -f "$(basename "$INPUT")"`: the file name
# appears on the command line of WHOEVER CALLED this script, and pkill kills the
# caller along with it. It cost a whole bisection in silence — the batch stopped
# at the third line with no error at all. Cleaning up leftovers is
# `clean-render.sh`'s job, and it knows how to tell ours apart.

attempt=1
hangs=0
while :; do
  rm -f "$OUTPUT"
  render_log="$(timeout --kill-after=5 --signal=TERM "$LIMIT" \
    xvfb-run -a "$DRAWIO" -x -f "$FORMAT" "${extra[@]}" \
    --no-sandbox --disable-gpu -o "$OUTPUT" "$INPUT" 2>&1)"
  code=$?

  if [ -s "$OUTPUT" ]; then
    flake=""
    [ "$hangs" -gt 0 ] && flake="   ⚠ draw.io did not answer $hangs× on these same bytes — attempt $attempt of $ATTEMPTS (#128)"
    echo "✓ $(basename "$OUTPUT")  $(stat -c %s "$OUTPUT") bytes$flake"
    exit 0
  fi

  if answered "$code"; then
    # draw.io chose this number. It read the file and said no — repeating that
    # is asking the same question twice and calling the second answer better.
    echo "✗ $(basename "$INPUT") REFUSED by draw.io (code $code) — the drawing"
    echo "$render_log" | log_tail
    exit 1
  fi

  hangs=$((hangs + 1))
  if [ "$attempt" -ge "$ATTEMPTS" ]; then
    echo "✗ $(basename "$INPUT") NEVER ANSWERED — $hangs attempt(s) ended without draw.io choosing a status (last: $code, deadline ${LIMIT}s) — the render, not the drawing"
    echo "$render_log" | log_tail
    exit 4
  fi
  echo "  … attempt $attempt did not answer (code $code, deadline ${LIMIT}s) — retrying"
  attempt=$((attempt + 1))
done
