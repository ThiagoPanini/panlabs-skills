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
# `source`, `audit` and `icons` writes `compiler/__pycache__/` into the
# skill's own tree -- and the skill is usually a symlink to a checkout.
# `run.sh` and `install.sh` both set this in the environment because a ruler
# must not modify its subject; a human following SKILL.md sets nothing, so the
# command sets it for itself.
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import charts                                                   # noqa: E402
import figures                                                  # noqa: E402
import icons                                                    # noqa: E402
from audit import audit, report                                # noqa: E402
from catalog import (DECK_FIELDS, EVIDENCE_TAGS, ICON, MOTION_PROFILES,  # noqa: E402
                     NOTES_TAG, SLOT_TAG, STEP_ATTR, chart_of, figure_of,
                     group_of, is_table, role_of_element, slot_specs)
from source import (Refused, fields_of, inline_markup,         # noqa: E402
                    plain_text, read)

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

    # THE PROFILE IS A NAME THE REGISTER CARRIES, AND THE STAGE ANSWERS IT
    # (#215). Anything else here would reach the built page as a `data-motion`
    # no stylesheet has a rule for, which is a deck that silently loses its
    # own art direction -- the one class of defect worth stopping a build for.
    motion = deck.header.get("motion", "").strip()
    if motion and motion not in MOTION_PROFILES:
        fixes.append(
            f'write motion= as one of {", ".join(MOTION_PROFILES)}, not '
            f'"{motion}" — the profile decides how a slide arrives and how a '
            "fragment enters, and the stage has a rule for each of the three"
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

def group_markup(container, group):
    """One <ul>/<ol> group, items in SOURCE order -- a series has no catalog
    order to fall back on the way a pattern's named slots do; the order the
    author wrote the items in is the only order there is."""
    items = []
    for item in container.elements():
        if item.tag != group.item:
            continue
        # THE REGISTER NAMES THE WORD AND THIS WRITES IT BACK OUT. `Group.flag`
        # is the one place the attribute is spelled (#213 generalised #212's
        # hard-coded "now"), and the stage reads the same word off the emitted
        # `<li>` -- `li[now]` in compiler/stage.html is the other end of it.
        flag = f" {group.flag}" if group.flag and group.flag in item.attrs else ""
        fields = fields_of(item)
        cells = "".join(
            f'<{SLOT_TAG} class="{f.name}" data-role="{f.role}">'
            f"{inline_markup(fields[f.name])}</{SLOT_TAG}>"
            for f in group.fields
            if f.name in fields
        )
        items.append(f"<{group.item}{flag}>{cells}</{group.item}>")
    return f'<{group.container}>{"".join(items)}</{group.container}>'


def table_markup(table):
    """One <table>, re-serialised so that only what the audit already passed
    -- <thead>/<tbody>/<tr>/<th>/<td>, inline markup inside a cell -- ever
    reaches the page, the same discipline `inline_markup` itself keeps."""
    thead = next(c for c in table.elements() if c.tag == "thead")
    tbody = next(c for c in table.elements() if c.tag == "tbody")
    head_row = next(c for c in thead.elements() if c.tag == "tr")
    ths = "".join(f"<th>{inline_markup(c)}</th>" for c in head_row.elements() if c.tag == "th")
    rows = []
    for tr in tbody.elements():
        if tr.tag != "tr":
            continue
        tds = "".join(f"<td>{inline_markup(c)}</td>" for c in tr.elements() if c.tag == "td")
        rows.append(f"<tr>{tds}</tr>")
    return f'<table><thead><tr>{ths}</tr></thead><tbody>{"".join(rows)}</tbody></table>'


def icons_used(deck):
    """Every Lucide name an ICON-role slot names, across the whole deck.

    Read after the audit has already run: `_icon_known` (audit.py) is what
    refuses a name this registry does not carry, so by the time this walks the
    deck every name it finds is one `icons.sprite()` can build a `<symbol>`
    for without a second check.
    """
    used = []
    for slide in deck.sections:
        pattern = slide.attrs["pattern"]
        for el in slide.elements():
            if role_of_element(pattern, el) == ICON:
                name = plain_text(el).strip()
                if name:
                    used.append(name)
    return used


def notes_markup(deck):
    """Every slide's speaker notes, as one block each, for the panel (#215).

    THEY ARE EMITTED OUTSIDE THE STAGE, AND THAT IS THE WHOLE POINT. A note
    written into the `<section>` would be one stylesheet mistake away from the
    projector -- #207 asks for the detail to stay with the presenter and off
    the audience's screen, and the cheapest way to keep a promise like that is
    for the text to never be inside the thing being projected. The panel is a
    sibling of the stage; what ties a block to its slide is the number it
    carries, read by the stage's own script.

    A SLIDE WITH NO NOTES GETS NO BLOCK. The panel says so itself rather than
    carrying an empty one per slide, which would put the deck's slide count
    into the page a second time, in a second place, to say nothing.
    """
    blocks = []
    for index, slide in enumerate(deck.sections, start=1):
        note = next((el for el in slide.elements() if el.tag == NOTES_TAG), None)
        if note is None:
            continue
        blocks.append(
            f'<div class="note" data-note-for="{index}" hidden>'
            f"{inline_markup(note)}</div>"
        )
    return "\n".join(blocks)


def slide_markup(slide, index, base):
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

    A GROUP OR A TABLE COMES AFTER THE SLOTS, ALWAYS LAST (#212). Neither
    carries a `class=` of its own -- there is nothing for catalog order to
    place it by -- and every pattern that has one writes its evidence after
    the claim that frames it, never before.

    A CHART'S GROUP IS DRAWN, NOT PRINTED (#213). The same `<ul>` every other
    group reaches the page as goes to `compiler/charts.py` instead, and what
    lands is the SVG it returns -- the numbers are on the stage as marks and
    as the text beside them, and the list they were written in has no second
    job. The form travels onto the section as `data-chart=` for the same
    reason `data-pattern=` does: the built page should say what it is.

    AN ICON SLOT PRINTS NO TEXT, EVER. Its content is a Lucide name -- furniture
    for the sprite this same build already validated and embedded, never a
    sentence the audience reads -- so it renders as a `<use>` reference instead
    of the `<p>` every other slot gets.

    A FIGURE IS THE THIRD SHAPE OF EVIDENCE (#214), and the one whose bytes may
    live outside the source: a drawing is re-serialised against the register's
    own vocabulary, an image is read from disk and written back inline as a
    `data:` URI. `base` is the directory the source was read from, because that
    is where its author was writing the path from.

    A FRAGMENT'S NUMBER IS COUNTED HERE AND WRITTEN NOWHERE ELSE (#215). The
    source says only THAT a slot arrives late, with the bare `step`; the beat
    it arrives on is its place in the catalog's own reading order, which is
    the same order this function already emits in. Reordering the register
    therefore reorders the reveal, and there is no second ordering to fall out
    of step with the first. A PAIR SHARES ONE BEAT, because the register
    already says the two travel together -- an icon that arrives one advance
    after its own line is the "retrato vazio" #207 refuses, one beat wide.
    """
    pattern = slide.attrs["pattern"]
    written = {}
    container = None
    for el in slide.elements():
        cls = el.attrs.get("class", "").strip()
        if cls:
            written.setdefault(cls, el)
        elif el.tag in EVIDENCE_TAGS:
            container = el

    beats = {}
    beat = 0
    for slot in slot_specs(pattern):
        el = written.get(slot.name)
        if el is None or STEP_ATTR not in el.attrs or slot.name in beats:
            continue
        beats[slot.name] = beat
        pair = written.get(slot.pairs_with)
        if pair is not None and STEP_ATTR in pair.attrs:
            beats[slot.pairs_with] = beat
        beat += 1

    def one(slot):
        el = written[slot.name]
        step = f' data-fragment="{beats[slot.name]}"' if slot.name in beats else ""
        if slot.role == ICON:
            name = html.escape(plain_text(el).strip(), quote=True)
            return (
                f'<svg class="icon" data-role="icon"{step} aria-hidden="true" '
                f'focusable="false"><use href="#icon-{name}"></use></svg>'
            )
        return (
            f'<{SLOT_TAG} class="{slot.name}" data-role="{slot.role}"{step}>'
            f"{inline_markup(el)}</{SLOT_TAG}>"
        )

    body = [one(slot) for slot in slot_specs(pattern) if slot.name in written]

    chart = chart_of(pattern)
    group = group_of(pattern)
    figure = figure_of(pattern)
    form = ""
    if container is not None:
        if figure:
            # THE CAPTION IS THE FIGURE'S ACCESSIBLE NAME, and the register
            # says which slot that is (`Figure.caption`). A drawing has no
            # words a screen reader could read in order and a picture has
            # none at all, while the slide already carries a line saying what
            # it shows -- asking the author for a second one, in a second
            # attribute, would be asking them to keep two copies in step.
            said = written.get(figure.caption)
            described = plain_text(said).strip() if said is not None else ""
            if container.tag == figure.drawn:
                body.append(figures.drawing(container, figure, described))
            else:
                resolved = figures.resolve(
                    figures.attribute(container, figure.path), base, figure)
                if resolved.fix:
                    # THE SECOND LOCK, same one `inline_markup` keeps. The
                    # `figure-asset` ruler already refused this source, so
                    # reaching here means a check stopped being enforced --
                    # and half a deck with a picture nobody can read is worse
                    # than no deck.
                    raise Refused(resolved.fix)
                body.append(figures.image(figure, resolved, described))
        elif chart:
            form = slide.attrs.get(chart.attribute, "").strip()
            body.append(charts.draw(form, charts.series(container, group)))
        elif group:
            body.append(group_markup(container, group))
        elif is_table(pattern):
            body.append(table_markup(container))

    current = " is-current" if index == 0 else ""
    drawn = f' data-chart="{html.escape(form, quote=True)}"' if form else ""
    return (
        f'<section class="slide{current}" data-pattern="{html.escape(pattern)}"'
        f'{drawn} aria-label="slide {index + 1}">\n'
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
        deck = read(text, base=os.path.dirname(os.path.abspath(args.source)))
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
        slides = "\n".join(
            slide_markup(s, i, deck.base) for i, s in enumerate(sections))
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
            "ICONS": icons.sprite(icons_used(deck)),
            "SLIDES": slides,
            "NOTES": notes_markup(deck),
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
