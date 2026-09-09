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
# answer on its own). Box overflow is NOT the old per-chart pixel bleed: it is
# a straight rect comparison against the stage's own edges, in CSS pixels, over
# every leaf of real text -- and now that #213 has landed charts, that is what
# measures them too, because the generator never places a mark by hand. What
# the charts DID add to this layer is the type floor learning about scale: an
# SVG label paints at its own size times its viewBox's, and the proof halves a
# real chart's viewBox to demand the ruler notice.
#
# #214 ADDED THE OTHER HALF OF WHAT A STAGE HOLDS: a figure is content with no
# words in it, and every ruler here found leaves by looking for a text node --
# so a picture filling the projector edge to edge weighed nothing, and an
# image-only slide came back RED on occupancy for being "empty". Figures are
# leaves now, measured where they PAINT rather than where their box is. The
# render proof holds that from both sides: one PLANT that goes red (a picture
# grown until it bleeds off the stage, carrying not one character, which the
# old gate called green), and two cases that demand GREEN -- because the change
# turned two false reds into passes, and a plant cannot prove a red that should
# no longer happen. The other
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
#                                      wrote -- and, since #219, that the two
#                                      sources between them draw every pattern
#                                      and every chart form the register
#                                      declares, which is the one promise the
#                                      tree makes about its own corpus.
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
#   4  THE SECOND THEME                 `themes/panlabs/` is a snapshot of an
#                                       identity that lives in ANOTHER
#                                       repository, and its faces are two
#                                       .woff2 files whose manifest can stop
#                                       describing them without a red
#                                       anywhere. This layer holds the tokens
#                                       against `panlabs-docs` and the
#                                       manifest against the bytes, then
#                                       builds one deck in both themes. It sits
#                                       below everything that measures the
#                                       COMPILER because it is the layer most
#                                       likely to SKIP: without the docs
#                                       cloned beside this repository the
#                                       drift check has nothing to compare,
#                                       and says so by name rather than
#                                       failing.
#   5  THE STORYBOARD                   the page `compiler/storyboard.py`
#                                       writes beside every deck, which no
#                                       ruler inside the compiler ever reads
#                                       back. It holds one storyboard to the
#                                       source it came from -- a row per slide,
#                                       in order, carrying that slide's own
#                                       pattern, its own function in the arc
#                                       and words the deck really says -- and
#                                       holds the generator to writing the same
#                                       page twice. It is last because it is
#                                       the only layer about a SECOND file: a
#                                       storyboard is worth measuring only
#                                       once there is a deck beside it.
#   6  THE FRONT DOOR                   `SKILL.md` is the only file the runtime
#                                       reads to decide whether the skill
#                                       applies, the only file every ticket
#                                       edits, and until #218 the only file in
#                                       the v2 nothing verified. This layer
#                                       holds the JOURNEY -- three turns, the
#                                       calibration before the build, the
#                                       storyboard before the pixels, every
#                                       documented path resolving, every
#                                       documented write landing outside the
#                                       tree, and every fact the register
#                                       declares reaching the document the
#                                       model reads -- and the INSTALLATION,
#                                       which is the only part of this skill
#                                       whose failure lands on a machine
#                                       instead of in a file. It is last
#                                       because it is the only layer whose
#                                       subject is a DOCUMENT rather than the
#                                       compiler: a front door describing a
#                                       journey nothing underneath it can run
#                                       is a green about prose.
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
#
# ⚠️ #218 ANSWERS THE REGISTER/REFERENCE NOTE ABOVE, AND THE ANSWER IS NO. That
# note invited the front door to absorb layer 3's `catalog.py --check` when it
# arrived; it arrived, and the two turned out to be different rules. `--check`
# asks whether the document equals the GENERATOR's output; `register-published`
# in layer 6 asks whether `reference()` still emits every fact the REGISTER
# holds. A generator that quietly stopped printing a budget regenerates a
# document agreeing with it perfectly -- layer 3 green, the model reading a
# pattern with no ceiling, and only layer 6 red. Deleting either leaves one of
# those two questions unasked; the v1 carried both, one floor apart, for exactly
# this reason.
#
# ⚠️ AND #218 SAID "camada cinco", THE WAY #209 SAID "camada quatro" ABOVE, AND
# GETS THE SAME ANSWER. Both numbers were written into the spec's tickets before
# the queue ran, and five is the storyboard's, taken by #217 one ticket earlier.
# The front door lands as 6, the next free slot, because the rule above is
# APPEND AT THE END and not "renumber the neighbours so a ticket written last
# month reads right". A reader grepping #218 for "camada cinco" finds this note
# instead of a layer that changed under them.
#
# ⚠️ AND THESE TWO NOTES SIT AT THE TAIL RATHER THAN BESIDE WHAT THEY ANSWER,
# which is the same rule one paragraph up applied to itself: this block is a
# registry too. Each opens by naming the note it replies to, which costs a
# clause and buys the one thing splicing them into the middle would have taken
# away -- an append that collides as text when two sessions write here at once,
# instead of merging green into an order nobody chose.
#
# ⚠️ #219 COLLAPSED THE CORPUS FROM SEVEN DECKS TO TWO, and every layer above
# still reads it by DISCOVERY rather than by name -- layer 1 walks
# `examples/*.deck.html`, layer 4 walks that list crossed with `themes/*/`, and
# `check-render.proof.cjs` picks its fixtures by what a built page CARRIES (a
# statement, a chart, an `<img class="figure">`, a `data-fragment=`). That is
# why the collapse touched no loop here. The two that are left are
# `canonical.deck.html`, in `panlabs`, holding every group, every chart form and
# both halves of the figure; and `proposal.deck.html`, in `base`, holding the
# patterns made of words, the notes, the fragments and the one drawn figure
# whose colours a header can still be held to.
#
# ⚠️ THE CONTACT SHEETS ARE NOT IN THIS REPOSITORY, AND THE COMMAND THAT MAKES
# THEM IS. `tools/render-examples.sh` beside this file rebuilds both decks,
# both storyboards and both sheets into `../renders/`, which `.gitignore` keeps
# out of the tree for the reason #62 measured: a committed render nobody
# compares is not evidence, it just ages. What proves the corpus renders is
# layer 2, running.
#
# ⚠️ #220 TOOK THE CORPUS BACK TO THREE, AND THE THIRD IS NOT UNDER
# `examples/`. The note above is still true about the tree -- `examples/` holds
# two decks and only two -- but the corpus this suite eats is now those two plus
# `../benchmark/matt-pocock.deck.html`, which #207's Testing Decisions always
# counted ("os dois exemplos da árvore ... e o benchmark do workspace irmão")
# and no layer had ever built. It joins at the END of layer 1, in the same
# `$OUTPUT_DIR`, so layer 2 picks it up by the same discovery that finds the
# other two. The layers that still walk `examples/` on purpose are 3 (the
# register's coverage is a promise the TREE makes), 4 (a benchmark in the wrong
# theme is not an identity anybody ships) and 5.
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

