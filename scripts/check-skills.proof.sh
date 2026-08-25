#!/usr/bin/env bash
# THE PROOF that `check-skills.sh` measures -- the runner's own plumbing, planted
# broken in a throwaway tree and demanded red. Then every family's proof, found
# the same way the runner finds the families themselves.
#
#   scripts/check-skills.proof.sh
#
# WHAT THIS FILE IS FOR, and what it deliberately is not. The families answer
# "is this skill well formed"; each carries its own proof next to it and this
# file merely runs them. What has no other owner is the runner: discovery,
# exit-code propagation, and the two ways a gate can report success while having
# measured nothing -- no skills found, or no families found. Those two are the
# whole reason the runner is worth proving. A gate that greets an empty tree with
# a green is worse than no gate, because it also produces the paperwork.
#
# It builds real trees and runs the real runner in them; there is no test-only
# flag on the runner and no root to override. Discovery is exercised for real or
# it is not exercised.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/proof.sh"

RUNNER="$HERE/check-skills.sh"
[ -x "$RUNNER" ] || { echo "x runner not found or not executable: $RUNNER"; exit 2; }

proof_begin "the proof . check-skills reports nothing it did not measure"
proof_bench

newtree() { # newtree <name> -> a fresh tree with the REAL scripts/ and an empty skills/
  local r="$PROOF_BENCH/$1"
  mkdir -p "$r/skills"
  cp -R "$HERE" "$r/scripts"
  printf '%s\n' "$r"
}

skill() { # skill <tree> <name> [naked]
  mkdir -p "$1/skills/$2"
  if [ "${3:-}" != "naked" ]; then
    printf -- '---\nname: %s\ndescription: a skill that exists.\n---\n' "$2" > "$1/skills/$2/SKILL.md"
  fi
}

run() { ( cd "$1" && ./scripts/check-skills.sh "${@:2}" 2>&1 ); }

# ── 1 . THE CONTROL ───────────────────────────────────────────────────────────
# Two well-formed skills pass. Without this every red below clears by "always
# red", and a gate nothing can satisfy is not a gate.
t="$(newtree control)"
skill "$t" alpha
skill "$t" beta
out="$(run "$t")"; code=$?
expect "two well-formed skills pass" green "skills green" "$out" "$code"

# ── 2 . DISCOVERY, NOT REGISTRY ───────────────────────────────────────────────
# The headline claim, measured in the same tree that was just green: a directory
# dropped under skills/ enters the measurement by EXISTING. Nothing was edited,
# nothing was registered, and the gate went red.
mkdir -p "$t/skills/gamma"
out="$(run "$t")"; code=$?
expect "a new directory enters the measurement unregistered" red "gamma" "$out" "$code"
expect "and the reason travels with it" red "no SKILL.md" "$out" "$code"

# ── 3 . THE RED SURVIVES A GREEN AFTER IT ─────────────────────────────────────
# The broken skill sorts FIRST and a healthy one runs after it. A runner that
# lets the last exit code stand reports green here, having printed the failure.
t="$(newtree order)"
skill "$t" aaa-broken naked
skill "$t" zzz-fine
out="$(run "$t")"; code=$?
expect "a failure early in the list still fails the run" red "aaa-broken" "$out" "$code"

# ── 4 . A FILE UNDER skills/ IS NOT A SKILL ───────────────────────────────────
# Discovery is "every DIRECTORY under skills/". A stray README at that root is
# not a skill with a missing SKILL.md; treating it as one teaches everyone to
# ignore the gate.
t="$(newtree stray-file)"
skill "$t" alpha
echo "not a skill" > "$t/skills/README.md"
out="$(run "$t")"; code=$?
expect "a stray file at the skills/ root is not measured" green "skills green" "$out" "$code"

# ── 5 . NOTHING TO MEASURE IS RED, NOT GREEN ──────────────────────────────────
# The failure this whole file exists for. An empty skills/ means the glob broke,
# the tree moved, or the runner was invoked from nowhere -- and every one of
# those is a broken gate wearing a pass.
t="$(newtree no-skills)"
out="$(run "$t")"; code=$?
expect "an empty skills/ is red, not a vacuous green" red "NOTHING MEASURED" "$out" "$code"

