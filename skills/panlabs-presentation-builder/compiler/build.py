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
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from audit import audit, report                        # noqa: E402
from catalog import DECK_FIELDS, SLOT_TAG, slots_of    # noqa: E402
from source import Refused, inline_markup, read        # noqa: E402

THEMES = os.path.join(ROOT, "themes")
SKELETON = os.path.join(HERE, "stage.html")
MARKER = re.compile(r"\{\{[A-Z_]+\}\}")


def refuse(fix):
    """Stop, and say what to do about it. Never a diagnosis on its own."""
    print(f"REFUSED · {fix}")
    raise SystemExit(1)


# ── the header ───────────────────────────────────────────────────────────────

def check_header(deck):
    said = ", ".join(DECK_FIELDS)
    for key in sorted(set(deck.header) - set(DECK_FIELDS)):
        refuse(f"drop {key}= from the <deck> — the header says {said}")
    for key in DECK_FIELDS:
        if not deck.header.get(key, "").strip():
            article = "an" if key[0] in "aeiou" else "a"
            refuse(f"give the <deck> {article} {key}= — the header says {said}")
    minutes = deck.header["minutes"].strip()
    if not minutes.isdigit() or int(minutes) < 1:
        refuse(
            f'write minutes= as a whole number of minutes, not "{minutes}" — '
            "it is what sizes the deck against the time on the agenda"
        )


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
    """
    pattern = slide.attrs["pattern"]
    written = {}
    for el in slide.elements():
        written.setdefault(el.attrs.get("class", "").strip(), el)

    body = [
        f'<{SLOT_TAG} class="{name}">{inline_markup(written[name])}</{SLOT_TAG}>'
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
    for name, value in holes.items():
        token = "{{" + name + "}}"
        found = skeleton.count(token)
        if found != 1:
            refuse(
                f"put {token} in compiler/stage.html exactly once — it is "
                f"there {found} times, and the page would be built around a hole"
            )
        skeleton = skeleton.replace(token, value)

    left = MARKER.search(skeleton)
    if left:
        refuse(
            f"fill {left.group(0)} in compiler/stage.html or take it out — the "
            "built page would carry the marker instead of the content"
        )
    return skeleton


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
    sections = [s for s in deck.slides if s.tag == "section"]
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

    attrs = " ".join(
        f'data-{k}="{html.escape(deck.header[k], quote=True)}"'
        for k in ("occasion", "minutes")
    )
    page = fill(
        open(SKELETON, encoding="utf-8").read(),
        {
            "LANG": html.escape(deck.lang, quote=True),
            "TITLE": html.escape(deck.title),
            "THEME": css,
            "DECK_ATTRS": f'data-theme="{html.escape(theme, quote=True)}" {attrs}',
            "SLIDES": slides,
            "PAGE_TOTAL": str(len(sections)),
        },
    )

    parent = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(parent, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(page)

    print(f"   wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
