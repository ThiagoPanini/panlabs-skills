#!/usr/bin/env python3
"""THE `panlabs` THEME, HELD AGAINST THE DOCUMENTATION IT IS A SNAPSHOT OF.

    workbench/panlabs-presentation-builder/tests/check-theme.py
    workbench/panlabs-presentation-builder/tests/check-theme.py --print

`skills/panlabs-presentation-builder/themes/panlabs/tokens.css` carries
LITERALS -- `#F77C55`, `rgb(244 246 250 / 0.07)` -- and the identity it copies
carries DERIVATIONS: `src/css/tokens.css` in `panlabs-docs` writes
`oklch(from var(--pd-brand) max(l, 0.72) c h)` and `rgb(from … / 7%)`, which
only resolve inside a CSS engine. A compiler that is `python3` and nothing
else has no engine, and a deck built at a customer's desk has no `panlabs-docs`
beside it -- so the theme is a snapshot, and a snapshot is a thing that can go
stale in silence. This is what refuses that.

IT COMPARES, IT NEVER SYNCS. #207 puts automatic synchronisation out of scope
on purpose: when the documentation moves, whether the decks move with it is a
decision. What this prints when they disagree is both values and the token
that carries them, so the decision can be made in one reading.

WITH NO `panlabs-docs` BESIDE THE REPOSITORY IT SKIPS, BY NAME, AND GREEN. The
one thing worse than an unchecked snapshot is a suite that a maintainer cannot
run because they happen not to have cloned a second repository.

THE RESOLVER IS ALSO THE GENERATOR. `--print` writes the same token block the
theme carries, resolved from the docs at this moment: the snapshot was made
with it, and refreshing the snapshot is that command's output pasted in. One
implementation, two uses -- a generator and a checker that were separate
programs would be two chances to disagree about what `oklch()` means.
"""

import argparse
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
THEME = os.path.join(SKILL, "themes", "panlabs")
DOCS_TOKENS = os.path.join("src", "css", "tokens.css")
DOCS_ENV = "PANLABS_DOCS"

# How far up to look for a sibling checkout. From this file the directory that
# HOLDS the repository is four levels up; from a worktree, which lives three
# deeper under `.claude/worktrees/<name>/`, it is seven. Eight covers both with
# a level to spare and stops long before `/` -- and a session that keeps its
# checkouts somewhere stranger than either sets `$PANLABS_DOCS`.
CLIMB = 8


# ── what the snapshot is a snapshot OF ───────────────────────────────────────
# The ONE place the two vocabularies are married. A pair here is a promise
# that the deck's token means what the docs' token means -- not that they are
# spelled alike, which they are not, and never were meant to be.
#
# `kind` says how the two values are compared, and there are only three:
#
#   colour  resolved to sRGB and compared as bytes. Everything derived lives
#           here -- the accent's lightness lock, the hairlines' alpha, the
#           state ramp's OKLCH.
#   length  compared as written, once whitespace is squeezed. `16px` is `16px`.
#   font    the fallbacks are compared in full, and the HEAD through the
#           manifest. The docs name the family a reader has installed
#           (`Inter`); the theme names the family the EMBEDDED face carries
#           (`Inter Variable`, straight off its `name` ID 1), because that is
#           the string the render gate's `platform-font` ruler reads back out
#           of Chromium. Holding those two to equality would fail a deck where
#           nothing is wrong -- but DROPPING the head would be worse, because
#           the family is the one thing in a font stack worth catching a drift
#           in: the docs could swap Inter for another face entirely and three
#           of these thirteen pairs would stay green. So the head goes through
#           `fonts/faces.json`, which records for each embedded face both the
#           family it carries and the `source` family it was cut from. The
#           theme's head must be a face the theme ships; that face's `source`
#           must be what the docs now name.
SNAPSHOT = (
    ("--surface", "--pd-surface-page", "colour"),
    ("--ink", "--pd-text-strong", "colour"),
    ("--ink-muted", "--pd-text-muted", "colour"),
    ("--accent", "--pd-accent", "colour"),
    ("--content-1", "--pd-state-info", "colour"),
    ("--content-2", "--pd-state-success", "colour"),
    ("--hairline-faint", "--pd-border-subtle", "colour"),
    ("--hairline", "--pd-border-default", "colour"),
    ("--hairline-strong", "--pd-border-strong", "colour"),
    ("--radius", "--pd-radius", "length"),
    ("--font-display", "--pd-font-heading", "font"),
    ("--font-body", "--pd-font-body", "font"),
    ("--font-mono", "--pd-font-mono", "font"),
)

