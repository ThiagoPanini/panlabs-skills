#!/usr/bin/env bash
# THE MEASUREMENT THAT CHOSE THE PRODUCTION ENGINE — reproducible, not asserted.
#
#   tools/measure-candidates.sh [ref]        # default: HEAD
#
# #23 asks for the engine to be chosen "by measurement, not by date", and a
# measurement that exists only in prose is exactly the kind of claim this
# ticket was born to end. So it runs: this script materializes the TWO
# candidates from git, puts each one in the other's place, and runs the UNION
# of the four prototypes' checks against both.
#
# ⚠️ THIS IS ARCHAEOLOGY, and that is why it is a tool and not a suite check. It
# depends on `prototypes/` existing at the requested ref. Once the prototypes
# leave the tree, the script says so and exits clean — the question it answers
# will already have been answered.
#
# THE COMMON ANCESTOR is `daf4bc4` and the number was not chosen: it is the
# commit where #13 forked the engine. Found like this, and verifiable:
#
#     git log --oneline -- skills/.../prototypes/q13/engine/derive.cjs
#     # -> daf4bc4, single commit; and at that commit
#     git show daf4bc4:.../q11/engine/derive.cjs | sha256sum
#     git show daf4bc4:.../q13/engine/derive.cjs | sha256sum   # the SAME hash
set -uo pipefail

REF="${1:-HEAD}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
REPO="$(cd "$ROOT/../.." && pwd)"
P="skills/panlabs-aws-diagrams/prototypes"
BASE="daf4bc4"

if ! git -C "$REPO" cat-file -e "$REF:$P/q13/engine/layout.cjs" 2>/dev/null; then
  echo "  the prototypes do not exist at '$REF' — there is nothing to measure."
  echo "  (this is the expected state once they leave the tree; the measurement"
  echo "   has already been made and recorded)"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ⚠️ THE `package.json` LEFT BEHIND IN /tmp — #22's bonus finding, and it kills
# this script silently if nobody guards against it.
#
# Extracting draw.io's AppImage leaves `/tmp/package.json` with
# `"type": "module"`. `elk.bundled.js` is `.js`, so Node looks for the nearest
# `package.json` walking up from its directory — and in a sandbox created by
# `mktemp -d` that file is draw.io's. elk's UMD then gets read as ESM and the
# error that comes out is `ELK is not a constructor`, which says nothing about
# any of this. A `package.json` of our own at the sandbox root ends the search
# first.
printf '{ "type": "commonjs" }\n' > "$TMP/package.json"

extract() {  # extract <ref> <path-in-repo> <destination>
  mkdir -p "$3"
  git -C "$REPO" archive "$1" "$2" | tar -x -C "$TMP/_x" 2>/dev/null || return 1
  cp -r "$TMP/_x/$2/." "$3"
}

# ── the two variants ─────────────────────────────────────────────────────────
# A: #11's engine in its own place.  B: #13's engine in #11's place, with the
# theme alongside it (that is where its `resolve.cjs` loads the theme from).
for V in A B; do
  rm -rf "$TMP/_x"; mkdir -p "$TMP/_x" "$TMP/$V"
  extract "$REF" "skills/panlabs-aws-diagrams/catalog" "$TMP/$V/catalog"
  rm -rf "$TMP/_x"; mkdir -p "$TMP/_x"
  extract "$REF" "$P" "$TMP/$V/prototypes"
done
rm -rf "$TMP/B/prototypes/q11/motor"
cp -r "$TMP/B/prototypes/q13/motor" "$TMP/B/prototypes/q11/motor"
cp -r "$TMP/B/prototypes/q13/tema"  "$TMP/B/prototypes/q11/tema"

