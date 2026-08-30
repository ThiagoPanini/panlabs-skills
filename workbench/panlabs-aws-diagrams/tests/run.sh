#!/usr/bin/env bash
# The ruler of the production tree — the UNION of suites that had never run together.
#
#   workbench/panlabs-aws-diagrams/tests/run.sh [drawio-binary]
#
# Moved out of the skill's own tree in #44 — this suite and the corpus it eats
# are read and run by whoever MAINTAINS the skill, never by whoever EXECUTES
# it. It points INTO skills/panlabs-aws-diagrams/ (the only direction a
# reference here is allowed to travel); this repository keeps running it.
#
# #23 was born from a sentence: *"both suites are green, each against its own
# engine; nobody ran the union"*. This file is the union, and the order of the
# layers is the order in which one failure invalidates the ones that follow.
#
#   0  THE TREE       the contract is unique, nothing here reaches `prototypes/`, and
#                    the package fits under the 30 MB ceiling. If this fails, every green
#                    below may be measuring the prototype — or unable to ship.
#   1  THE BOUNDARY   the agent has nowhere to write a coordinate — not in the model,
#                    not in the session model. It's the invariant the whole engine
#                    defends; if it leaked, the rest is guarding a dead rule.
#   2  THE VALIDATOR  index, primitives, and the planted defects. The validator has
#                    to PROVE it measures before being used as a ruler.
#   3  THE ENGINE     validation, determinism, network layer, triggers, traversal.
#   4  THE THEME      closed vocabulary, paint×metric partition, the contrast
#                    gate, and the four styles from #12 coming out of tokens.
#   5  THE GEOMETRY   the gate from #18 over the whole corpus, and the routing
#                    budget from #24 (A5.5=0, A3.4=0, A3.5=0, A5.1 at ceiling).
#   6  THE SESSION    projection, manifest, fingerprint, and the dossier's privacy.
#   7  THE APP        round-trip through draw.io's own codec, and render. DEVELOPMENT
#                    DEPENDENCY (premise 8): without the binary, it warns and moves on.
#                    REFUSES instead of entering if another render is already on
#                    the machine (#141) — contention gets a name of its own.
#
# ⚠️ Two simultaneous headless draw.io exports HANG (finding from #13), and
# `timeout` kills `xvfb-run` but not its Electron children. That's why layer 7 is
# serial and never runs in parallel with anything.
#
# ⚠️ #128 stopped a HUNG render from leaking a whole Chromium and an Xvfb — it
# did nothing for two SUITES racing the same machine from a clean start, which
# is a different failure with the same symptom. #128's own measurement caught
# it directly: three sessions of this repository rendering at once, the
# `drawio` process count reaching 36, and one worktree's `render.sh` running in
# the very instant another worktree's round-trip failed on the same model.
#
# ⚠️ THE POLICY IS REFUSE (#141), AND HERE IS WHY.
#
# Four shapes were on the table: WARN (say who and proceed — the red keeps
# happening, only legibly now), WAIT (hold the layer until the machine clears
# — needs a ceiling of its own, or two suites deadlock each other), REFUSE
# (skip the layer and say why), and LOCK (a fixed-path lockfile — the only one
# that also catches a manual draw.io this suite never started, and the only
# one that has to reason about a lock orphaned by a killed process).
#
# REFUSE costs nothing this file doesn't already have: the missing-binary
# branch two paragraphs up is the exact same shape — a partial verdict with a
# named reason — and #128 already put a name on it, the contour of
# `run.sh /nonexistent/drawio`. WAIT and LOCK both buy something WARN and
# REFUSE don't (a suite that eventually finishes green; protection from a
# renderer that isn't this suite), at a cost this repository has nowhere to
# spend: one maintainer, one machine, and the question #141 exists to unblock
# — "was that red contention or the drawing" — is answered by REFUSE before a
# single render is spent, not after waiting on a busy machine or maintaining
# a lockfile's failure modes.
#
# `tools/detect-neighbor.sh` is the first thing layer 7 runs, before even its
# own render-contract proofs — see the reordering note at the head of the
# layer below. It does not fix the contention (two suites still can't both
# render at once); it stops the result from coming out as an unexplained red.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The suite moved out of the skill in #44, and it split ONE root into two:
# WORKBENCH is this sibling directory (models/, tests/, and — since #45 —
# tools/, theme/ and catalog/ for the bancada that isn't part of the agent's
# journey either); SKILL is the tree that gets installed. A path that used to
# be "$ROOT/models/x.json" is now "$WORKBENCH/models/x.json". `output/` did
# not move anywhere — #45 deleted it: it was scratch that happened to be
# tracked, and the ruler now writes the render corpus to OUTPUT_DIR, a real
# temp directory, below. `tools/render.sh` is the one bancada tool that did
# NOT move: `tools/case.cjs`'s `--image` flag calls it at runtime, so it stays
# in the skill, next to `drawio.cjs`, `install.sh` and `package.sh`.
WORKBENCH="$(dirname "$HERE")"
SKILL="$(cd "$HERE/../../../skills/panlabs-aws-diagrams" && pwd)"
SCRIPTS="$(cd "$HERE/../../../scripts" && pwd)"
# ⚠️ EXPORTED, and not just passed as an argument — the previous version passed the
# binary to two of the four layer-7 checks and the other two fell back to a
# DIFFERENT default (`AppRun` instead of `drawio`), possibly skipping silently
# while the layer reported itself as run. With `export`, the single resolver
# (`tools/drawio.cjs`) and `render.sh` inherit the same value.
DRAWIO="${1:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
export DRAWIO
# `generate-themes.cjs`/`generate-trap.cjs` moved to the workbench's own
# `tools/` in #45, alongside their models — MODELS_DIR is how they're told
# where to read from.
export MODELS_DIR="$WORKBENCH/models"
# The render corpus (#45): never versioned, so every step that used to write
# into "$SKILL/output/" now writes here instead, and every check that used to
# read from there reads OUTPUT_DIR.
OUTPUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/panlabs-aws-diagrams.XXXXXX")"
export OUTPUT_DIR
trap 'rm -rf "$OUTPUT_DIR"' EXIT
failed=0
declare -a REDS=()

