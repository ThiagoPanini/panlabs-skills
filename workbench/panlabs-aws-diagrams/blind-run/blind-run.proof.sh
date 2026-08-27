#!/usr/bin/env bash
# THE PROOF that the blind run's sandbox measures its own isolation, and does
# not merely assert it.
#
#   workbench/panlabs-aws-diagrams/blind-run/blind-run.proof.sh
#
# A sandbox is exactly the kind of thing that is only ever seen green: it is
# built once, glanced at, and trusted for the rest of the run. #47 is what that
# costs — the isolation it prepared was never in force, and the report could
# only say so afterwards, by reading the sub-agent's command log and hoping.
#
# So every breach this harness claims to catch is planted here and demanded red,
# and the two shapes #47 actually took have their own cases: a caller project
# that identifies as this repository, and an install that is a LINK back into
# the real tree instead of a severed copy.
#
# ⚠️ NOTHING HERE TOUCHES THE MACHINE'S OWN SKILL HOMES. Every invocation passes
# `--skill-home` into the bench, which replaces the default pair rather than
# adding to it. A proof that parked the real install would be a proof that
# breaks the developer's machine every time it runs.
#
# ⚠️ EVERY NAME COMES FROM `blind-run.sh paths`, NEVER FROM A LITERAL HERE. The
# first version spelled `.panlabs-aws-diagrams.blind-run-parked` out again, and
# a review demonstrated the cost: renaming that constant in the harness left
# this file printing `proof green` while the case called "the parked record is
# gone" had stopped looking at any record at all. A proof carrying its own copy
# of what it measures is the vacuous green one floor up.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../../../scripts/proof.sh"

HARNESS="$HERE/blind-run.sh"
[ -x "$HARNESS" ] || { echo "x harness not found or not executable: $HARNESS"; exit 2; }

proof_begin "the proof . the blind run's sandbox goes red on every door it claims to close"
proof_bench

HOME_DIR="$PROOF_BENCH/home/.claude/skills"
SANDBOX="$PROOF_BENCH/sandbox"
ORIGINAL="../../.agents/skills/panlabs-aws-diagrams"

run() { "$HARNESS" "$@" --at "$SANDBOX" --skill-home "$HOME_DIR" 2>&1; }
path_of() { run paths | sed -n "s/^$1=//p" | head -1; }

PROJECT="$(path_of project)"
COPY="$(path_of copy)"
SKILL_NAME="$(path_of skill-name)"
RECORD_NAME="$(path_of record-name)"
WATCH_RECORD="$(path_of watch-record)"
FIXTURE_RECORD="$(path_of fixture-record)"
HOMES_RECORD="$(path_of homes-record)"
STAMP="$(path_of stamp)"
ENTRY="$HOME_DIR/$SKILL_NAME"

# `expect` reads exit codes, so absence has to be turned into one. Spelling that
# inline read backwards every time it appeared.
expect_absent() { # expect_absent <title> <path>
  local out="" code=0
  if [ -e "$2" ]; then out="still there: $2"; code=1; fi
  expect "$1" green "" "$out" "$code"
}
expect_present() { # expect_present <title> <path>
  local out="" code=0
  if [ ! -e "$2" ]; then out="gone: $2"; code=1; fi
  expect "$1" green "" "$out" "$code"
}

# The fixture is a COMMIT, not a working tree — `verify` reads the pinned one
# precisely so the blind agent's own output is never mistaken for the fixture's
# prose. Planting a defect in it therefore means amending that commit and
# re-pinning, which is also what "somebody shipped a different fixture" looks
# like from the harness's side.
replant_fixture() {
  git -C "$PROJECT" add -A
  git -C "$PROJECT" commit -q --amend --no-edit
  git -C "$PROJECT" rev-parse HEAD > "$SANDBOX/$FIXTURE_RECORD"
}

# The machine as `tools/install.sh` leaves it: a relative link, two hops.
mkdir -p "$HOME_DIR"
ln -s "$ORIGINAL" "$ENTRY"

# ── 1 . THE CONTROL ───────────────────────────────────────────────────────────
# Without this every case below would pass on a harness hard-wired to say red.
out="$(run setup)"; code=$?
expect "setup builds the caller project and the severed copy" green "the skill is copied" "$out" "$code"

out="$(run verify)"; code=$?
expect "a sandbox nobody has touched verifies clean" green "the sandbox is isolated" "$out" "$code"

