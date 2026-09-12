#!/usr/bin/env python3
"""THE STORYBOARD BESIDE A DECK STILL DESCRIBES THAT DECK.

    workbench/panlabs-presentation-builder/tests/check-storyboard.py
    workbench/panlabs-presentation-builder/tests/check-storyboard.py <source> <board>

WHAT THIS MEASURES AND WHY NOTHING ELSE CAN. Every ruler inside
`compiler/audit.py` reads the SOURCE; the storyboard is written after all of
them have passed, and no ruler ever looks at it again. So a compiler that
skipped a slide, printed the arc functions one row out of step, or dropped a
line of the art direction would produce a green build and a page that quietly
described a different deck -- and the person it is written for, who asked for
the story to stay beside the deck so they could fix the ARC rather than slide
seven, is exactly the person with no way to tell.

IT READS THE SOURCE ITSELF AND NEVER THROUGH THE COMPILER. Importing
`compiler/source.py` would make this green whenever the compiler agrees with
itself, which is the shape of check the workbench doctrine refuses by name: a
proof with no independent reading measures the author of the check. The regexes
below are a second, deliberately dumber reader of the same dialect.

TWO QUESTIONS, AND THE SECOND IS THE ONE #217 ASKS BY NAME:

  reflects      one row per slide, in order, each carrying that slide's own
                pattern, its own function in the arc and words the deck really
                says, the header table carrying every choice the direction
                wrote, and the tail carrying every source the deck declares,
                whole -- including the two fields no stage ever prints
  reproducible  the same source built twice, byte for byte the same page --
                so a diff after a one-word fix is a diff of one word

With no arguments it builds every source under the skill's `examples/` twice,
into temp directories that go away with the process, and asks both questions of
each. With a source and a storyboard it asks only the first, of that pair: that
is the door the proof beside this file plants through.
"""

import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
BUILD = os.path.join(SKILL, "compiler", "build.py")
EXAMPLES = os.path.join(SKILL, "examples")
SUFFIX = ".storyboard.md"

# THE SECOND READER OF THE DIALECT. Deliberately blunt: a `<section …>` opening
# tag with its two attributes in either order, and a `<p class="…">…</p>` inside
# the direction block. It knows nothing about slots, patterns or the catalog --
# everything it needs is on the two lines it matches.
SECTION = re.compile(r'<section\s+([^>]*?)\s*>')
ATTR = re.compile(r'([a-z-]+)="([^"]*)"')
DIRECTION = re.compile(r"<direction\s*>(.*?)</direction\s*>", re.S)
CHOICE = re.compile(r'<p\s+class="([^"]+)"\s*>(.*?)</p>', re.S)
TAGS = re.compile(r"<[^>]+>")

# The provenance block, read the same blunt way (#238). The stage prints two of
# a source's four fields; this page is the only one that publishes all four, so
# it is the only place a reader can check where a number came from without
# opening the source -- which makes a dropped field invisible everywhere else.
SOURCES = re.compile(r"<sources\s*>(.*?)</sources\s*>", re.S)
SOURCE_ITEM = re.compile(r'<li\s+id="([^"]+)"\s*>(.*?)</li\s*>', re.S)

# The storyboard's slide table, read back the same blunt way. The header table
# above it needs no pattern of its own: what this holds it to is that every
# choice the source wrote appears SOMEWHERE in the half of the page before the
# storyboard, which a substring answers and a row pattern would only complicate.
ROW = re.compile(r"^\|\s*(\d+)\s*\|(.*)\|\s*$")

# The arc functions, as the storyboard prints them. It is the register's own
# ARC_LABEL, written out rather than imported for the same reason the readers
# above are: a table this file borrowed from the compiler could not disagree
# with it, and disagreeing is the whole job.
ARC_LABEL = {
    "context": "contexto",
    "tension": "tensão",
    "thesis": "tese",
    "evidence": "provas",
    "plan": "plano",
    "call": "chamada",
}


def read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return None


def slides_of(source):
    """(pattern, arc) for every `<section>` in a source, in written order."""
    out = []
    for attrs in SECTION.findall(source):
        found = dict(ATTR.findall(attrs))
        out.append((found.get("pattern", ""), found.get("arc", "")))
    return out


def choices_of(source):
    """The art direction's choices, by name, with the tags stripped out."""
    block = DIRECTION.search(source)
    if not block:
        return {}
    return {
        name: " ".join(TAGS.sub("", said).split())
        for name, said in CHOICE.findall(block.group(1))
    }


