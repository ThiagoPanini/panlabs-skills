#!/usr/bin/env python3
"""THE DOCUMENTED COMMAND: a source and a theme in, one HTML file out.

    python3 compiler/build.py <source.deck.html> <output.html> [--theme base]

WHAT COMES OUT IS ONE FILE AND NOTHING ELSE. The theme is inlined, the script
is inline, and there is no external reference on the page -- which is the
whole of the promise that a deck opens on a corporate network with the cable
pulled. The output is byte-identical for the same source and theme: there is
no clock in it, so rebuilding after a one-word fix produces a diff of one
word.

THE AUDIT IS PRINTED ON EVERY RUN, GREEN OR RED, and everything this command
has to say goes to stdout on purpose: an agent that runs it reads one stream
and gets both the verdict and the path. The exit code is the verdict -- 0 the
file was written, 1 it was not.

A RED AUDIT WRITES NOTHING. Half a deck on disk is worse than no deck,
because it looks built.
"""

import argparse
import html
import os
import re
import subprocess
import sys

# BEFORE THE SIBLING IMPORTS, OR IT IS SET TOO LATE. Importing `catalog`,
# `source` and `audit` writes `compiler/__pycache__/` into the skill's own
# tree -- and the skill is usually a symlink to a checkout. `run.sh` and
# `install.sh` both set this in the environment because a ruler must not
# modify its subject; a human following SKILL.md sets nothing, so the command
# sets it for itself.
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from audit import audit, report                                # noqa: E402
from catalog import DECK_FIELDS, SLOT_TAG, role_of, slots_of   # noqa: E402
from source import Refused, inline_markup, read                # noqa: E402

THEMES = os.path.join(ROOT, "themes")
SKELETON = os.path.join(HERE, "stage.html")
MARKER = re.compile(r"\{\{[A-Z_]+\}\}")


def refuse(*fixes):
    """Stop, and say what to do about it. Never a diagnosis on its own.

    It takes a LIST because a source with three mistakes in it should cost one
    build and not three. Failing on the first one and stopping is the shape
    that sends a reader round the loop once per typo.
    """
    for fix in fixes:
        print(f"REFUSED · {fix}")
    raise SystemExit(1)


# ── the header ───────────────────────────────────────────────────────────────

def check_header(deck):
    said = ", ".join(DECK_FIELDS)
    fixes = [
        f"drop {key}= from the <deck> — the header says {said}"
        for key in sorted(set(deck.header) - set(DECK_FIELDS))
    ]
    for key in DECK_FIELDS:
        if not deck.header.get(key, "").strip():
            article = "an" if key[0] in "aeiou" else "a"
            fixes.append(f"give the <deck> {article} {key}= — the header says {said}")

    minutes = deck.header.get("minutes", "").strip()
    if minutes and (not minutes.isdigit() or int(minutes) < 1):
        fixes.append(
            f'write minutes= as a whole number of minutes, not "{minutes}" — '
            "it is what sizes the deck against the time on the agenda"
        )
    if fixes:
        refuse(*fixes)


# ── the theme ────────────────────────────────────────────────────────────────

def theme_css(name):
    directory = os.path.join(THEMES, name)
    sheets = []
    if os.path.isdir(directory):
        sheets = sorted(f for f in os.listdir(directory) if f.endswith(".css"))
    if not sheets:
        have = sorted(
            d for d in os.listdir(THEMES) if os.path.isdir(os.path.join(THEMES, d))
        )
        refuse(f'build with a theme this skill carries: {", ".join(have)} — "{name}" is not one')
    return "\n".join(
        open(os.path.join(directory, s), encoding="utf-8").read().rstrip()
        for s in sheets
    )


# ── the slides ───────────────────────────────────────────────────────────────

def slide_markup(slide, index):
    """One section, with its slots in the order the CATALOG declares them.

    Source order is what the author happened to type; catalog order is what
    the pattern IS. Emitting the second is what keeps composition the engine's
    job rather than a thing each deck re-decides.

    THE ROLE TRAVELS WITH THE SLOT, as `data-role=`. The stage styles a `meta`
    line by its role and not by a hand-kept list of slot names, so the pattern
    a later ticket adds inherits the treatment instead of restating it -- and
    the register stays the only place that decides what a slot IS. It appears
    on the built page and never in a source: the dialect's rule that a slot
    carries `class=` and nothing else is about what an author writes.
    """
    pattern = slide.attrs["pattern"]
    written = {}
    for el in slide.elements():
        written.setdefault(el.attrs.get("class", "").strip(), el)

    body = [
        f'<{SLOT_TAG} class="{name}" data-role="{role_of(pattern, name)}">'
        f"{inline_markup(written[name])}</{SLOT_TAG}>"
        for name in slots_of(pattern)
        if name in written
    ]
    current = " is-current" if index == 0 else ""
    return (
        f'<section class="slide{current}" data-pattern="{html.escape(pattern)}"'
        f' aria-label="slide {index + 1}">\n'
        + "\n".join(body)
        + "\n</section>"
    )