# ── 2 . THE #47 SHAPE — THE CALLER PROJECT IDENTIFIES AS THIS REPOSITORY ──────
# What the sub-agent read before it refused to write. The name does not have to
# be in the directory name to do the damage: one line of prose in one file is
# what a capable agent needs to recognise where it is standing.
echo 'este projeto vive no repositório panlabs-skills' > "$PROJECT/NOTES.md"
replant_fixture
out="$(run verify)"; code=$?
expect "a caller project whose prose names this repository turns red" red "names panlabs-skills" "$out" "$code"
rm -f "$PROJECT/NOTES.md"
replant_fixture

# ── 3 . THE CRITERION PASSING BY CONSTRUCTION ─────────────────────────────────
# A caller project that tells the agent where diagrams go makes criterion 2 of
# #47 true without the skill having done anything. Green here would be the
# worst kind: the run reports a pass and measured nothing.
# ⚠️ The original is kept ASIDE, not restored with `git checkout --`: the amend
# that plants the defect also rewrites the index and HEAD, so checking out from
# either gives the polluted file back and every case after this one inherits it.
cat "$PROJECT/docs/architecture/README.md" > "$PROOF_BENCH/arch-readme-aside"
echo 'os diagramas ficam em docs/architecture/diagrams/' >> "$PROJECT/docs/architecture/README.md"
replant_fixture
out="$(run verify)"; code=$?
expect "a caller project that dictates the destination path turns red" red "pass by construction" "$out" "$code"
cat "$PROOF_BENCH/arch-readme-aside" > "$PROJECT/docs/architecture/README.md"
replant_fixture

# And the counter-case that makes the two above worth having: the same words,
# written by the BLIND AGENT into the working tree rather than shipped by the
# fixture, are not a breach. Reading the working tree instead of the commit
# would fail a run for producing exactly what it was asked to produce.
mkdir -p "$PROJECT/docs/architecture/diagrams/some-case"
echo 'gravado em docs/architecture/diagrams/some-case pelo agente' > "$PROJECT/docs/architecture/diagrams/some-case/case.md"
out="$(run verify)"; code=$?
expect "the same words written by the run, not shipped by the fixture, are not a breach" green "the sandbox is isolated" "$out" "$code"
rm -rf "$PROJECT/docs/architecture/diagrams"

# ── 4 . A DOOR THAT STILL OPENS SOMEWHERE ELSE ────────────────────────────────
# The sandbox is intact and the skill home points past it — which is #47's
# other half, with the sandbox built correctly and simply not in force.
mkdir -p "$PROOF_BENCH/elsewhere"
ln -sfn "$PROOF_BENCH/elsewhere" "$ENTRY"
out="$(run verify)"; code=$?
expect "a skill home resolving outside the sandbox turns red" red "outside the sandbox" "$out" "$code"

# And the same door with nothing on the other side. It is a DANGLING link, not
# an absent entry, and judging it by `-e` alone reads it as the second — which
# reports a door leading nowhere when it is really a door leading out.
rm -rf "$PROOF_BENCH/elsewhere"
out="$(run verify)"; code=$?
expect "a dangling skill home is judged by where it points, not by what is there" red "outside the sandbox" "$out" "$code"

# A door that is simply gone is its own breach: an agent that cannot find the
# skill at all measures nothing either.
rm -f "$ENTRY"
out="$(run verify)"; code=$?
expect "a skill home with no entry at all turns red on its own message" red "reachable from nowhere" "$out" "$code"
ln -sfn "$COPY" "$ENTRY"

# ── 5 . AN INSTALL THAT IS A LINK BACK INTO THE REAL TREE ─────────────────────
# `tools/install.sh` links on purpose, and a blind run that inherited that link
# would hand the agent the development tree — workbench, corpus and all — while
# reporting an installed skill.
REAL="$(cd "$HERE/../../../skills/$SKILL_NAME" && pwd)"
mv "$COPY" "$PROOF_BENCH/copy-aside"
ln -s "$REAL" "$COPY"
out="$(run verify)"; code=$?
expect "an installed skill that is a link, not a copy, turns red" red "is a link" "$out" "$code"
expect "and the same link is caught escaping the sandbox" red "escapes the sandbox" "$out" "$code"
rm -f "$COPY"
mv "$PROOF_BENCH/copy-aside" "$COPY"

