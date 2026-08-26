#!/usr/bin/env bash
# The ruler of the production tree — the UNION of suites that had never run together.
#
#   ./tests/run.sh [drawio-binary]
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
#
# ⚠️ Two simultaneous headless draw.io exports HANG (finding from #13), and
# `timeout` kills `xvfb-run` but not its Electron children. That's why layer 7 is
# serial and never runs in parallel with anything.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
# ⚠️ EXPORTED, and not just passed as an argument — the previous version passed the
# binary to two of the four layer-7 checks and the other two fell back to a
# DIFFERENT default (`AppRun` instead of `drawio`), possibly skipping silently
# while the layer reported itself as run. With `export`, the single resolver
# (`tools/drawio.cjs`) and `render.sh` inherit the same value.
DRAWIO="${1:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
export DRAWIO
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
step "the package fits under the 30 MB ceiling"            "$ROOT/tools/package.sh" --check

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
  for m in "'"$ROOT"'"/models/*.json; do
    n="$(basename "$m" .json)"
    node "'"$ROOT"'/engine/generate.cjs" "$m" --output "'"$ROOT"'/output/$n.drawio" > /dev/null || exit 1
  done
  echo "   ✓ $(ls "'"$ROOT"'"/models/*.json | wc -l) models generated"'
step "determinism (3 fronts, with reordering)"  node "$HERE/check-determinism.cjs"
step "network layer: order comes from content"    node "$HERE/check-layer.cjs"
step "the leaf box measures the label (#33)"        node "$HERE/check-leaf-box.cjs"
step "and it's what the file shows"               node "$HERE/check-node-file.cjs"
step "the rival candidate (distance from the edge)"     node "$HERE/check-jumps.cjs"
step "gap review: it fires AND stays quiet (#15)"   node "$HERE/check-gaps.cjs"
step "multi-account triggers (OR, mode, level)"  node "$HERE/check-triggers.cjs"
step "traversal: the decisions, in the file"         node "$HERE/check-traversal.cjs"
step "bisection (the tool that isolates)"         node "$ROOT/tools/bisect-model.cjs" "$ROOT/models/hub-tgw-3-accounts.json"
step "resource wins over qualifier on the leaf (#38)"   node "$HERE/check-resource-label.cjs"

echo
echo "════ layer 4 · the theme ════"
step "the contrast gate knows how to fail"          node "$HERE/check-contrast-gate.cjs"
step "the normative layer is unspeakable"             node "$HERE/check-vocabulary.cjs"
step "partition: paint paints, metric measures"      node "$HERE/check-partition.cjs"
step "the 4 styles from #12 come out of tokens"          node "$HERE/check-tokens-of-12.cjs"
step "the gate fails the wrong theme"             bash -c '
  M="'"$ROOT"'/models/orders-serverless.json"
  if node "'"$ROOT"'/engine/generate.cjs" "$M" --theme trap --output /dev/null > /dev/null 2>&1; then
    echo "   ✗ the \"trap\" theme PASSED the gate"; exit 1
  fi
  echo "   ✓ \"trap\" failed without --force"
  if node "'"$ROOT"'/engine/generate.cjs" "$M" --theme trap --force --output /dev/null > /dev/null 2>&1; then
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
# ⚠️ THE PROOF BODY CHANGED IN #24, and the reason is that the ticket succeeded.
#
# Up to here the gate was exercised against `web-flow-3-az`, which lied (`A5.5`
# ×2, the #24 quarantine). It stopped lying — and a test whose subject is a
# defect dies the day the defect is fixed. The subject becomes
# `models/refusal/lying-band.json`, made TO lie and chosen for having
# no routing fix: the band's box is the UNION of its members, so a
# non-member laid out in the middle falls inside it by definition, and no
# routing choice undoes that. A proof body that can't be fixed by accident.
#
# ⚠️ And `F1`/`F2` are OUTSIDE the 62 on purpose (#18), so this step alone
# would not prove that a family FROM THE RUBRIC blocks. What proves that is the step above:
# `check-geometry-gate.cjs` runs `A4.2`, `A4.4`, `A5.5`, `F1` and `F2` — the
# FIVE zero-tolerance ones —, each against its planted case, and requires the
# message to name the check. The split is: THERE the gate proves it blocks each
# family; HERE the engine proves it calls the gate and obeys the level. There is no
# model that triggers `A5.5` or `F2` end to end, because the engine produces neither.
step "and the gate is GRAFTED into the engine"         bash -c '
  G="'"$ROOT"'/engine/generate.cjs"
  M="'"$ROOT"'/models/refusal/lying-band.json"
  if node "$G" "$M" --gate truthfulness --output /dev/null > /dev/null 2>&1; then
    echo "   ✗ the engine DREW a plan that lies, with the gate requested"; exit 1
  fi
  echo "   ✓ --gate truthfulness refuses the lying drawing"
  # and the control: the same level lets through one that does not lie
  node "$G" "'"$ROOT"'/models/web-multi-az.json" --gate truthfulness --output /dev/null > /dev/null 2>&1 \
    && echo "   ✓ and lets through the one that does not lie" \
    || { echo "   ✗ refused a drawing that does not lie"; exit 1; }
  # without a gate, the engine draws — but it WARNS
  node "$G" "$M" --output /dev/null 2>&1 | grep -q "⛔ F1" \
    && echo "   ✓ and without a gate it draws, but warns of the semantic failure" \
    || { echo "   ✗ drew a lying plan silently"; exit 1; }'

echo
echo "════ layer 6 · the session ════"
step "the production engine's manifest"           node "$HERE/check-engine-untouched.cjs"
step "the projection, with 12 control mutations"    node "$HERE/check-projection.cjs"
step "step 5 — the logical view, approved"        node "$ROOT/tools/approve.cjs" "$ROOT/models/session/retail-logical.json" --at 2026-08-21 --output "$ROOT/output/retail.drawio"
step "steps 1 and 6 — resume and technical view"   node "$ROOT/tools/resume.cjs" "$ROOT/output/retail.drawio" --delta "$ROOT/models/session/retail-elaboration.json"
step "the arc end to end, on a new case (#26)"  node "$HERE/check-arc.cjs"
step "the dossier's privacy"                    node "$HERE/check-dossier.cjs"

echo
echo "════ layer 7 · the app (development dependency) ════"
if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless not found at $DRAWIO — layer 7 skipped."
  echo "   (development dependency: draw.io Desktop AppImage + xvfb;"
  echo "    tools/drawio.cjs is the one that knows where the binary lives)"
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
    "'"$ROOT"'/tools/clean-render.sh" > /dev/null 2>&1 || true
    failed=0
    for d in "'"$ROOT"'"/output/*.drawio; do
      "'"$ROOT"'/tools/render.sh" "$d" "${d%.drawio}.png" || failed=1
    done
    exit $failed'
  # ⚠️ REGENERATED HERE, and not read from a versioned file.
  #
  # Until #29 `output/themes/*.drawio` was committed, and layer 7 rendered whatever
  # it found there. That put 6.7 MB of generated output inside the package the user
  # installs — and the official authoring convention is the opposite: eval output lives
  # in a sibling workspace. `output/` became an ignored scratch directory, and whoever
  # builds the variants has always known how to build them. Measured: the regeneration comes out
  # byte for byte identical to what was committed.
  step "the theme variants, rebuilt"        bash -c '
    node "'"$ROOT"'/tools/generate-themes.cjs" > /dev/null && node "'"$ROOT"'/tools/generate-trap.cjs" > /dev/null
    n=$(ls "'"$ROOT"'"/output/themes/*.drawio | wc -l)
    [ "$n" -ge 7 ] && echo "   ✓ $n variant(s)" || { echo "   ✗ only $n variant(s)"; exit 1; }'
  step "render the theme variants" bash -c '
    "'"$ROOT"'/tools/clean-render.sh" > /dev/null 2>&1 || true
    failed=0
    for d in "'"$ROOT"'"/output/themes/*.drawio; do
      name="$(basename "$d" .drawio)"
      # the animated one is only visible in SVG — #4 measured that its PNG turns into a
      # STATIC dashed line with no error, and a PNG here would be false proof
      if [ "$name" = "f-animated-flow" ]; then
        "'"$ROOT"'/tools/render.sh" "$d" "${d%.drawio}.svg" svg || failed=1
        grep -q "ge-flow-animation" "${d%.drawio}.svg" || { echo "   ✗ $name has no animation in the SVG"; failed=1; }
        continue
      fi
      "'"$ROOT"'/tools/render.sh" "$d" "${d%.drawio}.png" || failed=1
    done
    exit $failed'
  if command -v python3 > /dev/null && python3 -c "import PIL" 2>/dev/null; then
    step "the theme landed on the PIXEL (the lesson from #17)"  python3 "$ROOT/tools/verify-theme.py" --all
  else
    echo "   Pillow missing — pixel verification skipped."
  fi
fi

echo
if [ "$failed" -ne 0 ]; then
  echo "SUITE RED — ${#REDS[@]} layer(s):"
  for v in "${REDS[@]}"; do echo "  · $v"; done
  exit 1
fi
echo "suite green — the union runs, and it runs against a single engine."