# AND THE CORPUS IS THE WHOLE CATALOG, OR SAYS WHAT IT LEAVES OUT (#219). That
# ticket's own acceptance -- "entre os dois, todo padrão e todo tipo de gráfico
# aparece ao menos uma vez" -- was, until it landed, a sentence in `SKILL.md`,
# a sentence in `CATALOG.md` and a fact in nobody's check. It is the shape of
# claim that rots without a sound: somebody shortens a deck, the sparkline goes
# with it, every step above stays green, and the two documents keep promising a
# model a catalog it can no longer see.
#
# THE PROOF FIRST, layer 0's rule inside this layer: an emptier corpus is the
# easiest thing in this suite to be green about, so the check has to know how to
# be red before its green means anything. It sits at the END of layer 1 because
# what it measures is the corpus itself, which is what this layer is about.
step "the corpus check proves it measures" \
  python3 "$HERE/check-corpus.proof.py"

step "the corpus draws every pattern and every chart form the register declares" \
  python3 "$HERE/check-corpus.py"

# AND THE CORPUS IS NOT ONLY WHAT `examples/` HOLDS (#220). #207's Testing
# Decisions name three sources for it -- "os dois exemplos da árvore ... e o
# benchmark do workspace irmão" -- and the benchmark is the only one of the
# three whose NUMBERS ARE REAL: `../benchmark/matt-pocock.deck.html`, built from
# `BRIEF.md` beside it, every value traced in `DATA.md` to a primary source with
# a date. It lives out here rather than in `examples/` because story 55 asks for
# exactly that: the proof of acceptance is not something to install alongside
# the skill.
#
# IT LANDS IN THE SAME `$OUTPUT_DIR`, and that is the whole reason this step is
# a step instead of a `render-examples.sh` run: layer 2's `render_corpus` walks
# `$OUTPUT_DIR/*.html` by discovery, so a benchmark built here is a benchmark
# the render gate asserts on, with no second loop to keep in step.
#
# ⚠️ IT IS THE ONE DECK IN THE CORPUS THAT CAN GO RED FOR A REASON OUTSIDE THIS
# TREE. Its four charts are numbers somebody measured on a day; when they are
# re-measured the source lines change with them, and the deck stops matching
# `DATA.md` without a ruler anywhere noticing. What this step holds is the half
# a machine CAN hold -- that it still builds and still renders -- and `DATA.md`
# is where the other half is written down for a person.
build_benchmark() {
  local n=0 bad=0 src name
  # DISCOVERED, NOT NAMED, the same way `build_corpus` above discovers
  # `examples/` -- and by the same suffix, which is what lets `benchmark/` hold
  # `BRIEF.md` and `DATA.md` beside the source without either being handed to
  # the compiler. A deck named here would be a deck `tools/render-examples.sh`
  # rebuilt and this suite never measured.
  for src in "$HERE"/../benchmark/*.deck.html; do
    [ -e "$src" ] || continue
    name="$(basename "$src" .deck.html)"
    if python3 "$SKILL/compiler/build.py" "$src" "$OUTPUT_DIR/$name.html"; then
      n=$((n + 1))
    else
      bad=$((bad + 1))
    fi
  done
  if [ "$((n + bad))" -eq 0 ]; then
    echo "   ✗ benchmark/ has no source to build — #220's acceptance deck is the"
    echo "     only corpus member whose numbers are real, and a corpus without"
    echo "     it is green about two synthetic decks and nothing else"
    return 1
  fi
  if [ "$bad" -ne 0 ]; then
    echo "   ✗ $bad of $((n + bad)) benchmark source(s) refused — fix what the"
    echo "     compiler named above; no later layer will measure a partial corpus"
    return 1
  fi
  echo "   ✓ $n benchmark source(s) built into the same temp directory as the examples"
}
step "the benchmark builds through the documented command"  build_benchmark

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
echo "════ layer 4 · the second theme ════"
# THE THIRD COSTURA OF #207, and the only one that reaches outside this
# repository: `themes/panlabs/tokens.css` is a SNAPSHOT of `src/css/tokens.css`
# in `panlabs-docs`, resolved out of OKLCH because half of those values only
# exist inside a CSS engine. Nothing else here can tell that the snapshot has
# gone stale -- a deck built from a theme that drifted is green in every layer
# above and simply wears last month's identity.
#
# IT COMES AFTER THE CORPUS AND AFTER THE REGISTER because it is the layer
# most likely to be SKIPPED: a maintainer without the docs cloned beside this
# repository still gets everything above, and this says so by name instead of
# failing. Same rule the render gate follows one floor up.
step "the drift check between the theme and the docs proves it measures" \
  python3 "$HERE/check-theme.proof.py"

step "the panlabs tokens still say what the docs say" \
  python3 "$HERE/check-theme.py"

# THE FACES ARE THE OTHER HALF OF THE THEME, and their manifest is a contract
# with two ends: `faces.json` publishes a repertoire and `compiler/audit.py`
# refuses a deck that steps outside it, while the .woff2 files beside it carry
# whatever they carry. #91 measured what happens when those part company -- a
# subsetter drops in silence what the source face lacked -- so this reads the
# cmaps back out of the bytes.
step "the check on the theme's faces proves it measures" \
  node "$HERE/check-fonts.proof.cjs"

step "every face's manifest describes the bytes beside it" \
  node "$HERE/check-fonts.cjs"

# AND THE DECK THAT PROVES A PATTERN IS NOT A THEME. #216's own acceptance asks
# for a deck to compile in EVERY theme: `base` is the one that proves the
# patterns hold with no brand behind them, and `panlabs` is the one that proves
# the theme is a sheet of overrides rather than a second engine.
#
# ⚠️ IT CROSSES BOTH DIMENSIONS SINCE #219, AND THE REASON IS THAT THE CORPUS
# BECAME TWO. Layer 1 builds each example in the theme its own header declares,
# so with one example this step had exactly one crossing build to make and made
# it. With `canonical` in `panlabs` and `proposal` in `base` the interesting
# builds are BOTH crossings -- the charts, the tables and the drawn figure with
# no brand behind them, and the eleven word patterns wearing the house faces --
# and neither is reachable from a loop that walks only one axis. Walking both is
# two builds this layer repeats from layer 1 and two it is the only place to
# make; a loop that tried to skip the repeats would have to know which theme
# each header declares, which is a second copy of a fact the source already
# carries.
#
# ⚠️ THE RENDER GATE IS CALLED AGAIN, EXPLICITLY, AND THAT IS THE POINT.
# `build.py`'s own call is best-effort and never touches its exit code (#209),
# so a `panlabs` build whose declared face silently failed to load would print
# a red `platform-font` and still leave this step green -- and layer 2's
# `render_corpus` cannot cover it, because it runs over the corpus BEFORE
# these files exist. This is the only place a render verdict is asserted for a
# deck wearing a theme its own header does not declare.
#
# ⚠️ AND THE CONTACT SHEET IS ASSERTED RATHER THAN ANNOUNCED. #216 asks for the
# sheets side by side; saying so without looking would be the shape of green
# this whole suite exists to refuse. Without Chromium the gate SKIPs, no PNG is
# written, and the step says THAT instead of claiming a picture nobody took.
build_across_themes() {
  local n=0 bad=0 sheets=0 src name theme out
  # BOTH LISTS ARE DISCOVERED, the same way `scripts/check-skills.sh` discovers
  # skills: a list written here is a list the theme -- or the example -- after
  # next is missing from.
  for src in "$SKILL"/examples/*.deck.html; do
    [ -e "$src" ] || break
    name="$(basename "$src" .deck.html)"
    for theme in "$SKILL"/themes/*/; do
      [ -d "$theme" ] || continue
      theme="$(basename "$theme")"
      n=$((n + 1))
      out="$OUTPUT_DIR/$name.$theme.html"
      if python3 "$SKILL/compiler/build.py" "$src" "$out" --theme "$theme" \
         && node "$SKILL/gate/render.cjs" "$out" --out "$OUTPUT_DIR"; then
        [ -e "$OUTPUT_DIR/$name.$theme.contact-sheet.png" ] && sheets=$((sheets + 1))
      else
        bad=$((bad + 1))
      fi
    done
  done
  if [ "$n" -eq 0 ]; then
    echo "   ✗ there is no example, or no theme — nothing here has a deck to"
    echo "     build or an identity to wear"
    return 1
  fi
  if [ "$bad" -ne 0 ]; then
    echo "   ✗ $bad of $n pairing(s) refused the source, or rendered it red — a"
    echo "     pattern that only holds under one identity is a pattern the theme"
    echo "     is propping up"
    return 1
  fi
  if [ "$sheets" -eq "$n" ]; then
    echo "   ✓ every example built and rendered in every theme, $n pairings, $sheets contact sheets beside them"
  else
    echo "   ✓ every example built in every theme, $n pairings; $sheets of $n contact sheets —"
    echo "     the render gate SKIPped for want of a Chromium, so there is nothing to look at"
  fi
}
step "every example compiles in every theme"  build_across_themes