# DARK IS `:root` ITSELF, and light is an override laid over it -- which is
# how the documentation is written ("dark lives in :root because the canonical
# mode is the FALLBACK"). Reading the light block ALONE would lose every
# literal it never restates: the grey ramp, the brand, the state hues, the
# radius and the three font stacks all live in `:root` and are the same in
# both appearances.
CANONICAL = ":root"
MODES = {
    "dark": CANONICAL,
    "light": ":root[data-theme='light']",
}


# ── colour, from OKLCH to the eight bits a snapshot can carry ────────────────
# The matrices are the published OKLab ones (Björn Ottosson), and sRGB's own
# primaries and transfer function. Nothing here is tuned: every number is a
# constant somebody else standardised, and a value that disagreed with a
# browser by more than a rounding step would be a bug in this file rather than
# a difference of opinion.

_M1 = ((0.8189330101, 0.3618667424, -0.1288597137),
       (0.0329845436, 0.9293118715, 0.0361456387),
       (0.0482003018, 0.2643662691, 0.6338517070))
_M2 = ((0.2104542553, 0.7936177850, -0.0040720468),
       (1.9779984951, -2.4285922050, 0.4505937099),
       (0.0259040371, 0.7827717662, -0.8086757660))


def _to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _to_srgb(c):
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def rgb_to_oklch(r, g, b):
    lr, lg, lb = _to_linear(r), _to_linear(g), _to_linear(b)
    x = 0.4123907993 * lr + 0.3575843394 * lg + 0.1804807884 * lb
    y = 0.2126390059 * lr + 0.7151686788 * lg + 0.0721923154 * lb
    z = 0.0193308187 * lr + 0.1191947798 * lg + 0.9505321522 * lb
    lms = [row[0] * x + row[1] * y + row[2] * z for row in _M1]
    lms = [math.copysign(abs(v) ** (1 / 3), v) for v in lms]
    lab = [row[0] * lms[0] + row[1] * lms[1] + row[2] * lms[2] for row in _M2]
    L, a, bb = lab
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def oklch_to_rgb(L, C, H):
    """OKLCH to sRGB, CLIPPED PER CHANNEL rather than gamut-mapped.

    Two stops of the docs' state ramp are outside sRGB at 80% lightness, and a
    browser resolving them reduces chroma until they fit (CSS Color 4), which
    lands a hair off the clip. The identity report that produced this snapshot
    clipped; the theme carries the clipped literals; this clips too. What
    matters for a drift check is that the same arithmetic is on both sides of
    the comparison, and what matters for the deck is that the difference is
    smaller than anything an eye reads off a projector.
    """
    h = math.radians(H)
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    x = 1.2270138511 * l_ - 0.5577999807 * m_ + 0.2812561490 * s_
    y = -0.0405801784 * l_ + 1.1122568696 * m_ - 0.0716766787 * s_
    z = -0.0763812845 * l_ - 0.4214819784 * m_ + 1.5861632204 * s_
    linear = (3.2409699419 * x - 1.5373831776 * y - 0.4986107603 * z,
              -0.9692436363 * x + 1.8759675015 * y + 0.0415550574 * z,
              0.0556300797 * x - 0.2039769589 * y + 1.0569715142 * z)
    return tuple(min(1.0, max(0.0, _to_srgb(v))) for v in linear)


class Unresolved(Exception):
    """The docs said something this resolver does not know how to read."""


HEX = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
FUNC = re.compile(r"^([a-z]+)\((.*)\)$", re.S)
VAR = re.compile(r"^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$")


def _split(text):
    """Top-level arguments of a CSS function: split on space and comma, but
    never inside a nested `f(...)`."""
    out, depth, current = [], 0, ""
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if depth == 0 and (ch.isspace() or ch == ","):
            if current:
                out.append(current)
                current = ""
            continue
        current += ch
    if current:
        out.append(current)
    return out


