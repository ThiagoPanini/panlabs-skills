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
# that identifies as this repository (case 2) and an install that is a LINK back
# into the real tree instead of a severed copy (case 5).
#
# ⚠️ NOTHING HERE TOUCHES THE MACHINE'S OWN SKILL HOMES. Every invocation passes
# `--skill-home` into the bench, which replaces the default pair rather than
# adding to it. A proof that parked the real install would be a proof that
# breaks the developer's machine every time it runs.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../../../scripts/proof.sh"

HARNESS="$HERE/blind-run.sh"
[ -x "$HARNESS" ] || { echo "x harness not found or not executable: $HARNESS"; exit 2; }

proof_begin "the proof . the blind run's sandbox goes red on every door it claims to close"
proof_bench

HOME_DIR="$PROOF_BENCH/home/.claude/skills"
SANDBOX="$PROOF_BENCH/sandbox"
PROJECT="$SANDBOX/labmove-platform"
COPY="$PROJECT/.claude/skills/panlabs-aws-diagrams"
ORIGINAL="../../.agents/skills/panlabs-aws-diagrams"

run() { "$HARNESS" "$@" --at "$SANDBOX" --skill-home "$HOME_DIR" 2>&1; }

# The machine as `tools/install.sh` leaves it: a relative link, two hops.
mkdir -p "$HOME_DIR"
ln -s "$ORIGINAL" "$HOME_DIR/panlabs-aws-diagrams"

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
out="$(run verify)"; code=$?
expect "a caller project whose prose names this repository turns red" red "names panlabs-skills" "$out" "$code"
rm -f "$PROJECT/NOTES.md"

# ── 3 . THE CRITERION PASSING BY CONSTRUCTION ─────────────────────────────────
# A caller project that tells the agent where diagrams go makes criterion 2 of
# #47 true without the skill having done anything. Green here would be the
# worst kind: the run reports a pass and measured nothing.
echo 'os diagramas ficam em docs/architecture/diagrams/' >> "$PROJECT/docs/architecture/README.md"
out="$(run verify)"; code=$?
expect "a caller project that dictates the destination path turns red" red "pass by construction" "$out" "$code"
git -C "$PROJECT" checkout -- docs/architecture/README.md

# ── 4 . A DOOR THAT STILL OPENS SOMEWHERE ELSE ────────────────────────────────
# The sandbox is intact and the skill home points past it — which is #47's
# other half, with the sandbox built correctly and simply not in force.
mkdir -p "$PROOF_BENCH/elsewhere"
ln -sfn "$PROOF_BENCH/elsewhere" "$HOME_DIR/panlabs-aws-diagrams"
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
rm -f "$HOME_DIR/panlabs-aws-diagrams"
out="$(run verify)"; code=$?
expect "a skill home with no entry at all turns red on its own message" red "reachable from nowhere" "$out" "$code"
ln -sfn "$COPY" "$HOME_DIR/panlabs-aws-diagrams"

# ── 5 . AN INSTALL THAT IS A LINK BACK INTO THE REAL TREE ─────────────────────
# `tools/install.sh` links on purpose, and a blind run that inherited that link
# would hand the agent the development tree — workbench, corpus and all — while
# reporting an installed skill.
REAL="$(cd "$HERE/../../../skills/panlabs-aws-diagrams" && pwd)"
mv "$COPY" "$PROOF_BENCH/copy-aside"
ln -s "$REAL" "$COPY"
out="$(run verify)"; code=$?
expect "an installed skill that is a link, not a copy, turns red" red "is a link" "$out" "$code"
expect "and the same link is caught escaping the sandbox" red "escapes the sandbox" "$out" "$code"
rm -f "$COPY"
mv "$PROOF_BENCH/copy-aside" "$COPY"

# ── 6 . THE MODULE SCOPE, DECIDED BY THE MACHINE ──────────────────────────────
# The first run under this harness died on `ELK is not a constructor`, because
# the nearest `package.json` above the copy was a stray `/tmp/package.json` from
# a draw.io extraction, `"type": "module"`. Nothing in the sandbox was wrong;
# what was wrong is that the machine got to decide how the skill's one `.js`
# file is read. The caller project pins the scope, and removing that pin has to
# turn this red rather than quietly hand the next run a different skill.
mv "$PROJECT/package.json" "$PROOF_BENCH/package.json-aside"
printf '{"type":"module"}' > "$PROOF_BENCH/package.json"
out="$(run verify)"; code=$?
expect "a module scope decided above the sandbox turns red" red "comes from OUTSIDE the sandbox" "$out" "$code"
rm -f "$PROOF_BENCH/package.json"
mv "$PROOF_BENCH/package.json-aside" "$PROJECT/package.json"
out="$(run verify)"; code=$?
expect "and the caller project's own pin is what puts it back inside" green "is the sandbox's own" "$out" "$code"