def provenance_of(source):
    """The sources a deck declares, by id, with the tags stripped out.

    THE SAME SHAPE `choices_of` READS ONE BLOCK UP, and deliberately so: a source
    is an `<li>` of named `<p>`s, which is what a choice already is plus a key.
    Reusing `CHOICE` for the fields is what keeps this second reader as dumb as
    the first -- it knows nothing about which fields exist, so a field added to
    the register is one this file publishes without being told.
    """
    block = SOURCES.search(source)
    if not block:
        return {}
    return {
        key: {name: " ".join(TAGS.sub("", said).split())
              for name, said in CHOICE.findall(body)}
        for key, body in SOURCE_ITEM.findall(block.group(1))
    }


def rows_of(board):
    """The storyboard's slide rows: (number, function, pattern) per row."""
    out = []
    for line in board.splitlines():
        found = ROW.match(line.strip())
        if not found:
            continue
        # A CELL IS SPLIT ON THE PIPES THAT ARE NOT ESCAPED. The storyboard
        # writes a slide's own `|` as `\|` so a sentence cannot end the column
        # early, and a reader that split on every pipe would find a phantom
        # fourth column in exactly the deck that needed the escape.
        cells = [c.strip().replace("\\|", "|")
                 for c in re.split(r"(?<!\\)\|", found.group(2))]
        if len(cells) < 3:
            continue
        out.append((int(found.group(1)), cells[0], cells[1], cells[2]))
    return out


def reflects(source, board, where):
    """Every fix the pair needs, or [] when the page describes the deck."""
    fixes = []
    slides = slides_of(source)
    rows = rows_of(board)

    if len(rows) != len(slides):
        fixes.append(
            f"rebuild {where} — the source has {len(slides)} slide(s) and the "
            f"storyboard lists {len(rows)}, so the page beside the deck is "
            "describing a deck that is not there"
        )
    # THE DECK'S OWN WORDS, FLATTENED THE ONE WAY BOTH SIDES CAN AGREE ON. The
    # storyboard prints a slide's message with the emphasis taken out and the
    # whitespace squeezed; this does the same to the whole source, so a message
    # that is really the slide's is a substring of it and a message the compiler
    # invented is not. It does NOT re-derive WHICH slot the message came from --
    # that rule lives in `compiler/storyboard.py`, and a second copy of it here
    # would be the two-ended contract this file exists outside of.
    said = " ".join(TAGS.sub("", source).split())

    for n, ((pattern, arc), row) in enumerate(zip(slides, rows), start=1):
        number, function, shape, printed = row
        if number != n:
            fixes.append(
                f"rebuild {where} — row {n} of the storyboard is numbered "
                f"{number}, and a story out of order is a story about another deck"
            )
        if not shape.startswith(f"`{pattern}`"):
            fixes.append(
                f"rebuild {where} — slide {n} is a {pattern} and its row says "
                f"{shape}"
            )
        want = ARC_LABEL.get(arc, arc)
        if function != want:
            fixes.append(
                f'rebuild {where} — slide {n} declares arc="{arc}" and its row '
                f'says "{function}"'
            )
        if printed and printed not in said:
            fixes.append(
                f'rebuild {where} — row {n} of the storyboard says "{printed}" '
                "and no slide of the source does; a story told in words the "
                "deck never says is a story about another deck"
            )

    choices = choices_of(source)
    published = board.split("## Storyboard")[0]
    for name, value in choices.items():
        if value and value not in published:
            fixes.append(
                f'rebuild {where} — the direction says "{value}" under '
                f"`{name}` and the storyboard never publishes it; a choice the "
                "page drops is a choice nobody can argue with"
            )

    # THE PROVENANCE, AND THE WHOLE OF IT (#238). Two of a source's fields reach
    # the stage, printed under every slide that cites it; `where` and `excerpt`
    # reach nothing at all. This page is the only place they are published, which
    # means a generator that quietly stopped writing one would leave the deck
    # looking sourced and the source unfindable -- and no ruler in the compiler
    # reads this page. The pipes are unescaped first: the table writes a `|`
    # inside a field as `\|` so a path cannot end the column early.
    sources = provenance_of(source)
    tail = board.split("## Fontes")[-1].replace("\\|", "|") if "## Fontes" in board else ""
    for key, fields in sources.items():
        if f"`{key}`" not in tail:
            fixes.append(
                f'rebuild {where} — the deck declares the source "{key}" and the '
                "storyboard never lists it; the page beside the deck is the only "
                "one that publishes where a number came from"
            )
            continue
        for name, value in fields.items():
            if value and value not in tail:
                fixes.append(
                    f'rebuild {where} — the source "{key}" says "{value}" under '
                    f"`{name}` and the storyboard never publishes it"
                )
    return fixes