step() {
  local title="$1"; shift
  printf '\n── %s\n' "$title"
  if "$@"; then :; else failed=1; REDS+=("$title"); echo "   ✗ RED"; fi
}

echo "════ layer 0 · the tree ════"
step "single contract (one \$id, one file)"        node "$HERE/check-single-schema.cjs"
step "model@1 × technical facet parity (#37)"   node "$HERE/check-technical-parity.cjs"
step "production doesn't reach prototypes/"           node "$HERE/check-no-prototype.cjs"
# The 30 MB ceiling is HARD and only shows up at upload time. Measuring it here is what
# stops the tree from creeping back to 29 MB without anyone noticing — that's where it was.
# Moved to the harness in #70/#45 — `tools/package.sh --check` still measures the same
# thing by hand, but this is the one the suite runs, so the rule is not written twice.
step "the package fits under the 30 MB ceiling"            "$SCRIPTS/checks/weight.sh" "$SKILL"
# The front door, which until #43 nothing measured: three turns, no documented
# command writing into this tree or reaching outside it, and /grilling named but
# never invoked. It plants its own defects first — a document checker earns the
# same proof layer 2 asks of the validator.
step "the journey document holds (#43)"                 node "$HERE/check-journey.cjs"
# The other end of the same document. `check-journey.cjs` measures the PATHS a
# documented command names; this measures the FIELD NAMES the prose promises.
# #53 converted every contract key to English and `guide/model.md` kept teaching
# the old ones, green the whole way — a contract key has two ends, and until now
# only one of them was ruled.
step "the guide names the contract of today (#115/#123)"  node "$HERE/check-guide-contract.cjs"
# The THIRD end of the same rule, and the one no document can see. The two above
# rule prose against the contract; this one rules `.cjs` against `.cjs` — a key
# one module writes and another reads, with no schema in between to disagree with.
# `briefing.cjs` asked `policy()` for `.glifo` while `open.cjs` returned `.glyph`,
# every page of the resume briefing printed `undefined` where the state glyph
# belongs, and all 43 checks stayed green: the suite measured what the briefing
# said, never the character it said it with.
step "every contract key answers on both ends (#125)"  node "$HERE/check-contract-ends.cjs"
# The skill inherits the host's module system (#133): the engine's only `.js`
# file used to read as ESM under a `"type": "module"` package.json anywhere up
# the caller's tree, and `new ELK()` threw with no clue why.
step "the engine is host-agnostic (#133)"                  node "$HERE/check-esm-host.cjs"
# The blind run's sandbox (#121) is measured here because nothing else measures
# it. Its proof shipped with no runner: not in this file, not in the conveyor —
# and it rotted inside a day, when #133 renamed the very file one of its cases
# borrowed. A proof nobody runs is the vacuous green this repository named and
# then built one of.
#
# ⚠️ It never touches the machine's own skill homes: every invocation inside it
# passes `--skill-home` into its own throwaway bench, which REPLACES the default
# pair rather than adding to it. Three seconds, no network, no draw.io.
step "the blind run's sandbox proves its isolation (#121)"  bash "$WORKBENCH/blind-run/blind-run.proof.sh"