t="$(newtree no-skills-dir)"
rm -rf "$t/skills"
out="$(run "$t")"; code=$?
expect "a missing skills/ is red, not a vacuous green" red "NOTHING MEASURED" "$out" "$code"

# ── 6 . AND THE SAME VACUITY FROM THE OTHER SIDE ──────────────────────────────
# Skills present, no family to judge them by. Symmetrical, and the one a refactor
# of checks/ would produce.
t="$(newtree no-families)"
skill "$t" alpha
rm -f "$t"/scripts/checks/*.sh
out="$(run "$t")"; code=$?
expect "no check family is red, not a vacuous green" red "NOTHING MEASURED" "$out" "$code"

# ── 7 . A FAMILY THAT BLOWS UP IS RED ─────────────────────────────────────────
# An unreadable verdict is not a pass. A runner that swallows a broken family
# reports green for a rule that never ran -- the silent-green bug, planted.
t="$(newtree family-crashes)"
skill "$t" alpha
printf '#!/usr/bin/env bash\necho "boom" >&2\nexit 2\n' > "$t/scripts/checks/exploding.sh"
chmod +x "$t/scripts/checks/exploding.sh"
out="$(run "$t")"; code=$?
expect "a family that crashes fails the run" red "exploding" "$out" "$code"
expect "and the run says the verdict is unknown" red "verdict on this skill is unknown" "$out" "$code"

# ── 8 . A FAMILY THAT CANNOT RUN IS RED ───────────────────────────────────────
# The exec bit lost in a checkout is a rule that silently stopped applying.
t="$(newtree family-not-executable)"
skill "$t" alpha
chmod -x "$t/scripts/checks/skill-md-present.sh"
out="$(run "$t")"; code=$?
expect "a family without the exec bit fails the run" red "not executable" "$out" "$code"

# ── 9 . A PROOF IS NOT A FAMILY ───────────────────────────────────────────────
# Families and their proofs sit side by side, so the runner has to tell them
# apart. This one exits 2 on any argument: green is only reachable by skipping
# it, which is the point.
t="$(newtree proof-is-not-a-family)"
skill "$t" alpha
printf '#!/usr/bin/env bash\nexit 2\n' > "$t/scripts/checks/never-run-me.proof.sh"
chmod +x "$t/scripts/checks/never-run-me.proof.sh"
out="$(run "$t")"; code=$?
expect "a *.proof.sh in checks/ is not run as a family" green "skills green" "$out" "$code"

# ── 10 . --list IS THE SOURCE OF THE LIST ─────────────────────────────────────
# It reads the rule off the family, so a rule can never be listed by a runner
# that would not enforce it.
t="$(newtree list)"
skill "$t" alpha
out="$(run "$t" --list)"; code=$?
expect "--list prints the rule in force" green "every directory under skills/" "$out" "$code"

t="$(newtree list-empty)"
rm -f "$t"/scripts/checks/*.sh
out="$(run "$t" --list)"; code=$?
expect "--list with no family is red, not an empty green" red "NO RULES" "$out" "$code"

# ── AND EVERY FAMILY'S OWN PROOF ──────────────────────────────────────────────
# Found by scanning, exactly as the runner finds the families. One command proves
# the whole gate, and a family whose proof is missing is visible here as an
# absence rather than as a green.
echo
echo "==== and every family's own proof ===="
n_proof=0
for fam in "$HERE"/checks/*.sh; do
  [ -e "$fam" ] || continue
  case "$fam" in *.proof.sh) continue ;; esac
  p="${fam%.sh}.proof.sh"
  name="$(basename "$fam" .sh)"
  if [ ! -f "$p" ]; then
    printf '   x %s - no proof next to it; a family ships with its proof or unmeasured\n' "$name"
    PROOF_FAILED=1
    PROOF_CASES=$((PROOF_CASES + 1))
    continue
  fi
  n_proof=$((n_proof + 1))
  PROOF_CASES=$((PROOF_CASES + 1))
  if out="$(bash "$p" 2>&1)"; then
    printf '   . %s.proof.sh\n' "$name"
  else
    printf '   x %s.proof.sh - RED\n' "$name"
    sed 's/^/       | /' <<< "$out"
    PROOF_FAILED=1
  fi
done
[ "$n_proof" -eq 0 ] && printf '   ! no family proof found -- checks/ holds nothing to prove\n'

proof_verdict