# ── 6 . THE MODULE SCOPE, DECIDED BY THE MACHINE ──────────────────────────────
# The first run under this harness died on `ELK is not a constructor`: the
# nearest `package.json` above the copy was a stray `/tmp/package.json` from a
# draw.io extraction, `"type": "module"`, and the skill's one `.js` was read as
# ESM. Nothing in the sandbox was wrong; what was wrong is that the MACHINE got
# to decide how the skill is read.
#
# ⚠️ Removing the fixture's pin is red whichever way the machine falls — an
# outer `package.json` is found, or none is and nothing pins the scope at all.
# The two messages share a stem so this case does not depend on what happens to
# sit above /tmp on the machine running it.
mv "$PROJECT/package.json" "$PROOF_BENCH/package.json-aside"
out="$(run verify)"; code=$?
expect "removing the fixture's pin turns the module scope red" red "is not the fixture's" "$out" "$code"

printf '{"type":"module"}' > "$PROOF_BENCH/package.json"
out="$(run verify)"; code=$?
expect "and a pin above the sandbox is named as the one deciding" red "outside the sandbox" "$out" "$code"
rm -f "$PROOF_BENCH/package.json"

mv "$PROOF_BENCH/package.json-aside" "$PROJECT/package.json"
out="$(run verify)"; code=$?
expect "with the pin back, the scope is the fixture's" green "the module scope over the copy is the fixture's" "$out" "$code"

# ⚠️ And it keeps measuring when the skill ships no `.js` at all. #133 renamed
# the vendored bundle to `.cjs` the day after this check was written; a version
# that only asked about `.js` files went quiet and reported "nothing declares a
# module type" while the pin sat right there, unread.
: > "$COPY/probe.js"
out="$(run verify)"; code=$?
expect "a .js appearing in the copy does not change the answer" green "the module scope over the copy is the fixture's" "$out" "$code"
rm -f "$COPY/probe.js"

# ── 7 . THE TREE THE RUN WAS NEVER SUPPOSED TO TOUCH ──────────────────────────
# The blind agent's process starts wherever the operator opened it, and the
# first run under this harness left three scratch files in this repository's
# working tree. Criterion 9 of #47 caught it because someone typed `git status`;
# these cases are what make it a line. The snapshot names the tree it watched,
# so the proof points it at a throwaway repository instead of the real one.
WATCHED="$PROOF_BENCH/watched"
mkdir -p "$WATCHED"
git -c init.defaultBranch=main init -q "$WATCHED"
printf 'watching=%s\n' "$WATCHED" > "$SANDBOX/$WATCH_RECORD"
out="$(run verify)"; code=$?
expect "a watched tree nothing touched stays green" green "nothing appeared in" "$out" "$code"

: > "$WATCHED/.scratch-from-the-agent.cjs"
out="$(run verify)"; code=$?
expect "a file that appeared in the watched tree turns red" red "appeared in" "$out" "$code"
rm -f "$WATCHED/.scratch-from-the-agent.cjs"

# And a sandbox with no snapshot cannot see a leak at all, which is its own red
# rather than a green that means nothing was measured.
mv "$SANDBOX/$WATCH_RECORD" "$PROOF_BENCH/watch-aside"
out="$(run verify)"; code=$?
expect "a sandbox with no snapshot turns red instead of passing vacuously" red "setup never took one" "$out" "$code"
mv "$PROOF_BENCH/watch-aside" "$SANDBOX/$WATCH_RECORD"

# ── 8 . THE CORPUS, ONE FLOOR UP ──────────────────────────────────────────────
# Nothing inside the sandbox changes: what changes is what sits ABOVE it. This
# is the leak #47 could not close by hiding a directory on a branch — the
# workbench was reachable by climbing, not by being linked to.
mkdir -p "$PROOF_BENCH/workbench/$SKILL_NAME/models"
out="$(run verify)"; code=$?
expect "a workbench reachable by climbing out of the copy turns red" red "reachable by climbing out of the copy" "$out" "$code"

# And the same rule one step earlier: the cheapest place to fail is before the
# sandbox exists at all.
out="$("$HARNESS" setup --at "$PROOF_BENCH/second" --skill-home "$PROOF_BENCH/other-home" 2>&1)"; code=$?
expect "setup refuses a sandbox root it could climb out of" red "refusing to build the sandbox" "$out" "$code"
expect_absent "and builds nothing when it refuses" "$PROOF_BENCH/second"
rm -rf "$PROOF_BENCH/workbench"