echo
echo "════ layer 1 · the boundary ════"
step "model@1 has nowhere to write a coordinate"  node "$HERE/check-model-boundary.cjs"
step "neither does session@1"                        node "$HERE/check-session-boundary.cjs"

echo
echo "════ layer 2 · the validator proves it measures ════"
step "the index matches the rubric's 62"         node "$HERE/check-index.cjs"
step "the primitives match published values"    node "$HERE/check-primitives.cjs"
step "fails the 16 defects and clears the good one"     node "$HERE/check-broken.cjs"

echo
echo "════ layer 3 · the engine ════"
step "validation (fails what it should, and explains)"  node "$HERE/check-validation.cjs"
step "generation of the whole corpus"                  bash -c '
  for m in "'"$WORKBENCH"'"/models/*.json "'"$SKILL"'"/examples/*.json; do
    n="$(basename "$m" .json)"
    node "'"$SKILL"'/engine/generate.cjs" "$m" --output "'"$OUTPUT_DIR"'/$n.drawio" > /dev/null || exit 1
  done
  echo "   ✓ $(ls "'"$WORKBENCH"'"/models/*.json "'"$SKILL"'"/examples/*.json | wc -l) models generated"'
step "determinism (3 fronts, with reordering)"  node "$HERE/check-determinism.cjs"
step "network layer: order comes from content"    node "$HERE/check-layer.cjs"
step "the leaf box measures the label (#33)"        node "$HERE/check-leaf-box.cjs"
step "and it's what the file shows"               node "$HERE/check-node-file.cjs"
step "the rival candidate (distance from the edge)"     node "$HERE/check-jumps.cjs"
step "gap review: it fires AND stays quiet (#15)"   node "$HERE/check-gaps.cjs"
step "multi-account triggers (OR, mode, level)"  node "$HERE/check-triggers.cjs"
step "traversal: the decisions, in the file"         node "$HERE/check-traversal.cjs"
step "bisection (the tool that isolates)"         node "$WORKBENCH/tools/bisect-model.cjs" "$WORKBENCH/models/hub-tgw-3-accounts.json"
step "resource wins over qualifier on the leaf (#38)"   node "$HERE/check-resource-label.cjs"
step "the leaf queue centers in its final box (#40)"   node "$HERE/check-leaf-queue-center.cjs"
step "a colliding edge label slides along its edge (#40)"  node "$HERE/check-edge-label-collision.cjs"
step "a detail page's AZ grid draws the account as its root (#137)"  node "$HERE/check-detail-view-az.cjs"
step "a detail page draws a regional service beside its VPC as an outsider column (#190)"  node "$HERE/check-detail-view-outsiders.cjs"
step "a page past the ratio ceiling wraps into rows, or stays wide rather than lose an edge (#199)"  node "$HERE/check-page-wrap.cjs"

echo
echo "════ layer 4 · the theme ════"
step "the contrast gate knows how to fail"          node "$HERE/check-contrast-gate.cjs"
step "the normative layer is unspeakable"             node "$HERE/check-vocabulary.cjs"
step "partition: paint paints, metric measures"      node "$HERE/check-partition.cjs"
step "the 4 styles from #12 come out of tokens"          node "$HERE/check-tokens-of-12.cjs"
step "the gate fails the wrong theme"             bash -c '
  M="'"$WORKBENCH"'/models/orders-serverless.json"
  TRAP="'"$WORKBENCH"'/theme/trap.json"
  if node "'"$SKILL"'/engine/generate.cjs" "$M" --theme "$TRAP" --output /dev/null > /dev/null 2>&1; then
    echo "   ✗ the \"trap\" theme PASSED the gate"; exit 1
  fi
  echo "   ✓ \"trap\" failed without --force"
  if node "'"$SKILL"'/engine/generate.cjs" "$M" --theme "$TRAP" --force --output /dev/null > /dev/null 2>&1; then
    echo "   ✓ --force generates it anyway, so the damage can be seen"
  else
    echo "   ✗ --force did not generate — the escape valve broke"; exit 1
  fi'

echo
echo "════ layer 5 · the corpus geometry ════"
step "the gate blocks what lies and fits in between"  node "$HERE/check-geometry-gate.cjs"
step "the certified corpus (no open quarantine)"   node "$HERE/check-good.cjs"
step "the #24 routing budget"           node "$HERE/check-routing.cjs"
step "check-geometry.cjs accepts --theme (#33)"     node "$HERE/check-theme-geometry.cjs"
# ⚠️ THE PROOF BODY CHANGED IN #24, AND AGAIN IN #168 — same sentence twice.
#
# Up to here the gate was exercised against `web-flow-3-az`, which lied (`A5.5`
# ×2, the #24 quarantine). It stopped lying — and a test whose subject is a
# defect dies the day the defect is fixed. The subject became
# `models/refusal/lying-band.json`, made TO lie by a non-member the ELK path
# laid out between two real members — chosen because no ROUTING choice could
# undo it, the band's box being the UNION of its members by construction.
#
# #168 paid THAT debt too, but not through routing: `elkPlan` grew the same
# swallow check `gridPlan` already had from #31, and the box DEGRADES to a
# loose label instead of lying. `lying-band.json` no longer lies either — it
# is now the #168 regression fixture, proving the ELK path degrades instead
# of drawing the box that used to trigger F1.
#
# ⚠️ And `F1`/`F2` are OUTSIDE the 62 on purpose (#18), so this step alone
# would not prove that a family FROM THE RUBRIC blocks. What proves that is the step above:
# `check-geometry-gate.cjs` runs `A4.2`, `A4.4`, `A5.5`, `F1` and `F2` — the
# FIVE zero-tolerance ones —, each against its planted case, and requires the
# message to name the check. The split is: THERE the gate proves it blocks each
# family; HERE the engine proves it calls the gate and obeys the level — and as
# of #168 there is no model left that triggers ANY zero-tolerance family end to
# end (`A5.5` and `F2` already produced none before this; `F1` now joins them).
# That absence is itself the measure of #168: the ELK path used to be the one
# place a truthful model's OWN band could make the drawing lie, with nothing
# reserving space for it the way the grid's lanes do — now nothing does.
step "and the gate is GRAFTED into the engine"         bash -c '
  G="'"$SKILL"'/engine/generate.cjs"
  M="'"$WORKBENCH"'/models/refusal/lying-band.json"
  # #168: the band that used to lie now degrades — nothing left for
  # "truthfulness" to refuse here (see check-geometry-gate.cjs for the
  # per-family proof, unaffected: it exercises F1 against a planted scene).
  node "$G" "$M" --gate truthfulness --output /dev/null > /dev/null 2>&1 \
    && echo "   ✓ --gate truthfulness lets the degraded band through (#168)" \
    || { echo "   ✗ the degraded band still gets refused — #168 regressed"; exit 1; }
  # and the control: the same level lets through one that never lied
  node "$G" "'"$SKILL"'/examples/web-multi-az.json" --gate truthfulness --output /dev/null > /dev/null 2>&1 \
    && echo "   ✓ and lets through the one that does not lie" \
    || { echo "   ✗ refused a drawing that does not lie"; exit 1; }
  # without a gate, the band still draws — as a label now, with no lie left to warn about
  if node "$G" "$M" --output /dev/null 2>&1 | grep -q "⛔ F1"; then
    echo "   ✗ the band still warns of a semantic lie — #168 regressed"; exit 1
  fi
  echo "   ✓ and without a gate it degrades quietly — there is no lie to warn about (#168)"'

echo
echo "════ layer 6 · the session ════"
step "the production engine's manifest"           node "$HERE/check-engine-untouched.cjs"
step "the projection, with 12 control mutations"    node "$HERE/check-projection.cjs"
step "step 5 — the logical view, approved"        node "$SKILL/tools/approve.cjs" "$SKILL/examples/session/retail-logical.json" --at 2026-08-21 --output "$OUTPUT_DIR/retail.drawio"
step "steps 1 and 6 — resume and technical view"   node "$SKILL/tools/resume.cjs" "$OUTPUT_DIR/retail.drawio" --delta "$SKILL/examples/session/retail-elaboration.json"
step "the arc end to end, on a new case (#26)"  node "$HERE/check-arc.cjs"
step "the dossier's privacy"                    node "$HERE/check-dossier.cjs"
step "the case verb writes at the caller's root (#41)"  node "$HERE/check-case.cjs"
step "a finding can target an edge, not just a node (#197)"  node "$HERE/check-finding-target.cjs"
step "the normal path validates, publishes and resumes with no agreement (#198)"  node "$HERE/check-normal-path.cjs"

echo
echo "════ layer 7 · the app (development dependency) ════"
# ⚠️ DETECTION RUNS FIRST — THE LITERAL FIRST LINE OF THE LAYER, BEFORE EVEN
# ITS OWN RENDER-CONTRACT PROOFS. The policy (REFUSE) and why it beat WARN,
# WAIT and LOCK are argued in the file header, above `set -uo pipefail`; this
# is only the mechanics.
#
# `tools/detect-neighbor.sh`'s own self-exclusion argument depends on this
# exact position: nothing in THIS execution has started a real render yet,
# because nothing above this line does one — not layer 0-6, and, now, not
# even the three proofs right below. Compute it any later — after
# `check-render-verdict.cjs`, say, which genuinely drives `xvfb-run` to test
# `render.sh`'s own hang-kill contract — and the claim would quietly start
# depending on that check cleaning up after itself, instead of standing on
# its own.
NEIGHBOR="$("$WORKBENCH/tools/detect-neighbor.sh")"
NEIGHBOR_STATUS=$?

# ⚠️ ALL THREE STEPS BELOW RUN NEXT, NEEDING NEITHER draw.io NOR A CLEAR
# MACHINE — this is the reordering #128 named as a debt and #141 pays.
#
# `render.sh`'s contract is what every render step in this layer, and the
# layer-3 bisection, call — and this file's own rule is "the order of the
# layers is the order in which one failure invalidates the ones that follow",
# so its proof belongs before the renders it backs, not after them. #128
# could not pay that cost alone: a registry in this repo is append-only
# (CLAUDE.md § Registro é append-only), and a line inserted in the middle
# merges green against a parallel branch and yields an order nobody chose. It
# named the debt instead of hiding it: "moving it is a ticket of its own."
#
# #141 has to pay the SAME cost for a second reason: a neighbor gate that ran
# AFTER the real renders below had already started would be too late to
# refuse them. Paying the reordering once, for all three steps, is cheaper
# than paying it twice — and #144 landed a THIRD step in this same tail spot
# while this ticket was in flight, reasoning identically in its own comment
# ("this needs no draw.io either... the same append-only rule keeps it here
# instead of next to the four checks it is about"). The rebase that met that
# step is what carries it up here too, rather than leaving it stranded alone
# at the tail once its neighbor moved.
step "render.sh names who ended the process (#128)"  node "$HERE/check-render-verdict.cjs"
step "the four render.sh callers add no retry, no unscoped kill (#144)"  node "$HERE/check-render-callers.cjs"
step "detect-neighbor.sh finds a planted neighbor (#141)"  node "$HERE/check-detect-neighbor.cjs"

if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless not found at $DRAWIO — layer 7 skipped."
  echo "   (development dependency: draw.io Desktop AppImage + xvfb;"
  echo "    tools/drawio.cjs is the one that knows where the binary lives)"
elif [ "$NEIGHBOR_STATUS" -ne 0 ]; then
  echo "   another render is already on this machine — layer 7 refused (#141):"
  echo "$NEIGHBOR" | sed 's/^/     /'
  echo "   (contention, not a defect — retry once it clears)"
else
  step "fingerprint: 10 human edits × 3 schemas" node "$HERE/check-fingerprint.cjs" "$DRAWIO"
  step "model round-trip through the app's codec"     node "$HERE/check-roundtrip-model.cjs" "$DRAWIO"
  step "theme round-trip through the app's codec"       node "$HERE/check-roundtrip-theme.cjs" "$DRAWIO"
  step "session file round-trip"            node "$HERE/check-roundtrip-session.cjs" "$DRAWIO"

  # RENDER is the other half of the two-layer validation (premise 9), and the
  # order here is not accidental: first the corpus, then the theme variants,
  # and last the pixel — because pixel verification READS what render
  # wrote. Serial on purpose (finding from #13 about Electron concurrency).
  step "render the corpus" bash -c '
    "'"$WORKBENCH"'/tools/clean-render.sh" > /dev/null 2>&1 || true
    failed=0
    for d in "'"$OUTPUT_DIR"'"/*.drawio; do
      "'"$SKILL"'/tools/render.sh" "$d" "${d%.drawio}.png" || failed=1
    done
    exit $failed'
  # ⚠️ REGENERATED HERE, and not read from a versioned file.
  #
  # Until #29 `output/themes/*.drawio` was committed, and layer 7 rendered whatever
  # it found there. That put 6.7 MB of generated output inside the package the user
  # installs — and the official authoring convention is the opposite: eval output lives
  # in a sibling workspace. `output/` became an ignored scratch directory that stayed
  # tracked by accident anyway (three stray files, found and removed in #45) — the fix
  # was to stop having a versioned `output/` at all: OUTPUT_DIR is a real temp
  # directory, and whoever builds the variants has always known how to build them.
  # Measured: the regeneration comes out byte for byte identical to what was committed.
  step "the theme variants, rebuilt"        bash -c '
    node "'"$WORKBENCH"'/tools/generate-themes.cjs" > /dev/null && node "'"$WORKBENCH"'/tools/generate-trap.cjs" > /dev/null
    n=$(ls "'"$OUTPUT_DIR"'"/themes/*.drawio | wc -l)
    [ "$n" -ge 7 ] && echo "   ✓ $n variant(s)" || { echo "   ✗ only $n variant(s)"; exit 1; }'
  step "render the theme variants" bash -c '
    "'"$WORKBENCH"'/tools/clean-render.sh" > /dev/null 2>&1 || true
    failed=0
    for d in "'"$OUTPUT_DIR"'"/themes/*.drawio; do
      name="$(basename "$d" .drawio)"
      # the animated one is only visible in SVG — #4 measured that its PNG turns into a
      # STATIC dashed line with no error, and a PNG here would be false proof
      if [ "$name" = "f-animated-flow" ]; then
        "'"$SKILL"'/tools/render.sh" "$d" "${d%.drawio}.svg" svg || failed=1
        grep -q "ge-flow-animation" "${d%.drawio}.svg" || { echo "   ✗ $name has no animation in the SVG"; failed=1; }
        continue
      fi
      "'"$SKILL"'/tools/render.sh" "$d" "${d%.drawio}.png" || failed=1
    done
    exit $failed'
  if command -v python3 > /dev/null && python3 -c "import PIL" 2>/dev/null; then
    step "the theme landed on the PIXEL (the lesson from #17)"  python3 "$WORKBENCH/tools/verify-theme.py" --all "$OUTPUT_DIR/themes"
  else
    echo "   Pillow missing — pixel verification skipped."
  fi
  step "the case verb's image, with the binary (#41)"  node "$HERE/check-case.cjs" "$DRAWIO"
fi

echo
if [ "$failed" -ne 0 ]; then
  echo "SUITE RED — ${#REDS[@]} layer(s):"
  for v in "${REDS[@]}"; do echo "  · $v"; done
  exit 1
fi
echo "suite green — the union runs, and it runs against a single engine."