# ── the union of the checks ─────────────────────────────────────────────────
measure_variant() {
  local R="$1" LABEL="$2"
  local Q11="$R/prototypes/q11" Q12="$R/prototypes/q12"
  local Q14="$R/prototypes/q14" Q18="$R/prototypes/q18"
  local red=0 total=0
  row() {
    local label="$1"; shift
    local output rc
    total=$((total+1))
    output="$("$@" 2>&1)"; rc=$?
    if [ $rc -eq 0 ]; then printf '    %-38s green\n' "$label"
    else
      printf '    %-38s RED  %s\n' "$label" \
        "$(echo "$output" | grep -iE '✗|error|inválido|falh' | head -1 | cut -c1-96)"
      red=$((red+1))
    fi
  }
  echo
  echo "  ── $LABEL"
  row "#11 boundary"        node "$Q11/tools/check-fronteira.cjs"
  row "#11 validation"      node "$Q11/tools/check-validation.cjs"
  for m in "$Q11"/models/*.json; do
    row "#11 generate $(basename "$m" .json)" \
      node "$Q11/engine/generate.cjs" "$m" --output "$Q11/output/$(basename "$m" .json).drawio"
  done
  row "#11 determinism"     node "$Q11/tools/check-determinism.cjs"
  row "#12 triggers"        node "$Q12/tools/check-triggers.cjs"
  for m in "$Q12"/models/*.json; do
    name="$(basename "$m" .json)"
    row "#12 generate $name" node "$Q11/engine/generate.cjs" "$m" \
      --output "$Q12/output/$(echo "$name" | sed 's/-[0-9]*-contas$//;s/-3-az$//').drawio"
  done
  row "#12 traversal"       node "$Q12/tools/check-traversal.cjs"
  row "#12 determinism"     node "$Q11/tools/check-determinism.cjs" "$Q12/modelo"
  row "#12 bisection"       node "$Q12/tools/bisect-model.cjs" "$Q12/models/hub-tgw-3-accounts.json"
  row "#14 boundary"        node "$Q14/tools/check-fronteira.cjs"
  row "#14 engine-untouched" node "$Q14/tools/check-engine-untouched.cjs"
  row "#14 session1"        node "$Q14/sessao1.cjs"
  row "#14 session2"        node "$Q14/sessao2.cjs"
  row "#14 projection"      node "$Q14/tools/check-projection.cjs"
  row "#14 fingerprint"     node "$Q14/tools/medir-fingerprint.cjs"
  row "#18 index"           node "$Q18/tests/check-index.cjs"
  row "#18 primitives"      node "$Q18/tests/check-primitives.cjs"
  row "#18 broken"          node "$Q18/tests/check-broken.cjs"
  row "#18 gate"            node "$Q18/tests/check-gate.cjs"
  row "#18 good"            node "$Q18/tests/check-good.cjs"
  printf '\n    ==> %s: %s RED(S) out of %s\n' "$LABEL" "$red" "$total"
}

echo "  the union of the four prototypes' checks, against the two candidates"
echo "  ref: $REF · common ancestor: $BASE"
measure_variant "$TMP/A" "A — #11's engine (with #12 and #22 inside)"
measure_variant "$TMP/B" "B — #13's engine (with the theme layer inside)"

# ── the size of the two deltas ──────────────────────────────────────────────
echo
echo "  the delta of each side from the common ancestor ($BASE)"
echo "  theme = q13/motor@$REF  ·  trunk = q11/motor@$REF (#12 plus #22)"
echo
printf '  %-16s %10s %10s\n' file 'theme #13' trunk
printf '  %s\n' "----------------------------------------"
sum_theme=0; sum_trunk=0
for f in align.cjs derive.cjs layout.cjs emit.cjs generate.cjs plan.cjs resolve.cjs validate.cjs schema.json; do
  count_diff() {  # count_diff <ref-a>:<path-a> <ref-b>:<path-b>
    local a b
    a="$TMP/_a"; b="$TMP/_b"
    git -C "$REPO" show "$1" > "$a" 2>/dev/null || : > "$a"
    git -C "$REPO" show "$2" > "$b" 2>/dev/null || : > "$b"
    diff -u "$a" "$b" | grep -c '^[+-][^+-]' || true
  }
  t="$(count_diff "$BASE:$P/q11/engine/$f" "$REF:$P/q13/engine/$f")"
  m="$(count_diff "$BASE:$P/q11/engine/$f" "$REF:$P/q11/engine/$f")"
  sum_theme=$((sum_theme + t)); sum_trunk=$((sum_trunk + m))
  printf '  %-16s %10s %10s\n' "$f" "$t" "$m"
done
printf '  %s\n' "----------------------------------------"
printf '  %-16s %10s %10s\n' TOTAL "$sum_theme" "$sum_trunk"
echo
echo "  Reading: the candidate with FEWER reds is the trunk; the SMALLER delta is"
echo "  the one that gets grafted in. Both columns point the same way, and that is"
echo "  what makes the decision measured instead of argued."
