#!/usr/bin/env bash
# THE PROOF LIBRARY -- sourced by every `*.proof.sh` in this tree, never run.
#
#   source "$(dirname "${BASH_SOURCE[0]}")/../proof.sh"
#
# WHY A PROOF EXISTS AT ALL. A check that has only ever been seen green is
# documentation: it passes by vacuity if its query is wrong, and nothing about
# the real tree fires it often enough for anyone to notice. A family ships with
# the defect planted and the red demanded, or it ships unmeasured.
#
# WHY THIS IS SHARED and the families are not. A family is written once and read
# by the runner through a two-verb contract, so it owes nothing to its
# neighbours. Its proof, by contrast, asserts the same three things every other
# proof asserts -- a throwaway tree, a verdict, a tally -- and six private copies
# of that would drift apart in six directions. This file is read by every proof
# and written by none of them, which is why sharing it costs no territory.
#
# The whole surface:
#
#   proof_begin <title>            headline, and reset the tally
#   proof_bench                    a throwaway directory in $PROOF_BENCH, removed on exit
#   expect <title> <green|red> <needle> <output> <code>
#   proof_verdict                  print the verdict and exit 0 green / 1 red
#
# `<needle>` is matched literally against `<output>`; pass "" to match nothing in
# particular. `green` means exit 0, `red` means any non-zero.

PROOF_FAILED=0
PROOF_CASES=0

proof_begin() {
  PROOF_FAILED=0
  PROOF_CASES=0
  printf '==== %s ====\n' "$1"
}

proof_bench() {
  PROOF_BENCH="$(mktemp -d)"
  # shellcheck disable=SC2064 -- expand $PROOF_BENCH now, it must survive the exit
  trap "rm -rf '$PROOF_BENCH'" EXIT
}

expect() { # expect <title> <green|red> <needle> <output> <code>
  local title="$1" want="$2" needle="$3" output="$4" code="$5"
  local got="green"
  [ "$code" -ne 0 ] && got="red"
  PROOF_CASES=$((PROOF_CASES + 1))

  if [ "$got" = "$want" ] && { [ -z "$needle" ] || grep -qF -- "$needle" <<< "$output"; }; then
    printf '   . %s\n' "$title"
    return 0
  fi

  if [ -z "$needle" ]; then
    printf '   x %s - wanted %s, got %s\n' "$title" "$want" "$got"
  else
    printf '   x %s - wanted %s containing "%s", got %s\n' "$title" "$want" "$needle" "$got"
  fi
  sed 's/^/       | /' <<< "$output"
  PROOF_FAILED=1
  return 1
}

proof_verdict() {
  echo
  if [ "$PROOF_FAILED" -ne 0 ]; then
    echo "PROOF RED - it does not measure what it claims to."
    exit 1
  fi
  printf 'proof green - %d case(s), every planted defect turned red.\n' "$PROOF_CASES"
  exit 0
}