# ── the skeleton ─────────────────────────────────────────────────────────────

def fill(skeleton, holes):
    """Fill every hole exactly once, and refuse anything else.

    A marker that appears zero times means the content vanished with no error
    anywhere; twice means half the page disagrees with the other half. Both
    ship something that looks built, which is the only kind of defect worth
    stopping a build over.
    """
    for name in holes:
        token = "{{" + name + "}}"
        found = skeleton.count(token)
        if found != 1:
            refuse(
                f"put {token} in compiler/stage.html exactly once — it is "
                f"there {found} times, and the page would be built around a hole"
            )

    def pick(match):
        name = match.group(0)[2:-2]
        if name not in holes:
            refuse(
                f"fill {match.group(0)} in compiler/stage.html or take it out "
                "— the built page would carry the marker instead of the content"
            )
        return holes[name]

    # ONE PASS, not one pass per hole. Substituting hole by hole re-reads what
    # the previous substitution just wrote, so a theme or a deck's own text
    # containing `{{SLIDES}}` would be filled a second time by a later round.
    return MARKER.sub(pick, skeleton)


# ── the render gate ─────────────────────────────────────────────────────────

def render_gate(output_path):
    """Hand the page just written to gate/render.cjs, best-effort (#209).

    NEVER CHANGES THIS COMMAND'S OWN EXIT CODE. This command's promise is "0
    the file was written, 1 it was not" -- a fact about the STATIC audit,
    settled before a single byte of the page exists to render. The render
    gate can only measure a page that already exists, so a render defect
    (or a missing Chromium) is printed for the reader to act on, never
    folded into the promise this exit code already makes.
    """
    gate = os.path.join(ROOT, "gate", "render.cjs")
    try:
        done = subprocess.run(
            ["node", gate, output_path],
            capture_output=True, text=True, timeout=120,
        )
        out = (done.stdout + done.stderr).strip()
        if out:
            print()
            print(out)
    except (OSError, subprocess.TimeoutExpired) as e:
        print()
        print(f"── render · SKIP — could not run the render gate ({e})")


# ── the command ──────────────────────────────────────────────────────────────

def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="build.py",
        description="Compile a deck source into one self-contained HTML file.",
    )
    ap.add_argument("source", help="the deck source, in the dialect")
    ap.add_argument("output", help="the .html file to write")
    ap.add_argument(
        "--theme",
        default=None,
        help="override the theme the source's header declares",
    )
    args = ap.parse_args(argv)

    if os.path.abspath(args.source) == os.path.abspath(args.output):
        refuse("write the deck somewhere other than over its own source")

    try:
        text = open(args.source, encoding="utf-8").read()
    except OSError as e:
        refuse(f"point at a source this command can read — {e.strerror}: {args.source}")

    try:
        deck = read(text)
    except Refused as e:
        refuse(str(e))

    check_header(deck)
    sections = deck.sections
    if not sections:
        refuse(
            "add a <section pattern=…> — a deck with no slide compiles to a "
            "page with nothing on it"
        )

    theme = args.theme or deck.theme
    css = theme_css(theme)

    verdicts = audit(deck)
    print(report(deck, theme, verdicts))
    if any(not v.ok for v in verdicts):
        raise SystemExit(1)

    try:
        slides = "\n".join(slide_markup(s, i) for i, s in enumerate(sections))
    except Refused as e:
        refuse(str(e))

    # The built page carries the header it was built from, field for field,
    # with `theme` resolved to the one actually used -- `--theme` may have
    # overridden what the source declared, and the artifact should say which
    # identity it is wearing rather than which one it asked for.
    header = dict(deck.header, theme=theme)
    attrs = " ".join(
        f'data-{k}="{html.escape(header[k], quote=True)}"' for k in DECK_FIELDS
    )
    page = fill(
        open(SKELETON, encoding="utf-8").read(),
        {
            "LANG": html.escape(deck.lang, quote=True),
            "TITLE": html.escape(deck.title),
            "THEME": css,
            "DECK_ATTRS": attrs,
            "SLIDES": slides,
            "PAGE_TOTAL": str(len(sections)),
        },
    )

    parent = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(parent, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(page)

    print(f"   wrote {args.output}")
    render_gate(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
