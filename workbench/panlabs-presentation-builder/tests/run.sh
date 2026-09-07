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
# learned about measuring a rendered page is one command away, still:
#
#   git log --diff-filter=D -1 -p -- \
#     workbench/panlabs-presentation-builder/tests/check-render.cjs
#
# #209 READ IT BEFORE WRITING gate/render.cjs, AND THREE THINGS SURVIVED
# VERBATIM: the CDP client itself (already living in the skill as
# `gate/cdp.cjs` since #208), the network watch over CDP, and the platform-
# font read (`CSS.getPlatformFontsForNode`, the one thing page JS cannot
# answer on its own). Box overflow is NOT the old per-chart pixel bleed --
# v2 has no chart yet (#213), so it is a straight rect comparison against the
# stage's own edges, in CSS pixels, over every leaf of real text. The other
# four families the v1 measured (legibility contrast, surface inversion,
# line-count outliers, stacking order) have no v2 equivalent: the current
# engine doesn't yet have the constructs they were measuring (a card grid, a
# decorative layer), and inventing a ruler for a shape that does not exist
# yet is exactly the shape of check the workbench doctrine refuses.
#
# THE ORDER OF THE LAYERS IS THE ORDER IN WHICH ONE FAILURE INVALIDATES THE
# ONES THAT FOLLOW.
#
#   0  THE RULERS PROVE THEY MEASURE   the compiler's audit and its refusals
#                                      plant their own defects and demand
#                                      red, with the message asserted, plus
#                                      the one case that demands green
#                                      because a check can also be wrong by
#                                      firing. A check only ever seen green
#                                      is documentation, so this runs BEFORE
#                                      any green underneath it is worth
#                                      anything.
#   1  THE TREE                        every source under `examples/` builds
#                                      through the DOCUMENTED command, into a
#                                      temp directory. Everything a later
#                                      layer measures is the bytes this one
#                                      wrote.
#   2  THE RENDER GATE                 `gate/render.cjs`'s own checks prove
#                                      they measure (plant, red, message,
#                                      green, same standard as layer 0's),
#                                      then every file layer 1 built is
#                                      handed to the gate itself. Chromium-
#                                      dependent, unlike 0 and 1 -- a machine
#                                      with none still reaches green here,
#                                      because the gate degrades to a NAMED
#                                      SKIP rather than failing (the ticket's
#                                      own words: "réguas degradam para SKIP
#                                      nomeado quando não há Chromium").
#   3  THE REGISTER IS THE ONE SOURCE   `CATALOG.md` is generated from
#                                       `compiler/catalog.py`, and the model
#                                       reads the generated copy. The proof
#                                       plants a drift into a copy of the
#                                       document and demands red; then the
#                                       documented `--check` runs over the
#                                       real one. It comes AFTER the corpus
#                                       because a compiler that cannot build
#                                       makes the question of what its
#                                       reference says academic.
#
# ⚠️ SPEC #207 PUTS THE REGISTER/REFERENCE EQUALITY AT THE FRONT DOOR ("a porta
# de entrada cobra igualdade entre registro e referência publicada"), which is
# the second of its three costuras. That seam is #218's and does not exist in
# the v2 yet, so the check lands here as its own layer rather than waiting for
# a file nobody has written -- and #218 is free to absorb it when the front
# door arrives, which is one step to delete, not a rule to rediscover.
#
# ⚠️ THE TICKET THAT ADDED LAYER 2 (#209) SAID "camada quatro" IN ITS OWN
# ACCEPTANCE CRITERIA. Read literally that would leave layers 2 and 3 empty
# on purpose, for tickets that had not landed yet -- but #209 is #208's very
# next in the serial queue (docs/agents/ § SPEC-207 "Ordem de execução"),
# nothing sits between them, and this file's own rule is APPEND AT THE END,
# not "leave a gap for a number a spec wrote before the queue ran." The
# render gate lands as 2, the next free slot, and this note is the reason a
# reader grepping the ticket for "camada quatro" does not go looking for a
# layer that was never going to exist.
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
step "every check the compiler makes proves it measures"  python3 "$HERE/check-audit.proof.py"

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
echo "════ layer 2 · the render gate ════"
# THE PROOF FIRST, layer 0's own rule one floor up: a render ruler only ever
# seen green is documentation same as a static one is.
step "every check the render gate makes proves it measures" \
  node "$HERE/check-render.proof.cjs" --corpus "$OUTPUT_DIR"

# THEN THE REAL CORPUS. This is a SECOND render pass over the files layer 1
# already built -- `compiler/build.py` itself calls `gate/render.cjs` after
# every successful write (#209), so a plain `build_corpus` run above already
# rendered each of them once. That call is best-effort and never touches
# `build.py`'s own exit code (a render defect must not block someone from
# getting the file they asked for); THIS step is the one place the render
# gate's own verdict is actually asserted pass/fail for the whole corpus,
# which is worth the second Chromium launch per file for what it buys: layer
# 1 stays a claim about the compiler alone, and this layer's failure means
# only one thing broke.
render_corpus() {
  local n=0 bad=0 file
  for file in "$OUTPUT_DIR"/*.html; do
    [ -e "$file" ] || break
    n=$((n + 1))
    node "$SKILL/gate/render.cjs" "$file" --out "$OUTPUT_DIR" || bad=$((bad + 1))
  done
  if [ "$n" -eq 0 ]; then
    echo "   ✗ no built .html in $OUTPUT_DIR — layer 1 must run first"
    return 1
  fi
  if [ "$bad" -ne 0 ]; then
    echo "   ✗ $bad of $n built example(s) failed the render gate"
    return 1
  fi
  echo "   ✓ $n built example(s) passed the render gate"
}
step "every built example passes the render gate over the corpus"  render_corpus

echo
echo "════ layer 3 · the register is the one source ════"
# THE PROOF FIRST, layer 0's rule again: the drift check has to know how to be
# red before its green means the document is in step.
step "the drift check between register and reference proves it measures" \
  python3 "$HERE/check-catalog.proof.py"

# THEN THE DOCUMENTED COMMAND over the real document. `--check` is what a
# session runs after touching the register, and it is the one thing standing
# between a pattern that changed and a model still reading last week's table.
step "CATALOG.md publishes the register, line for line" \
  python3 "$SKILL/compiler/catalog.py" --check

echo
if [ "$failed" -ne 0 ]; then
  echo "SUITE RED — ${#REDS[@]} step(s):"
  for v in "${REDS[@]}"; do echo "  · $v"; done
  exit 1
fi
echo "suite green — the audit knows how to be red, the corpus builds, the render gate holds, and the reference is the register."
