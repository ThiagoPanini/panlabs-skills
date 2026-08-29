#!/usr/bin/env bash
# The ruler of `panlabs-presentation-builder`.
#
#   workbench/panlabs-presentation-builder/tests/run.sh
#
# THE SUITE DOES NOT LIVE INSIDE THE SKILL, and the reason is #44's: this
# suite and the corpus it eats are read and run by whoever MAINTAINS the
# skill, never by whoever EXECUTES it, and the tree that gets installed
# should not carry their weight. It points INTO
# skills/panlabs-presentation-builder/ — the only direction a reference from
# here is allowed to travel. The sibling suite in
# `workbench/panlabs-aws-diagrams/tests/run.sh` is the template for the
# shape; nothing is shared between them but the shape.
#
# ⚠️ NO MACHINE RUNS THIS. `.github/workflows/skills.yml` runs
# `scripts/check-skills.sh` and its proof, and nothing else — that is the
# whole of what ADR 0001 made a gate, deliberately. This suite is session
# discipline: whoever lands a change under `skills/panlabs-presentation-builder/`
# runs it first, against the result of the rebase, exactly as
# `docs/agents/workflow.md` § A aterrissagem asks. Saying "the repository
# keeps running it" would promise a server that does not exist.
#
# THE ORDER OF THE LAYERS IS THE ORDER IN WHICH ONE FAILURE INVALIDATES THE
# ONES THAT FOLLOW.
#
#   0  THE RULERS PROVE THEY MEASURE   both checks below plant their own
#                                      defects and demand red, with the
#                                      message asserted. A check only ever
#                                      seen green is documentation, so this
#                                      runs BEFORE either one is trusted as a
#                                      ruler — every green underneath it is
#                                      worth exactly what this layer says it
#                                      is. Neither proof writes to the tree:
#                                      both plant in memory.
#   1  THE TREE                        the skeleton on disk is the frozen
#                                      one, byte for byte, and the corpus
#                                      builds through the DOCUMENTED command.
#                                      If the skeleton drifted, layer 2 is
#                                      green about a different engine.
#   2  THE ARCHITECTURE                the six families of #97/#120, against
#                                      the bytes layer 1 actually wrote.
#   3  THE STATIC GATE                 the nine families of #93/#156 — bytes
#                                      only, no browser — against the same
#                                      bytes layer 1 wrote.
#   4  THE RENDER GATE                 the ten families of #93/#157 — a real
#                                      headless Chromium, against the same
#                                      bytes layer 1 wrote. Degrades to a
#                                      named SKIP (not a red) where no
#                                      Chromium is on the machine running it.
#
# ⚠️ THIS FILE IS A REGISTRY, AND REGISTRIES HERE ARE APPEND-ONLY
# (CLAUDE.md § Registro é append-only). #156 (the static gate, nine families)
# and #157 (the render gate, over a headless browser) each add a LAYER AT THE
# END. Never in the middle, never reordering: two appends at the tail of the
# same section collide as text and the git refuses them, which costs thirty
# seconds; two edits scattered through the middle merge green and produce an
# order nobody chose.
#
# ⚠️ `scripts/check-skills.sh` IS DELIBERATELY NOT INVOKED HERE. It is a
# required check on `main` and runs on every push and every pull request
# (ADR 0001), so calling it again from here would buy nothing and add a
# second place the same rule is spent. What it measures — frontmatter,
# internal references, weight — is not what this suite measures, which is
# whether the engine still holds.
set -uo pipefail

# A RULER LEAVES NO TRACE ON ITS SUBJECT. Every check here already refuses to
# write bytecode, but layer 1 runs the skill's OWN documented command, and
# `build.py` importing `register` drops `engine/__pycache__/` inside the tree
# that gets installed. Git ignores it; that is not the point — running the
# ruler must not change what the ruler measures.
export PYTHONDONTWRITEBYTECODE=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL="$(cd "$HERE/../../../skills/panlabs-presentation-builder" && pwd)" || {
  echo "the skill tree is not where this suite expects it — nothing to measure"
  exit 1
}

# The built corpus is never versioned: it is derived, it is regenerated on
# every run, and a committed copy of it would be one more thing to keep in
# step with an engine that changed.
#
# ⚠️ THE GUARD IS NOT DECORATION. `set -u` does not fire on a variable that
# was assigned and came out EMPTY, so a failing `mktemp` would leave
# OUTPUT_DIR="" and the run would carry on — building into the working
# directory and handing layer 2 an empty `--corpus`. The gate now refuses
# that flag outright, and this refuses it one step earlier, where the reason
# is still legible.
OUTPUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/panlabs-presentation-builder.XXXXXX")"
if [ -z "$OUTPUT_DIR" ] || [ ! -d "$OUTPUT_DIR" ]; then
  echo "could not make a temp directory for the built corpus — suite refused"
  exit 1