def build(source, into, tag):
    """Build one source into a directory; return the storyboard, or None.

    IT BUILDS WITHOUT A BROWSER, ON PURPOSE, AND THROUGH THE GATE'S OWN DOOR.
    `build.py` hands every page it writes to `gate/render.cjs`, which launches a
    Chromium -- and this check's subject is a Markdown file. Fourteen browser
    launches to read fourteen tables is thirty-five seconds of suite spent on
    nothing, and it is the same thirty-five seconds layer 2 already spends on
    the same corpus, for a verdict it actually asserts.

    Dropping PATH from the child's environment is what the gate ALREADY handles:
    with no `node` to find, `build.py` prints its named SKIP and its own exit
    code never moves (#209's rule, unchanged here). Nothing is being suppressed
    that the skill does not already degrade for a maintainer with no Chromium
    installed.
    """
    env = {k: v for k, v in os.environ.items() if k != "PATH"}
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    out = os.path.join(into, tag + ".html")
    done = subprocess.run(
        [sys.executable, BUILD, source, out],
        capture_output=True, text=True, env=env, cwd=SKILL,
    )
    if done.returncode != 0:
        return None, (done.stdout + done.stderr).strip()
    return read(os.path.splitext(out)[0] + SUFFIX), ""


def over_the_corpus():
    """Build every example twice and ask both questions of each."""
    sources = sorted(
        os.path.join(EXAMPLES, f)
        for f in os.listdir(EXAMPLES) if f.endswith(".deck.html")
    ) if os.path.isdir(EXAMPLES) else []

    if not sources:
        print("REFUSED · put a source back under examples/ — with no deck to "
              "build there is no storyboard to hold to anything, and an empty "
              "corpus is a green that measured nothing")
        return False

    fixes = []
    for source in sources:
        name = os.path.basename(source)
        with tempfile.TemporaryDirectory(prefix="panlabs-storyboard-") as tmp:
            first, why = build(source, tmp, "once")
            if first is None:
                fixes.append(f"fix {name} — the build refused it: {why}")
                continue
            second, why = build(source, tmp, "twice")
            if second is None:
                fixes.append(f"fix {name} — the second build refused it: {why}")
                continue
            # THE TWO BUILDS SHARE ONE DIRECTORY AND DIFFER ONLY IN THEIR STEM,
            # which is the point: a storyboard that carried its own path, or a
            # clock, would differ here and nowhere else.
            if first != second:
                fixes.append(
                    f"take the clock out of compiler/storyboard.py — {name} "
                    "built twice produced two different storyboards, and a page "
                    "that changes on its own turns a one-word fix into a diff "
                    "nobody can read"
                )
            fixes.extend(reflects(read(source), first, name))

    for fix in fixes:
        print(f"REFUSED · {fix}")
    if fixes:
        return False
    print(f"   ✓ {len(sources)} storyboard(s) describe the deck beside them, "
          "and each is the same page twice")
    return True


def one_pair(source_path, board_path):
    """Hold one storyboard to one source, both already on disk."""
    source, board = read(source_path), read(board_path)
    where = os.path.basename(board_path)
    if source is None:
        print(f"REFUSED · point at a source this check can read: {source_path}")
        return False
    if board is None:
        print(f"REFUSED · point at a storyboard this check can read: {board_path}")
        return False
    fixes = reflects(source, board, where)
    for fix in fixes:
        print(f"REFUSED · {fix}")
    if fixes:
        return False
    print(f"   ✓ {where} describes the deck its source writes")
    return True


def main(argv):
    if len(argv) == 2:
        return 0 if one_pair(argv[0], argv[1]) else 1
    if argv:
        print("REFUSED · call this with no arguments, or with a source and a "
              "storyboard — one builds the whole corpus, the other holds one "
              "pair, and there is nothing in between")
        return 1
    return 0 if over_the_corpus() else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
