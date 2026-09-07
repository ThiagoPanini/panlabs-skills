#!/usr/bin/env bash
# The ruler of `panlabs-presentation-builder`.
#
#   workbench/panlabs-presentation-builder/tests/run.sh
#
# THE SUITE DOES NOT LIVE INSIDE THE SKILL, and the reason is #44's: this
# suite and the corpus it eats are read and run by whoever MAINTAINS the
# skill, never by whoever EXECUTES it, and the tree that gets installed
# should not carry their weight. It points INTO
# skills/panlabs-presentation-builder/ -- the only direction a reference from
# here is allowed to travel. The sibling suite in
# `workbench/panlabs-aws-diagrams/tests/run.sh` is the template for the
# shape; nothing is shared between them but the shape.
#
# ⚠️ NO MACHINE RUNS THIS. `.github/workflows/skills.yml` runs
# `scripts/check-skills.sh` and its proof, and nothing else -- that is the
# whole of what ADR 0001 made a gate, deliberately. This suite is session
# discipline: whoever lands a change under `skills/panlabs-presentation-builder/`
# runs it first, against the result of the rebase, exactly as
# `docs/agents/workflow.md` § A aterrissagem asks. Saying "the repository
# keeps running it" would promise a server that does not exist.
#
# ⚠️ THIS FILE WAS REBORN WITH THE v2 (#208), AND THE v1's SUITE IS IN THE
# HISTORY, NOT IN THE TREE. Six layers measured an engine that no longer
# exists; keeping them would have kept a green about nothing. What the v1
# learned about measuring a rendered page -- the network watch over CDP, the
# font that actually painted, the clipping measured in pixels -- is one
# command away and worth reading before #209 writes the render gate again:
#
#   git log --diff-filter=D -1 -p -- \
#     workbench/panlabs-presentation-builder/tests/check-render.cjs
#
# THE ORDER OF THE LAYERS IS THE ORDER IN WHICH ONE FAILURE INVALIDATES THE
# ONES THAT FOLLOW.
#
#   0  THE RULERS PROVE THEY MEASURE   the compiler's audit plants its own
#                                      defects and demands red, with the
#                                      message asserted. A check only ever
#                                      seen green is documentation, so this
#                                      runs BEFORE any green underneath it is
#                                      worth anything.
#   1  THE TREE                        every source under `examples/` builds
#                                      through the DOCUMENTED command, into a
#                                      temp directory. Everything a later
#                                      layer measures is the bytes this one
#                                      wrote.
#
# ⚠️ THIS FILE IS A REGISTRY, AND REGISTRIES HERE ARE APPEND-ONLY
# (CLAUDE.md § Registro é append-only). The render gate, the doctrine rulers
# and the front door each add a LAYER AT THE END. Never in the middle, never
# reordering: two appends at the tail of the same section collide as text and
# the git refuses them, which costs thirty seconds; two edits scattered
# through the middle merge green and produce an order nobody chose.
#
# ⚠️ `scripts/check-skills.sh` IS DELIBERATELY NOT INVOKED HERE. It is a
# required check on `main` and runs on every push and every pull request
# (ADR 0001), so calling it again from here would buy nothing and add a
# second place the same rule is spent. What it measures -- frontmatter,
# internal references, weight -- is not what this suite measures, which is
# whether the compiler still holds.
set -uo pipefail

# A RULER LEAVES NO TRACE ON ITS SUBJECT. Layer 1 runs the skill's OWN
# documented command, and `build.py` importing its siblings drops
# `compiler/__pycache__/` inside the tree that gets installed. Git ignores it;
# that is not the point -- running the ruler must not change what the ruler
# measures.
export PYTHONDONTWRITEBYTECODE=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL="$(cd "$HERE/../../../skills/panlabs-presentation-builder" && pwd)" || {
  echo "the skill tree is not where this suite expects it — nothing to measure"
  exit 1
}

# The built corpus is never versioned: it is derived, it is regenerated on
# every run, and a committed copy of it would be one more thing to keep in
# step with a compiler that changed.
#
# ⚠️ THE GUARD IS NOT DECORATION. `set -u` does not fire on a variable that
# was assigned and came out EMPTY, so a failing `mktemp` would leave
# OUTPUT_DIR="" and the run would carry on, building into the working
# directory and handing every later layer an empty corpus to be green about.
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
step "the vocabulary ruler goes red on each planted defect"  python3 "$HERE/check-audit.proof.py"

echo
echo "════ layer 1 · the tree ════"
# THE DOCUMENTED COMMAND, and not `import build`. `SKILL.md` tells the reader
# to run `python3 compiler/build.py <source> <output>`; if that path is
# broken, a suite that called the library instead is green about a skill
# nobody can run.
#
# `$SKILL` and `$OUTPUT_DIR` reach the loop through the ENVIRONMENT and not
# through nested quoting, so a checkout somebody made under "My Documents"
# still measures instead of reading as a mangled shell error.
#
# ⚠️ IT BUILDS THEM ALL BEFORE FAILING. Returning on the first refusal would
# leave the survivors on disk and hand every later layer a PARTIAL corpus --
# green over less than exists, which reads exactly like green over
# everything. Building the rest anyway is what turns one red into the whole
# list of what is broken.
build_corpus() {
  local n=0 bad=0 src name
  for src in "$SKILL"/examples/*.deck.html; do
    [ -e "$src" ] || break
    name="$(basename "$src" .deck.html)"
    if python3 "$SKILL/compiler/build.py" "$src" "$OUTPUT_DIR/$name.html"; then
      n=$((n + 1))
    else
      bad=$((bad + 1))
    fi
  done
  if [ "$((n + bad))" -eq 0 ]; then
    echo "   ✗ examples/ has no source to build — the corpus every family"
    echo "     below reads is empty, and an empty corpus is a green that"
    echo "     measured nothing. Add a source under examples/"
    return 1
  fi
  if [ "$bad" -ne 0 ]; then
    echo "   ✗ $bad of $((n + bad)) source(s) refused — fix what the compiler"
    echo "     named above; no later layer will measure a partial corpus"
    return 1
  fi
  echo "   ✓ $n source(s) built into a temp directory"
}
step "every source in examples/ builds through the documented command"  build_corpus

echo
if [ "$failed" -ne 0 ]; then
  echo "SUITE RED — ${#REDS[@]} step(s):"
  for v in "${REDS[@]}"; do echo "  · $v"; done
  exit 1
fi
echo "suite green — the audit knows how to be red, and the corpus builds."