fi
trap 'rm -rf "$OUTPUT_DIR"' EXIT

failed=0
declare -a REDS=()

step() {
  local title="$1"; shift
  printf '\n── %s\n' "$title"
  if "$@"; then :; else failed=1; REDS+=("$title"); echo "   ✗ RED"; fi
}

echo "════ layer 0 · the rulers prove they measure ════"
step "the freeze goes red on a drifted skeleton"  python3 "$HERE/check-skeleton-frozen.proof.py"
step "the six families each go red on a planted defect"  python3 "$HERE/check-architecture.proof.py"

echo
echo "════ layer 1 · the tree ════"
step "the skeleton on disk is the frozen one"  python3 "$HERE/check-skeleton-frozen.py"
# THE DOCUMENTED COMMAND, and not `import build`. `SKILL.md` tells the reader
# to run `python3 build.py <argument> <output>`; if that path is broken, a
# suite that calls the library instead is green about a skill nobody can run.
#
# `$SKILL` and `$OUTPUT_DIR` reach the subshell through the ENVIRONMENT and
# not through nested quoting. The sibling suite interpolates them into the
# `bash -c` string, which works only for as long as no path on the way here
# has a space in it — a latent bug that fires on a checkout somebody made
# under "My Documents", and reads as a mangled shell error rather than as
# what it is.
#
# ⚠️ IT BUILDS THEM ALL BEFORE FAILING. Returning on the first refusal would
# leave the survivors on disk and hand layer 2 a PARTIAL corpus — green over
# less than exists, which reads exactly like green over everything. The gate
# refuses a partial corpus of its own accord now; building the rest anyway is
# what turns one red into the whole list of what is broken.
build_corpus() {
  local n=0 bad=0 a name
  for a in "$SKILL"/examples/*.json; do
    [ -e "$a" ] || break
    name="$(basename "$a" .json)"
    if python3 "$SKILL/engine/build.py" "$a" "$OUTPUT_DIR/$name.html"; then
      n=$((n + 1))
    else
      bad=$((bad + 1))
    fi
  done
  if [ "$((n + bad))" -eq 0 ]; then
    echo "   ✗ examples/ has no argument to build — the corpus every family"
    echo "     below reads is empty, and an empty corpus is a green that"
    echo "     measured nothing. Add an argument under examples/"
    return 1
  fi
  if [ "$bad" -ne 0 ]; then
    echo "   ✗ $bad of $((n + bad)) argument(s) refused — fix what the"
    echo "     builder named above; layer 2 will not measure a partial corpus"
    return 1
  fi
  echo "   ✓ $n argument(s) built into a temp directory"
}
step "every argument in examples/ builds" build_corpus

echo
echo "════ layer 2 · the architecture ════"
# --corpus points at what layer 1 WROTE, not at a rebuild. The gate can build
# the corpus itself — that is how a maintainer runs it by hand — but inside
# the suite it reads the bytes that reached disk, so the artifact the skill
# actually produces is the one being measured.
step "the six families hold (#97/#120)"  python3 "$HERE/check-architecture.py" --corpus "$OUTPUT_DIR"

echo
echo "════ layer 3 · the static gate ════"
# The nine families prove themselves here rather than up in layer 0, because
# they are this layer's own rulers and layer 0 is already spent on the two
# that came before them — a shared layer edited to say "three" instead of
# "both" is the silent-reorder failure the append-only note above refuses.
step "the nine families each go red on a planted defect"  python3 "$HERE/check-static.proof.py"
step "the nine families hold (#93)"  python3 "$HERE/check-static.py" --corpus "$OUTPUT_DIR"

echo
echo "════ layer 4 · the render gate ════"
# The ten families prove themselves here, in their own layer, for the same
# reason layer 3's did: layer 0 belongs to the two rulers everything else
# stands on, and a shared layer edited to add a third silently reorders what
# came before it. Node, not python3 — `check-render.cjs` drives a real
# headless Chromium over CDP, which is why this suite carries a `.cjs` pair
# alongside every `.py` one rather than a subprocess wrapper around either.
step "the ten families each go red on a planted defect"  node "$HERE/check-render.proof.cjs" --corpus "$OUTPUT_DIR"
step "the ten families hold (#157)"  node "$HERE/check-render.cjs" --corpus "$OUTPUT_DIR"

echo
if [ "$failed" -ne 0 ]; then
  echo "SUITE RED — ${#REDS[@]} step(s):"
  for v in "${REDS[@]}"; do echo "  · $v"; done
  exit 1
fi
echo "suite green — the skeleton is the frozen one, and it did not derive."