echo
echo "════ layer 5 · the storyboard ════"
# THE ONE ARTIFACT NO RULER INSIDE THE COMPILER EVER READS. Every check in layer
# 0 stops at the SOURCE; `compiler/storyboard.py` runs after all of them have
# passed, and the page it writes beside the deck is read by a person rather than
# by a machine. A compiler that skipped a slide there, printed the arc one row
# out of step, or dropped a line of the art direction would leave every layer
# above green -- and the reader it was written for, who asked for the story to
# stay beside the deck so the next ask could be about the ARC instead of about
# slide seven, is exactly the reader with no way to tell.
#
# IT COMES LAST BECAUSE IT IS THE ONLY LAYER THAT IS ABOUT A SECOND FILE. Layer 1
# already answers whether the corpus builds at all; a storyboard is worth holding
# to a deck only once there is a deck.
#
# ⚠️ IT BUILDS WITHOUT A BROWSER, AND SAVES THIRTY-FIVE SECONDS DOING IT. The
# check runs `build.py` with no `node` on the PATH, so `gate/render.cjs` degrades
# to the named SKIP #209 built it to degrade to. Layer 2 above is where a render
# verdict is asserted for this same corpus; paying for fourteen more Chromium
# launches to read fourteen Markdown tables would buy nothing twice.
step "the storyboard check proves it measures" \
  python3 "$HERE/check-storyboard.proof.py"

