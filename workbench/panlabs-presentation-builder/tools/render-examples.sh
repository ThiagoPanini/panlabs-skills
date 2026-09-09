#!/usr/bin/env bash
# ONE COMMAND REBUILDS EVERY DERIVED BYTE THE CORPUS HAS.
#
#   workbench/panlabs-presentation-builder/tools/render-examples.sh [DIR]
#
# For each source under `skills/panlabs-presentation-builder/examples/` it runs
# THE DOCUMENTED BUILD COMMAND, in the theme that source's own header declares,
# and lands three files per deck in DIR (default `../renders/`): the single-file
# `.html`, the `.storyboard.md` the compiler writes beside it, and the
# `.contact-sheet.png` the render gate takes -- the picture that exists so a
# PERSON can look at the whole deck at once, which is the half of this skill no
# ruler judges.
#
# ⚠️ WHAT IT WRITES IS NOT VERSIONED, AND THAT IS A MEASURED DECISION, NOT AN
# OVERSIGHT. `.gitignore` carries the reason in the #62's own words: a committed
# render nobody compares is not evidence, it ages in silence, and when that
# repository last measured one, four of four committed artefacts had drifted from
# what their generator produced with nothing anywhere going red. So the guarantee
# #219 asks for ("derivado se regenera") is THIS COMMAND, not a directory of
# pictures: what proves the corpus renders is the gate running, and what a person
# looks at is one command away rather than one `git pull` stale.
#
# ⚠️ IT WRITES OUTSIDE THE SKILL, always. `SKILL.md` promises that nothing is
# ever written inside the installed tree, and layer 6's `writes-outside` family
# holds the document to it; a tool that dropped a megabyte of PNG into
# `examples/` would make that promise false from the maintainer's side.
#
# Without a Chromium on the machine the render gate degrades to a named SKIP,
# exactly as it does everywhere else here: the `.html` and the `.storyboard.md`
# still land, and the contact sheets do not. The count at the end says which
# happened rather than claiming a picture nobody took.
set -uo pipefail

export PYTHONDONTWRITEBYTECODE=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL="$(cd "$HERE/../../../skills/panlabs-presentation-builder" && pwd)" || {
  echo "the skill tree is not where this tool expects it — nothing to build"
  exit 1
}

OUTPUT_DIR="${1:-$HERE/../renders}"
mkdir -p "$OUTPUT_DIR" || {
  echo "could not make $OUTPUT_DIR — pass a directory this user can write to"
  exit 1
}
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"

case "$OUTPUT_DIR/" in
  "$SKILL"/*)
    echo "refused: $OUTPUT_DIR is inside the skill tree, and nothing is ever"
    echo "written in there — pass a directory outside it, or none at all"
    exit 1
    ;;
esac

built=0
sheets=0
bad=0
for src in "$SKILL"/examples/*.deck.html; do
  [ -e "$src" ] || break
  name="$(basename "$src" .deck.html)"
  if python3 "$SKILL/compiler/build.py" "$src" "$OUTPUT_DIR/$name.html"; then
    built=$((built + 1))
    [ -e "$OUTPUT_DIR/$name.contact-sheet.png" ] && sheets=$((sheets + 1))
  else
    bad=$((bad + 1))
  fi
done

echo
if [ "$((built + bad))" -eq 0 ]; then
  echo "examples/ has no source to build — there is nothing derived to regenerate"
  exit 1
fi
if [ "$bad" -ne 0 ]; then
  echo "✗ $bad of $((built + bad)) source(s) refused — fix what the compiler named above"
  exit 1
fi
if [ "$sheets" -eq "$built" ]; then
  echo "✓ $built deck(s) rebuilt in $OUTPUT_DIR, each with its storyboard and its contact sheet"
else
  echo "✓ $built deck(s) rebuilt in $OUTPUT_DIR, each with its storyboard;"
  echo "  $sheets of $built contact sheets — the render gate SKIPped for want of a"
  echo "  Chromium, so there is nothing to look at"
fi
