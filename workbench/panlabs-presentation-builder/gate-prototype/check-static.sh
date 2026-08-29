#!/usr/bin/env bash
# PROTOTYPE static gate for a single-file HTML deck. Reads the bytes only --
# no browser, no network, no font library.
set -uo pipefail

PALETTE="141415 F3F3F3 2C2C2F FFFFFF CD1335 C75000 7634D2 4EA9D0 5FAB80 FF6201 000000"

if [ "${1:-}" = "--describe" ]; then
  cat <<'EOF'
no attribute and no CSS url() points off the machine -- http:, https:, protocol-relative, or @import
<style> and <script> are present and carry their payload inline, never through src= or href=
every font-family named in the CSS resolves to an @font-face whose src is a data: URI
every base64 font payload decodes and opens with an sfnt signature
every hex colour in the CSS is one of the 11 measured tokens
the deck declares at least one .slide and at least one [data-step]
EOF
  exit 0
fi

F="${1:-}"
[ -n "$F" ] || { echo "usage: $(basename "$0") [--describe] <deck.html>" >&2; exit 2; }
[ -f "$F" ] || { echo "not a file: $F" >&2; exit 2; }

fail=0
say() { echo "$1"; fail=1; }

# strip HTML and CSS comments: a pattern quoted in a comment is not the pattern in the document
SCRUB="$(mktemp)"; trap 'rm -f "$SCRUB"' EXIT
sed -e 's|/\*[^*]*\*/||g' "$F" | sed -e 's|<!--.*-->||g' > "$SCRUB"

# rule 1 . nothing points off the machine
while IFS= read -r u; do
  say "references $u -- a deck with zero network dependency cannot name a host"
done < <(grep -oE '(href|src|srcset)="(https?:)?//[^"]*"|url\(\s*['"'"'"]?(https?:)?//[^)]*\)|@import[^;]*(https?:)?//[^;]*' "$SCRUB" | cut -c1-70 | sort -u)

# rule 2 . the payload is inline
grep -qE '<style[^>]*>' "$SCRUB" || say "no <style> block -- the theme is not in the file"
grep -qE '<script([^>]*)?>' "$SCRUB" && ! grep -oE '<script[^>]*>' "$SCRUB" | grep -qv 'src=' \
  && say "every <script> in the file carries src= -- no engine body is inline"
grep -qE '<script[^>]+src=' "$SCRUB" && say "a <script> carries its body through src= instead of inline"
grep -qE '<link[^>]+rel="stylesheet"' "$SCRUB" && say "a <link rel=stylesheet> carries the theme instead of an inline <style>"

# rule 3 . every declared family has an embedded face
GENERIC=" sans-serif serif monospace cursive fantasy system-ui inherit initial unset "
while IFS= read -r fam; do
  case "$GENERIC" in *" $fam "*) continue ;; esac
  block="$(tr '\n' ' ' < "$SCRUB" | grep -oE "@font-face[^}]*font-family:[^;]*['\"]?$fam['\"]?[^}]*}")"
  if [ -z "$block" ]; then
    say "font-family names \"$fam\" and no @font-face in this file declares it -- the browser will silently paint a fallback"
  elif ! grep -qE 'src:[^;}]*url\(\s*["'"'"']?data:' <<< "$block"; then
    say "the @font-face for \"$fam\" has no src: url(data:...) -- the face is not embedded and the browser will silently paint a fallback"
  fi
done < <(grep -oE "font-family:[^;}]*" "$SCRUB" | \
         sed -e 's/font-family://' -e "s/['\"]//g" | tr ',' '\n' | sed -e 's/^ *//' -e 's/ *$//' | grep -v '^var(' | grep -v '^$' | sort -u)

# rule 4 . every embedded face is a real font
i=0
while IFS= read -r b; do
  i=$((i+1))
  sig="$(printf '%s' "$b" | base64 -d 2>/dev/null | head -c 4 | od -An -tx1 | tr -d ' \n')"
  case "$sig" in
    00010000|4f54544f|74727565|74746366|774f4646|774f4632) : ;;
    "") say "embedded font #$i is not decodable base64 -- the face will never load" ;;
    *)  say "embedded font #$i decodes to signature 0x$sig, which is not an sfnt/WOFF signature -- the face will never load" ;;
  esac
done < <(grep -oE 'base64,[A-Za-z0-9+/=]{40,}' "$SCRUB" | sed 's/^base64,//')

# rule 5 . every hex is a measured token
while IFS= read -r h; do
  up="$(printf '%s' "${h#\#}" | tr 'a-f' 'A-F')"
  [ ${#up} -eq 3 ] && up="${up:0:1}${up:0:1}${up:1:1}${up:1:1}${up:2:1}${up:2:1}"
  case " $PALETTE " in *" $up "*) : ;;
    *) say "hex #$up is in the CSS and is not one of the 11 measured tokens -- the identity is defined by measurement, not by taste" ;;
  esac
done < <(sed -e 's/base64,[A-Za-z0-9+/=]*/base64,X/g' "$SCRUB" | grep -oE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b' | sort -u)

# rule 6 . the skeleton got filled
n_slides="$(grep -oE 'class="slide[^"]*"' "$SCRUB" | wc -l | tr -d ' ')"
n_steps="$(grep -oE 'data-step="' "$SCRUB" | wc -l | tr -d ' ')"
[ "$n_slides" -ge 1 ] || say "the file declares $n_slides slide(s) -- the skeleton was never filled"
[ "$n_steps" -ge 1 ] || say "the file declares $n_steps step(s) -- reveal by step is in the skeleton and absent from the deck"

[ "$fail" -eq 0 ] && exit 0
exit 1