# ── 9 . A RUN THAT NEVER TORE DOWN ────────────────────────────────────────────
# The parked record is the machine's only memory of what to restore. Setting up
# over it would overwrite that memory with a link to a sandbox, and the original
# target would be gone for good.
out="$("$HARNESS" setup --at "$PROOF_BENCH/third" --skill-home "$HOME_DIR" 2>&1)"; code=$?
expect "setup refuses a skill home that is still parked from an earlier run" red "never tore down" "$out" "$code"
expect_absent "and builds nothing when it refuses" "$PROOF_BENCH/third"

# ── 10 . TEARDOWN REMOVES ONLY WHAT THIS HARNESS BUILT ────────────────────────
# `--at` takes whatever it is handed, and an earlier version removed that path
# outright: pointed at a home directory it deleted the home directory and
# reported "the machine is back where it was". The stamp is the provenance.
mkdir -p "$PROOF_BENCH/foreign"
: > "$PROOF_BENCH/foreign/somebody-elses-work"
out="$("$HARNESS" teardown --at "$PROOF_BENCH/foreign" --skill-home "$PROOF_BENCH/untouched-home" 2>&1)"; code=$?
expect "teardown refuses a directory it did not stamp" red "did not build it" "$out" "$code"
expect_present "and what was in it is still there" "$PROOF_BENCH/foreign/somebody-elses-work"

# ── 11 . TEARDOWN PUTS BACK THE TEXT, NOT THE RESOLUTION ──────────────────────
# The ~/.claude entry carries a RELATIVE target. Restoring the resolved path
# would leave a working link that the skill's own installer never wrote, and
# `install.sh --check` would start disagreeing with the machine.
#
# ⚠️ No `--skill-home` here on purpose: the homes come from the record the
# sandbox carries. A teardown that fell back to the default pair would leave
# this bench's door parked and pointing into a sandbox about to be deleted.
out="$("$HARNESS" teardown --at "$SANDBOX" 2>&1)"; code=$?
expect "teardown reports the machine restored" green "the machine is back where it was" "$out" "$code"
expect "and it closed the door the sandbox recorded, without being told which" green "$HOME_DIR" "$out" "$code"
expect "the skill home carries the original link text again" green "$ORIGINAL" "$(readlink "$ENTRY")" 0
expect_absent "the parked record is gone" "$HOME_DIR/$RECORD_NAME"
expect_absent "and the sandbox is gone" "$SANDBOX"

# ── 12 . A HOME THAT HAD NOTHING INSTALLED COMES BACK EMPTY ───────────────────
# The other machine this has to work on: the skill was never installed globally,
# so neutralising it means CREATING a door and then removing it again.
EMPTY_HOME="$PROOF_BENCH/empty-home/.claude/skills"
out="$("$HARNESS" setup --at "$SANDBOX" --skill-home "$EMPTY_HOME" 2>&1)"; code=$?
expect "setup installs a door where there was none" green "nothing was installed here" "$out" "$code"
out="$("$HARNESS" teardown --at "$SANDBOX" --skill-home "$EMPTY_HOME" 2>&1)"; code=$?
expect "teardown takes that door away instead of inventing one" green "nothing was installed here before" "$out" "$code"
expect_absent "leaving no entry behind" "$EMPTY_HOME/$SKILL_NAME"

# ── 13 . THE VERBS ────────────────────────────────────────────────────────────
out="$("$HARNESS" 2>&1)"; code=$?
expect "no verb is an error, not a pass" red "usage" "$out" "$code"
out="$("$HARNESS" verify --at "$PROOF_BENCH/nowhere" --skill-home "$HOME_DIR" 2>&1)"; code=$?
expect "verify on a sandbox that does not exist is red, not a vacuous green" red "no sandbox at" "$out" "$code"
# Every name above came from `paths`. If one of them ever comes back empty this
# file starts measuring the empty string — greens that mean nothing — so the
# last case is that none of them did.
missing=""
for key in project copy skill-name record-name watch-record fixture-record homes-record stamp; do
  [ -n "$(path_of "$key")" ] || missing="$missing $key"
done
expect "paths answers with every name this proof reads instead of spelling them again" green "" "${missing:+missing:$missing}" "$([ -z "$missing" ] && echo 0 || echo 1)"

proof_verdict