step "every storyboard describes the deck beside it, and is the same page twice" \
  python3 "$HERE/check-storyboard.py"

echo
echo "════ layer 6 · the front door ════"
# THE ONE LAYER WHOSE SUBJECT IS A DOCUMENT. Everything above measures the
# compiler: what it refuses, what it writes, what it writes beside what it
# wrote. `SKILL.md` is the only file the runtime reads to decide whether the
# skill applies at all, and the only file every ticket edits -- and until #218
# nothing in the v2 verified it. The parallel-workflow doctrine says so after
# measuring two branches that both rewrote a `SKILL.md` and merged green
# without either author reading the result.
#
# IT COMES LAST BECAUSE A FRONT DOOR DESCRIBING A JOURNEY NOTHING UNDERNEATH IT
# CAN RUN IS A GREEN ABOUT PROSE. Six layers above answer whether the compiler
# holds; this one answers whether the document that sends a model to it still
# says the true thing.
#
# ⚠️ WHAT IS MEASURED HERE IS POSITION AND THE REGISTER, AND ONE PHRASE. A
# checker grepping for sentences goes red on the first rewording and teaches
# everybody to edit around it, so what the journey families read is where a
# turn sits, which turn runs `build.py`, which turn first names the storyboard,
# and what names `compiler/catalog.py` holds -- the prose around all of that
# stays a human's to write, which is the half of `docs/agents/skills.md` no
# gate can judge.
#
# THE ONE PHRASE IS `**Fecha quando**`, AND IT IS NAMED HERE RATHER THAN
# GLOSSED OVER. "When does this turn end" has no position to be read out of and
# no register to be looked up in; it is a promise the document makes in words,
# so the check reads the words. Renaming it costs one constant at the top of
# `check-journey.py` -- which is the price of the only rule in that file that
# could not be bought any other way.
step "the journey check proves it measures" \
  python3 "$HERE/check-journey.proof.py"