# A copy with no `.js` at all has no scope to inherit -- the branch that would
# otherwise only ever be read, never run.
mv "$COPY/engine/vendor/elk.bundled.js" "$PROOF_BENCH/elk-aside.js"
out="$(run verify)"; code=$?
expect "a copy with no .js has no module scope to inherit" green "reads as CommonJS" "$out" "$code"
mv "$PROOF_BENCH/elk-aside.js" "$COPY/engine/vendor/elk.bundled.js"

# ── 7 . THE CORPUS, ONE FLOOR UP ──────────────────────────────────────────────
# Nothing inside the sandbox changes: what changes is what sits ABOVE it. This
# is the leak #47 could not close by hiding a directory on a branch — the
# workbench was reachable by climbing, not by being linked to.
mkdir -p "$PROOF_BENCH/workbench/panlabs-aws-diagrams/models"
out="$(run verify)"; code=$?
expect "a workbench reachable by climbing out of the copy turns red" red "reachable by climbing out of the copy" "$out" "$code"

# And the same rule one step earlier: the cheapest place to fail is before the
# sandbox exists at all.
out="$("$HARNESS" setup --at "$PROOF_BENCH/second" --skill-home "$PROOF_BENCH/other-home" 2>&1)"; code=$?
expect "setup refuses a sandbox root it could climb out of" red "refusing to build the sandbox" "$out" "$code"
expect "and builds nothing when it refuses" green "" "$([ -e "$PROOF_BENCH/second" ] && echo built)" "$([ -e "$PROOF_BENCH/second" ] && echo 1 || echo 0)"
rm -rf "$PROOF_BENCH/workbench"

# ── 8 . A RUN THAT NEVER TORE DOWN ────────────────────────────────────────────
# The parked record is the machine's only memory of what to restore. Setting up
# over it would overwrite that memory with a link to a sandbox, and the original
# target would be gone for good.
out="$("$HARNESS" setup --at "$PROOF_BENCH/third" --skill-home "$HOME_DIR" 2>&1)"; code=$?
expect "setup refuses a skill home that is still parked from an earlier run" red "never tore down" "$out" "$code"
expect "and builds nothing when it refuses" green "" "$([ -e "$PROOF_BENCH/third" ] && echo built)" "$([ -e "$PROOF_BENCH/third" ] && echo 1 || echo 0)"

# ── 9 . TEARDOWN PUTS BACK THE TEXT, NOT THE RESOLUTION ───────────────────────
# The ~/.claude entry carries a RELATIVE target. Restoring the resolved path
# would leave a working link that the skill's own installer never wrote, and
# `install.sh --check` would start disagreeing with the machine.
out="$(run teardown)"; code=$?
expect "teardown reports the machine restored" green "the machine is back where it was" "$out" "$code"
expect "the skill home carries the original link text again" green "$ORIGINAL" "$(readlink "$HOME_DIR/panlabs-aws-diagrams")" 0
expect "the parked record is gone" green "" "" "$([ -e "$HOME_DIR/.panlabs-aws-diagrams.blind-run-parked" ] && echo 1 || echo 0)"
expect "and the sandbox is gone" green "" "" "$([ -e "$SANDBOX" ] && echo 1 || echo 0)"

# ── 10 . A HOME THAT HAD NOTHING INSTALLED COMES BACK EMPTY ───────────────────
# The other machine this has to work on: the skill was never installed globally,
# so neutralising it means CREATING a door and then removing it again.
EMPTY_HOME="$PROOF_BENCH/empty-home/.claude/skills"
out="$("$HARNESS" setup --at "$SANDBOX" --skill-home "$EMPTY_HOME" 2>&1)"; code=$?
expect "setup installs a door where there was none" green "nothing was installed here" "$out" "$code"
out="$("$HARNESS" teardown --at "$SANDBOX" --skill-home "$EMPTY_HOME" 2>&1)"; code=$?
expect "teardown takes that door away instead of inventing one" green "nothing was installed here before" "$out" "$code"
expect "leaving no entry behind" green "" "" "$([ -e "$EMPTY_HOME/panlabs-aws-diagrams" ] && echo 1 || echo 0)"

# ── 11 . THE VERBS ────────────────────────────────────────────────────────────
out="$("$HARNESS" 2>&1)"; code=$?
expect "no verb is an error, not a pass" red "usage" "$out" "$code"
out="$("$HARNESS" verify --at "$PROOF_BENCH/nowhere" --skill-home "$HOME_DIR" 2>&1)"; code=$?
expect "verify on a sandbox that does not exist is red, not a vacuous green" red "no sandbox at" "$out" "$code"

proof_verdict