def _number(text, of=1.0):
    """A CSS number, with `%` read as a fraction of `of`.

    A unit this does not know -- `240deg`, `1turn`, a `calc()` -- comes back as
    `Unresolved` and not as a `ValueError`, because `compare()` promises the
    reader a fix ("teach check-theme.py to read …") and a traceback is not one.
    """
    text = text.strip()
    try:
        if text.endswith("%"):
            return float(text[:-1]) / 100 * of
        return float(text)
    except ValueError:
        raise Unresolved(text) from None


def _channel(expr, value):
    """One channel of a relative colour: `l`, `max(l, 0.72)`, `min(l, 0.50)`.

    The docs use exactly these three shapes and nothing else; anything wider
    would be this resolver guessing at a CSS engine it is not.
    """
    expr = expr.strip()
    if expr in ("l", "c", "h", "r", "g", "b"):
        return value
    m = FUNC.match(expr)
    if m and m.group(1) in ("max", "min"):
        args = [a for a in m.group(2).split(",")]
        others = [_number(a) for a in args if a.strip() not in ("l", "c", "h")]
        if len(others) != len(args) - 1:
            raise Unresolved(expr)
        return (max if m.group(1) == "max" else min)(value, *others)
    raise Unresolved(expr)


def resolve_colour(value, look):
    """A declaration's value as (r, g, b, alpha), each 0..1."""
    value = " ".join(value.split())
    m = VAR.match(value)
    if m:
        return resolve_colour(look(m.group(1)), look)
    m = HEX.match(value)
    if m:
        digits = m.group(1)
        if len(digits) == 3:
            digits = "".join(c * 2 for c in digits)
        return tuple(int(digits[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)
    m = FUNC.match(value)
    if not m:
        raise Unresolved(value)
    name, body = m.group(1), m.group(2)
    args = _split(body.replace("/", " / "))
    if name == "oklch":
        if args[0] == "from":
            r, g, b, alpha = resolve_colour(args[1], look)
            L, C, H = rgb_to_oklch(r, g, b)
            L = _channel(args[2], L)
            C = _channel(args[3], C)
            H = _channel(args[4], H)
        else:
            alpha = 1.0
            L = _number(args[0])
            C = _number(args[1])
            hue = args[2]
            H = _number(look(VAR.match(hue).group(1)) if VAR.match(hue) else hue)
        return oklch_to_rgb(L, C, H) + (alpha,)
    if name == "rgb":
        if args[0] != "from":
            channels = [a for a in args if a != "/"]
            rgb = tuple(_number(c, 255) / 255 for c in channels[:3])
            alpha = _number(channels[3]) if len(channels) > 3 else 1.0
            return rgb + (alpha,)
        r, g, b, _ = resolve_colour(args[1], look)
        rest = args[2:]
        alpha = 1.0
        if "/" in rest:
            cut = rest.index("/")
            alpha = _number(rest[cut + 1])
            rest = rest[:cut]
        return (_channel(rest[0], r), _channel(rest[1], g), _channel(rest[2], b), alpha)
    raise Unresolved(value)


def spell(rgba):
    """A colour written the way `themes/panlabs/tokens.css` writes it."""
    r, g, b, alpha = rgba
    channels = tuple(round(c * 255) for c in (r, g, b))
    if alpha >= 1:
        return "#%02X%02X%02X" % channels
    return "rgb(%d %d %d / %s)" % (channels + (("%.2f" % alpha).rstrip("0").rstrip("."),))


# ── reading a stylesheet ─────────────────────────────────────────────────────

def declarations(css, selector):
    """Every custom property one selector sets, later declaration winning.

    ONLY BLOCKS AT THE TOP LEVEL. `tokens.css` also carries a `:root` nested
    inside a `@media (min-width: 997px)`, and a scan that swept it up would
    have a token's value depend on a viewport nobody projects at. Reading each
    top-level block WHOLE, with `_body`, is what keeps the nested one out
    without this having to know what `@media` is.

    A `;` AT THE TOP LEVEL ENDS A SELECTOR TOO. `@charset "utf-8";`,
    `@import …;` and `@layer a, b;` are statements rather than blocks, and text
    that only ever reset on a brace would glue one of them onto the front of
    the next selector -- `@charset "utf-8" :root` matches nothing, the block
    vanishes, and every pair comes back as "the snapshot is missing it".
    """
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out, head, i = {}, "", 0
    while i < len(css):
        ch = css[i]
        if ch == "{":
            take = " ".join(head.split()) == selector
            head = ""
            body, i = _body(css, i + 1)
            if take:
                out.update(_pairs(body))
            continue
        if ch in ";}":
            head = ""
        else:
            head += ch
        i += 1
    return out


def _body(css, i):
    """From just inside a `{` to just past its matching `}`."""
    depth, start = 1, i
    while i < len(css) and depth:
        if css[i] == "{":
            depth += 1
        elif css[i] == "}":
            depth -= 1
        i += 1
    return css[start:i - 1], i


def _pairs(body):
    out = {}
    for line in re.split(r";", body):
        if ":" not in line:
            continue
        name, _, value = line.partition(":")
        name = name.strip()
        if name.startswith("--"):
            out[name] = " ".join(value.split())
    return out


def stack(value):
    """A font stack as a list of family names, quotes and spacing gone."""
    return [f.strip().strip("'\"") for f in value.split(",") if f.strip()]


def _flat(value, look):
    """A declaration whose whole value is `var(--x)`, followed one hop.

    The docs alias rather than repeat -- `--pd-font-heading: var(--pd-font-body)`
    is the sentence "headings are the body face" -- and a comparison that read
    the alias as a family name would be comparing a token to a token.
    """
    m = VAR.match(value)
    return look(m.group(1)) if m else value


def shipped(theme_dir):
    """Every face the theme embeds, as `family -> source`.

    Empty when the theme ships none, which is `base`: there is no manifest to
    read and the head of its stack is a family the machine supplies, so the
    docs' head and the theme's head are compared to each other directly.
    """
    path = os.path.join(theme_dir, "fonts", "faces.json")
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    return {f["family"]: f.get("source") for f in manifest.get("faces", [])}


def head_fix(token, theirs_name, ours_head, theirs_head, faces):
    """The fix for a font stack whose first family no longer lines up, or None."""
    if not faces:
        if ours_head == theirs_head:
            return None
        return (
            f'set the head of {token} to "{theirs_head}" in themes/panlabs/tokens.css '
            f'— it names "{ours_head}", and {theirs_name} in the docs now leads with '
            f'"{theirs_head}"'
        )
    if ours_head not in faces:
        return (
            f'set the head of {token} to a face themes/panlabs/fonts/faces.json ships '
            f'— it names "{ours_head}", which no @font-face the theme writes declares, '
            "so the render gate's platform-font ruler can never match it"
        )
    source = faces[ours_head]
    if source != theirs_head:
        return (
            f'cut a new face from "{theirs_head}" and point {token} at it, or accept '
            f'the drift on purpose — the theme embeds "{ours_head}", which faces.json '
            f'says was cut from "{source}", and {theirs_name} in the docs now leads '
            f'with "{theirs_head}"'
        )
    return None


# ── finding the documentation ────────────────────────────────────────────────

def find_docs():
    """Where `panlabs-docs` is, or None. `$PANLABS_DOCS` wins when it is set."""
    said = os.environ.get(DOCS_ENV, "").strip()
    if said:
        path = os.path.join(said, DOCS_TOKENS)
        return path if os.path.isfile(path) else None
    here = HERE
    for _ in range(CLIMB):
        here = os.path.dirname(here)
        path = os.path.join(here, "panlabs-docs", DOCS_TOKENS)
        if os.path.isfile(path):
            return path
    return None


# ── the check ────────────────────────────────────────────────────────────────

def tokens_of(css, mode):
    """The docs' tokens as one appearance sees them: `:root`, then the override."""
    out = declarations(css, CANONICAL)
    if MODES[mode] != CANONICAL:
        out.update(declarations(css, MODES[mode]))
    return out


def compare(theme_css, docs_css, mode, faces=None):
    """Every pair of SNAPSHOT, as a list of fixes -- empty when they agree."""
    faces = faces or {}
    theirs = tokens_of(docs_css, mode)
    if not theirs:
        return [
            f"point --docs at a tokens.css that declares {CANONICAL} — the one "
            "given has no such block, and every pair below would be measured "
            "against nothing"
        ]
    ours = declarations(theme_css, CANONICAL)

    def look(name):
        if name not in theirs:
            raise Unresolved(name)
        return theirs[name]

    fixes = []
    for token, theirs_name, kind in SNAPSHOT:
        if token not in ours:
            fixes.append(
                f"declare {token} in themes/panlabs/tokens.css — the snapshot is "
                f"missing it, and {theirs_name} in the docs has nowhere to be "
                "compared against"
            )
            continue
        mine = ours[token]
        try:
            if kind == "colour":
                want = spell(resolve_colour(look(theirs_name), look))
                # THE THEME'S OWN VALUE IS RESOLVED THROUGH THE THEME'S OWN
                # DECLARATIONS. It is literals today, so nothing is looked up
                # at all -- but resolving it through the docs' table would mean
                # a `var()` in the snapshot silently picking up the docs' value
                # and agreeing with itself.
                got = spell(resolve_colour(mine, ours.__getitem__))
            elif kind == "length":
                want, got = _flat(look(theirs_name), look), mine
            else:
                theirs_stack = stack(_flat(look(theirs_name), look))
                ours_stack = stack(mine)
                want, got = theirs_stack[1:], ours_stack[1:]
                bad = head_fix(token, theirs_name, ours_stack[0],
                               theirs_stack[0], faces)
                if bad:
                    fixes.append(bad)
        except Unresolved as e:
            fixes.append(
                f"teach check-theme.py to read {e} — resolving {theirs_name} for "
                f"{token} ran into a shape this file does not know, and a token "
                "it cannot resolve is a token it cannot hold anything to"
            )
            continue
        if want != got:
            said = ", ".join(want) if isinstance(want, list) else want
            has = ", ".join(got) if isinstance(got, list) else got
            fixes.append(
                f"set {token} to {said} in themes/panlabs/tokens.css, or accept "
                f"the drift on purpose — it carries {has}, and {theirs_name} in "
                f"the docs now resolves to {said}"
            )
    return fixes


def snapshot(docs_css, mode):
    """The token block, resolved from the docs at this moment."""
    theirs = tokens_of(docs_css, mode)

    def look(name):
        if name not in theirs:
            raise Unresolved(name)
        return theirs[name]

    lines = [":root {"]
    for token, theirs_name, kind in SNAPSHOT:
        value = look(theirs_name)
        m = VAR.match(value)
        if kind == "colour":
            value = spell(resolve_colour(value, look))
        elif m:
            value = look(m.group(1))
        lines.append(f"  {token}: {value};")
    lines.append("}")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="check-theme.py",
        description="Hold themes/panlabs against the panlabs-docs tokens it snapshots.",
    )
    ap.add_argument("--print", dest="show", action="store_true",
                    help="print the token block resolved from the docs, instead of comparing")
    ap.add_argument("--mode", default="dark", choices=sorted(MODES),
                    help="which appearance of the docs to read (default: dark)")
    ap.add_argument("--theme", default=THEME,
                    help="the theme DIRECTORY to hold — its tokens.css and its\n"
                         "fonts/faces.json (default: the real one)")
    ap.add_argument("--docs", default=None,
                    help="the docs' tokens.css (default: found beside the repository)")
    args = ap.parse_args(argv)

    docs = args.docs or find_docs()
    if not docs:
        print(f"── theme · SKIP — no panlabs-docs beside this repository; the "
              f"{len(SNAPSHOT)} token pairs went unmeasured")
        print(f"   clone it as a sibling of the repository, or set {DOCS_ENV}=<path> "
              "— the snapshot in themes/panlabs/ is what a deck paints with either way")
        return 0
    if not os.path.isfile(docs):
        print(f"── theme · point --docs at a file that exists — {docs} is not one")
        return 1

    docs_css = open(docs, encoding="utf-8").read()
    if args.show:
        print(snapshot(docs_css, args.mode))
        return 0

    theme_css = open(os.path.join(args.theme, "tokens.css"), encoding="utf-8").read()
    fixes = compare(theme_css, docs_css, args.mode, shipped(args.theme))
    total = f"{len(SNAPSHOT)} token pairs"
    print(f"── theme · themes/panlabs against {docs} · {args.mode}")
    if fixes:
        print(f"   ✗ theme-drift · every token of the snapshot still says what the docs say")
        for fix in fixes:
            print(f"       | {fix}")
        print(f"   {total}, {len(fixes)} adrift")
        return 1
    print("   ✓ theme-drift · every token of the snapshot still says what the docs say")
    print(f"   {total}, green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