step "the front door still conducts the three turns" \
  python3 "$HERE/check-journey.py"

# THE INSTALLER IS THE OTHER HALF OF THE FRONT DOOR, and the only part of this
# skill whose failure lands on a MACHINE instead of in a file: a link into
# `.claude/worktrees/` works today and dangles tomorrow, because the session
# that owned the worktree was deleted, and nothing announces it. The skill just
# stops being in the harness.
#
# ⚠️ IT IS HERMETIC, AND IT HAS TO BE. `HOME` is a scratch directory and the
# tree installed is a COPY, so the machine's real `~/.claude/skills/` is never
# read and never written. With parallel sessions the doctrine here, a check
# that repointed the live skill homes would hand every other session a
# different skill for as long as it ran.
step "the install check proves it measures" \
  python3 "$HERE/check-install.proof.py"

step "the skill installs at both paths, and runs from both" \
  python3 "$HERE/check-install.py"

echo
if [ "$failed" -ne 0 ]; then
  echo "SUITE RED — ${#REDS[@]} step(s):"
  for v in "${REDS[@]}"; do echo "  · $v"; done
  exit 1
fi
echo "suite green — the audit knows how to be red, the corpus builds, the render gate holds, the reference is the register, the second theme still wears the identity it snapshotted, every storyboard still describes the deck beside it, and the front door still conducts the three turns and installs where the house looks."
