#!/usr/bin/env bash
# THE GATE over every skill in this repository.
#
#   scripts/check-skills.sh          run every check family over every skill
#   scripts/check-skills.sh --list   print the rules in force
#
# Exit code is the whole point: 0 when every skill clears every family, non-zero
# the moment one does not. There is no warning tier -- a rule that is not worth
# failing on is not worth being a check, and belongs in the directive instead.
#
# TWO CONVENTIONS LIVE HERE, and everything added later inherits them.
#
#   1. A skill is DISCOVERED, never registered. Every directory under `skills/`
#      is a skill by existing. A registry is a place someone forgets to register,
#      and a skill missing from it is a skill nothing measures.
#
#   2. A check family is ITS OWN FILE under `checks/`, discovered the same way.
#      This is not tidiness. Every family added from here on writes under
#      `scripts/`; in one shared file their territories intersect and they
#      serialize by accident of layout. One file each, discovered by scan, and a
#      new family adds a file while touching nothing shared.
#
# A FAMILY IS AN EXECUTABLE PROGRAM WITH TWO VERBS:
#
#   <family> --describe     print one line per rule it enforces; exit 0
#   <family> <skill-dir>    check that one skill; print one line per failure;
#                           exit non-zero if there was any
#
# The runner never reads a family's rules from anywhere but the family itself --
# that is what makes `--list` the source of the list instead of a second copy of
# it that drifts.
#
# `<family>.proof.sh` sitting next to a family is that family's proof, not a
# family. The runner skips it; `check-skills.proof.sh` is what runs it.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
SKILLS_DIR="$ROOT/skills"
FAMILIES_DIR="$HERE/checks"

plural() { # plural <count> <singular> <plural>
  if [ "$1" -eq 1 ]; then printf '%d %s' "$1" "$2"; else printf '%d %s' "$1" "$3"; fi
}

families() { # every check family, in a stable order, proofs excluded
  local f
  for f in "$FAMILIES_DIR"/*.sh; do
    [ -e "$f" ] || continue
    case "$f" in *.proof.sh) continue ;; esac
    printf '%s\n' "$f"
  done
}

skills() { # every directory under skills/, one level, in a stable order
  local d
  for d in "$SKILLS_DIR"/*/; do
    [ -d "$d" ] || continue
    printf '%s\n' "${d%/}"
  done
}

# ── --list . the rules in force, straight from the families ───────────────────
if [ "${1:-}" = "--list" ]; then
  echo "==== check-skills . the rules in force ===="
  echo
  n_fam=0; n_rule=0
  while IFS= read -r fam; do
    n_fam=$((n_fam + 1))
    printf -- '-- %s\n' "$(basename "$fam" .sh)"
    if [ ! -x "$fam" ]; then
      printf '   x not executable -- its rules cannot be asked for\n'
      continue
    fi
    while IFS= read -r rule; do
      [ -n "$rule" ] || continue
      n_rule=$((n_rule + 1))
      printf '   . %s\n' "$rule"
    done < <("$fam" --describe 2>&1)
  done < <(families)
  echo
  if [ "$n_fam" -eq 0 ]; then
    echo "NO RULES - $FAMILIES_DIR holds no check family."
    exit 1
  fi
  printf '%s, %s.\n' "$(plural "$n_fam" "family" "families")" "$(plural "$n_rule" "rule" "rules")"
  exit 0
fi

if [ $# -gt 0 ]; then
  echo "usage: $(basename "$0") [--list]" >&2
  exit 2
fi

# ── the run ───────────────────────────────────────────────────────────────────
# Read into arrays without `mapfile`, which arrived in bash 4: this gate is not
# worth losing to whichever bash a machine happens to ship.
FAMILY_LIST=(); while IFS= read -r f; do FAMILY_LIST+=("$f"); done < <(families)
SKILL_LIST=();  while IFS= read -r d; do SKILL_LIST+=("$d");  done < <(skills)

n_fam=${#FAMILY_LIST[@]}
n_skill=${#SKILL_LIST[@]}

printf '==== check-skills . %s x %s ====\n\n' \
  "$(plural "$n_skill" "skill" "skills")" \
  "$(plural "$n_fam" "family" "families")"

# A gate that finds nothing to measure and reports success is the exact failure
# this whole file exists to prevent, so it is red, loudly, in both directions.
if [ "$n_skill" -eq 0 ]; then
  echo "NOTHING MEASURED - no skill directory found under $SKILLS_DIR."
  exit 1
fi
if [ "$n_fam" -eq 0 ]; then
  echo "NOTHING MEASURED - no check family found under $FAMILIES_DIR."
  exit 1
fi

failures=0
checks=0
skills_red=0

for skill in "${SKILL_LIST[@]}"; do
  printf -- '-- %s\n' "$(basename "$skill")"
  skill_had_failure=0
  for fam in "${FAMILY_LIST[@]}"; do
    name="$(basename "$fam" .sh)"
    checks=$((checks + 1))

    if [ ! -x "$fam" ]; then
      printf '   x %s\n       | not executable -- a family is a program, and this one cannot run\n' "$name"
      failures=$((failures + 1)); skill_had_failure=1
      continue
    fi

    out="$("$fam" "$skill" 2>&1)"; code=$?
    if [ "$code" -eq 0 ]; then
      printf '   . %s\n' "$name"
      continue
    fi

    # A family that blows up is red, never green: an unreadable verdict is not a
    # pass. Codes above 1 mean the family itself broke, not the skill.
    if [ "$code" -gt 1 ]; then
      printf '   x %s\n       | the family itself failed (exit %d) -- its verdict on this skill is unknown\n' "$name" "$code"
    else
      printf '   x %s\n' "$name"
    fi
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      printf '       | %s\n' "$line"
    done <<< "$out"
    failures=$((failures + 1)); skill_had_failure=1
  done
  if [ "$skill_had_failure" -eq 1 ]; then skills_red=$((skills_red + 1)); fi
done

echo
if [ "$failures" -ne 0 ]; then
  printf 'SKILLS RED - %s across %s.\n' \
    "$(plural "$failures" "failure" "failures")" \
    "$(plural "$skills_red" "skill" "skills")"
  exit 1
fi
printf 'skills green - %s, %s, no failure.\n' \
  "$(plural "$n_skill" "skill" "skills")" \
  "$(plural "$checks" "check" "checks")"
exit 0
