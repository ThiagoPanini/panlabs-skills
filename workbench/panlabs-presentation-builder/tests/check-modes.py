#!/usr/bin/env python3
"""THE TWO MODES DESCRIBE THE DECK THEY WERE ASKED ABOUT, AND DO IT TWICE. Four
families.

    workbench/panlabs-presentation-builder/tests/check-modes.py
    workbench/panlabs-presentation-builder/tests/check-modes.py <source.deck.html>
    workbench/panlabs-presentation-builder/tests/check-modes.py <source> --skill <dir>

WHAT THIS MEASURES AND WHY NOTHING ELSE CAN. `compiler/build.py --skeleton` and
`--article` (#239) are the two outputs of this skill that no ruler inside the
compiler ever reads back. The skeleton is audited by the DIALECT alone, on
purpose -- a placeholder is supposed to be over budget and to repeat a shape --
so a skeleton that dropped a slide, painted the wrong pattern or leaked the real
deck's content into it would build green. The article is not audited at all: it
is a Markdown file, and the audit's subject is a source. A generator that
quietly stopped writing the speaker notes, or wrote a chart whose colours never
resolved, would leave every other layer of this suite green and the published
article wrong.

IT READS THE SOURCE ITSELF AND NEVER THROUGH THE COMPILER, the same rule
`check-storyboard.py` keeps: importing `compiler/source.py` would make this
green whenever the compiler agrees with itself, which is a proof that measures
the author of the check. The regexes below are a second, deliberately dumber
reader of the same dialect and of the same storyboard.

  refuses        a plan the register cannot paint is refused, and the red names
                 the fix: a pattern the catalog never heard of, and a column the
                 table is missing. Both are #239's own acceptance, and both are
                 planted into a COPY of a real storyboard -- the tree this suite
                 measures is never written to.
  skeleton       one slide per row, in order, each carrying that row's own
                 pattern, that row's own form and that row's own message -- and
                 nothing else the real deck said. A skeleton that leaked content
                 would be a rehearsal nobody could tell from the deck.
  article        the title, the occasion, a chapter per divider, every note's
                 words, every table cell, one drawing beside it per chart and
                 per figure with the theme's colours resolved into literals, and
                 every source as a reference.
  deterministic  each mode twice, over the same input, into two directories:
                 the same files, byte for byte. #237 asks for it by name, and it
                 is the property that makes a one-word fix a one-word diff.

WITH NO ARGUMENTS IT MEASURES THE WHOLE CORPUS -- the two sources under the
skill's `examples/` and the benchmark beside this file, which is #207's own
count of three. With a source it measures that one; with `--skill` it measures
it against another tree, which is the door `check-modes.proof.py` plants
through.

⚠️ IT BUILDS WITHOUT A BROWSER, AND FOR THE REASON `check-storyboard.py` GIVES.
Every build below runs with no `node` on the PATH, so `gate/render.cjs` degrades
to the named SKIP #209 built it to degrade to. Layer 2 is where a render verdict
is asserted for this same corpus; paying for thirty more Chromium launches to
read Markdown would buy nothing twice.
"""

import filecmp
import os
import pathlib
import re
import subprocess
import sys
import tempfile

# Nothing this suite runs may leave bytecode in the tree it measures.
sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
SKILL = HERE.parent.parent.parent / "skills" / "panlabs-presentation-builder"
BENCHMARK = HERE.parent / "benchmark"

BOARD_SUFFIX = ".storyboard.md"

# THE SECOND READER OF THE DIALECT. Deliberately blunt: an opening `<section>`
# with its attributes in any order, a `<p class="…">…</p>`, a `<notes>` block, a
# table cell, and the provenance block's items. It knows nothing about slots,
# patterns or the catalog.
SLIDE = re.compile(r"<section\s+([^>]*?)\s*>(.*?)</section\s*>", re.S)
ATTR = re.compile(r'([a-z-]+)="([^"]*)"')
SLOT = re.compile(r'<p\s+class="([^"]+)"[^>]*>(.*?)</p\s*>', re.S)
NOTES = re.compile(r"<notes\s*>(.*?)</notes\s*>", re.S)
CELL = re.compile(r"<t([hd])\s*>(.*?)</t[hd]\s*>", re.S)
SOURCES = re.compile(r"<sources\s*>(.*?)</sources\s*>", re.S)
SOURCE_ITEM = re.compile(r'<li\s+id="([^"]+)"\s*>(.*?)</li\s*>', re.S)
TAGS = re.compile(r"<[^>]+>")

# What the article writes the deck's own emphasis as: the Markdown for a bold,
# and the tag for a highlight. Taken back off before a sentence is looked for.
EMPHASIS = re.compile(r"\*\*|</?mark>")

# What a colour looks like before the article resolves it. A drawing beside a
# Markdown page has no stylesheet to answer a token, so one that reached a file
# is a colour that paints nothing.
TOKEN = b"var(--"

# A forced line, however it was written. It is where a note's author moved to
# the next thought, and the article breaks the paragraph there.
BREAK = re.compile(r"<br\s*/?>")

# The built page, read back the same blunt way.
PAGE_SLIDE = re.compile(r'<section class="slide[^"]*"([^>]*)>(.*?)</section\s*>', re.S)

# The article's own furniture: a chapter heading, and a drawing it references.
CHAPTER = re.compile(r"^##\s+(.*)$", re.M)
DRAWING = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")

# The heading the article's reference list sits under, and the one field of a
# source that does not appear in it. Both are the storyboard's own words,
# spelled here rather than imported for the reason the readers above are.
REFERENCES = "## Fontes"
EXCERPT = "excerpt"

# The `<deck>` tag, and the attribute a chart writes its form in. Read off the
# source as text -- an author writes both by hand, so a blunt reader can ask for
# them without knowing anything about the register.
HEADER = re.compile(r"<deck\s+([^>]*?)\s*>", re.S)
CHART_ATTR = "type"

# THE STORYBOARD'S TABLE, READ BY THE HEADING AND NEVER BY POSITION. The page
# grew two columns in #239, and a reader indexing the message by number would
# have gone on measuring the cell that used to be there. Asking the heading row
# for the column is what makes a column added tomorrow a red instead of a lie.
ROW = re.compile(r"^\|(.*)\|\s*$")
STORYBOARD_HEADING = "## Storyboard"
MESSAGE_COLUMN = "mensagem"
PATTERN_COLUMN = "padrão"
FORM_COLUMN = "forma"
ABSENT = "—"

# The word every placeholder a skeleton writes opens with. It is the skeleton's
# own, asserted here rather than imported, for the same reason the readers above
# are hand-written.
SAMPLE = "amostra"

# How long a piece of the real deck has to be before its absence from a skeleton
# means anything. A cover's own `number` is "9", and a page of CSS has a nine in
# it somewhere; twelve characters is past every number and every label in the
# corpus and short of every sentence in it.
LEAK_FLOOR = 12


def read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return None


def flat(markup):
    """One run of markup as the words in it, tags dropped, whitespace squeezed.

    THE TAG IS REPLACED BY NOTHING AND NOT BY A SPACE, which is the same rule
    `compiler/source.py` keeps where it flattens a slot: "the <strong>room</strong>"
    is three words and "the<strong>room</strong>" is one, and a reader that put a
    space in would find a comma standing on its own the first time a deck
    emphasised the word before it.
    """
    return " ".join(TAGS.sub("", markup).split())


def plain(article):
    """One article with its own emphasis taken back off, on one line.

    IT IS THE OTHER HALF OF `flat`, and both exist so a sentence can be looked
    for. The article keeps the deck's emphasis -- `**` for a bold and the
    `<mark>` tag for a highlight, which Markdown has no spelling for -- and a
    line of the deck is a line of the article only once both sides have been
    reduced to the words.
    """
    return " ".join(EMPHASIS.sub("", article).split())


def build(skill, source, out, *extra):
    """Run the documented command, with no browser. Returns (ok, said)."""
    env = {k: v for k, v in os.environ.items() if k != "PATH"}
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    done = subprocess.run(
        [sys.executable, str(pathlib.Path(skill) / "compiler" / "build.py"),
         str(source), str(out), *extra],
        capture_output=True, text=True, env=env, cwd=str(skill),
    )
    return done.returncode == 0, (done.stdout + done.stderr).strip()


# ── reading a source, and the storyboard of one ──────────────────────────────

def slides_of(source):
    """Every `<section>` of a source: (attrs, slots, notes, body), in order.

    The notes come back as MARKUP and not as words, because the one thing an
    article does to a note is break the paragraph where a `<br/>` is -- so the
    assertion has to split before it flattens.
    """
    out = []
    for attrs, body in SLIDE.findall(source):
        out.append((
            dict(ATTR.findall(attrs)),
            [(name.strip(), flat(said)) for name, said in SLOT.findall(body)],
            NOTES.findall(body),
            body,
        ))
    return out


def provenance_of(source):
    """The sources a deck declares, by id, each field flattened."""
    block = SOURCES.search(source)
    if not block:
        return {}
    return {
        key: {name.strip(): flat(said) for name, said in SLOT.findall(body)}
        for key, body in SOURCE_ITEM.findall(block.group(1))
    }


def rows_of(board):
    """The storyboard's slide rows, as dicts keyed by the heading's own labels.

    IT READS THE TABLE UNDER THE SLIDE HEADING AND NOT THE FIRST ONE ON THE
    PAGE. The art direction is a two-column table above it, and a reader that
    took whatever table came first would have measured the header -- with the
    `capa` row standing in for a heading row, which is the shape of green that
    describes another document entirely.
    """
    board = board.partition(STORYBOARD_HEADING)[2]
    table = []
    for line in board.split("\n"):
        found = ROW.match(line.strip())
        if not found:
            if table:
                break
            continue
        cells = [c.strip().replace("\\|", "|")
                 for c in re.split(r"(?<!\\)\|", found.group(1))]
        if all(not c or set(c) <= set("-: ") for c in cells):
            continue
        table.append(cells)
    if len(table) < 2:
        return []
    heading, body = table[0], table[1:]
    return [dict(zip(heading, cells)) for cells in body]


def storyboard_of(skill, source, into):
    """Build one source and hand back its storyboard. Returns (board, why)."""
    out = pathlib.Path(into) / "deck.html"
    ok, said = build(skill, source, out, "--theme", "base")
    if not ok:
        return None, said
    return read(str(out).replace(".html", BOARD_SUFFIX)), ""


# ── 1 · a plan the register cannot paint is refused ──────────────────────────

def check_refuses(skill=SKILL, source=None, board=None, **_):
    if board is None:
        return False, ("no storyboard to plant into -- the deck would not "
                       "build, so this family measured nothing")
    rows = rows_of(board)
    if not rows:
        return False, ("the storyboard carries no row this family can spoil -- "
                       "a plan with no slide is not a plan")

    # THE PLANT GOES IN THE SLIDE TABLE AND NOWHERE ELSE. The art direction
    # names patterns too -- the cover, and the three renunciations -- so a
    # replacement made over the whole page would spoil a choice instead of a row,
    # and the red would be about the header.
    head, mark, table = board.partition(STORYBOARD_HEADING)
    if not mark:
        return False, (f'the storyboard has no "{STORYBOARD_HEADING}" section '
                       "to plant into -- this family measured nothing")
    heading = next((l for l in table.split("\n")
                    if PATTERN_COLUMN in l and MESSAGE_COLUMN in l), "")
    plants = [
        ("a pattern the catalog never heard of",
         head + mark + table.replace(rows[0][PATTERN_COLUMN].split("`")[1],
                                     "pergunta-pivo", 1),
         "replace the pattern"),
        ("a column the table is missing",
         head + mark + table.replace(
             heading, heading.replace(f" {FORM_COLUMN} |", " |", 1), 1),
         f'add the "{FORM_COLUMN}" column'),
    ]

    with tempfile.TemporaryDirectory(prefix="panlabs-modes-refuse-") as tmp:
        for what, payload, must_say in plants:
            if payload is None or payload == board:
                return False, (f"the storyboard no longer carries what this "
                               f'family plants into for "{what}" -- pick '
                               "another needle, or the plant proves nothing")
            where = pathlib.Path(tmp) / "planted.storyboard.md"
            where.write_text(payload, encoding="utf-8")
            ok, said = build(skill, where, pathlib.Path(tmp) / "out.html",
                             "--skeleton")
            if ok:
                return False, (f"a storyboard carrying {what} built a deck -- "
                               "refuse it, and name the fix: a plan the "
                               "register cannot paint is a plan whose author "
                               "has to be told which word to change")
            if must_say not in said:
                return False, (f"the red for {what} never says "
                               f'"{must_say}" -- it said: '
                               f"{said.splitlines()[0] if said else '(nothing)'}")
    return True, f"both plans the register cannot paint are refused by name"


# ── 2 · the skeleton is the plan, and only the plan ──────────────────────────

def check_skeleton(skill=SKILL, source=None, board=None, **_):
    if board is None:
        return False, "no storyboard to paint from -- the deck would not build"
    rows = rows_of(board)
    with tempfile.TemporaryDirectory(prefix="panlabs-modes-skeleton-") as tmp:
        plan = pathlib.Path(tmp) / "plan.storyboard.md"
        plan.write_text(board, encoding="utf-8")
        out = pathlib.Path(tmp) / "skeleton.html"
        ok, said = build(skill, plan, out, "--skeleton")
        if not ok:
            return False, f"the skeleton of a real storyboard was refused: {said}"
        page = read(out)

    painted = PAGE_SLIDE.findall(page)
    if len(painted) != len(rows):
        return False, (f"the plan has {len(rows)} row(s) and the skeleton "
                       f"paints {len(painted)} slide(s) -- paint one slide per "
                       "row, in order: a rehearsal of another deck is not a "
                       "rehearsal")

    for n, (row, (attrs, body)) in enumerate(zip(rows, painted), start=1):
        said = dict(ATTR.findall(attrs))
        want = row[PATTERN_COLUMN].strip().strip("`").split("`")[0]
        if said.get("data-pattern") != want:
            return False, (f"row {n} of the plan says `{want}` and the "
                           f"skeleton paints {said.get('data-pattern')!r} -- "
                           "paint the pattern the row names")
        form = row.get(FORM_COLUMN, ABSENT)
        if form != ABSENT:
            drawn = form.strip("`").partition(".")[2]
            if said.get("data-chart") != drawn:
                return False, (f"row {n} of the plan draws `{form}` and the "
                               f"skeleton draws {said.get('data-chart')!r} -- "
                               "a form the plan chose is a form the rehearsal "
                               "shows")
        message = row[MESSAGE_COLUMN]
        if message and message not in flat(body):
            return False, (f'row {n} of the plan says "{message}" and the '
                           "skeleton's own slide does not -- the message is the "
                           "one line of a plan that is not a placeholder, and "
                           "it goes where the pattern makes its point")

    if SAMPLE not in page:
        return False, (f'the skeleton never says "{SAMPLE}" -- every string it '
                       "stands in with has to say it is a placeholder, or a "
                       "rehearsal is something somebody sends")

    leaked = _leaks(source, page, rows)
    if leaked:
        return False, (f"the skeleton carries the real deck's own words: "
                       f'"{leaked}" -- everything but the message and the '
                       "declared sources is a placeholder, and a skeleton that "
                       "leaks content is a deck with holes in it")
    return True, (f"{len(painted)} slide(s), one per row, carrying the plan's "
                  "messages and nothing else the deck said")


def _leaks(source, page, rows):
    """The first sentence of the real deck that reached the skeleton, or ""."""
    allowed = {row[MESSAGE_COLUMN] for row in rows}
    for fields in provenance_of(source).values():
        allowed.update(fields.values())
    for _, slots, notes, _ in slides_of(source):
        for _, said in slots:
            if len(said) >= LEAK_FLOOR and said not in allowed and said in page:
                return said
        for note in notes:
            if len(note) >= LEAK_FLOOR and note in page:
                return note
    return ""


# ── 3 · the article is the deck, in prose ────────────────────────────────────

def check_article(skill=SKILL, source=None, **_):
    said = read(source)
    slides = slides_of(said)
    with tempfile.TemporaryDirectory(prefix="panlabs-modes-article-") as tmp:
        out = pathlib.Path(tmp) / "article.md"
        ok, why = build(skill, source, out, "--article")
        if not ok:
            return False, f"the article of a real deck was refused: {why}"
        article = read(out)
        said_plain = plain(article)
        beside = {name: (pathlib.Path(tmp) / name)
                  for name in DRAWING.findall(article)}
        missing = sorted(n for n, p in beside.items() if not p.exists())
        if missing:
            return False, (f"the article references {', '.join(missing)} and "
                           "wrote no such file -- a drawing an article points "
                           "at and does not carry is a picture nobody can open")
        # READ AS BYTES, BECAUSE ONE OF THE THREE IS A PNG. An imported figure
        # is copied beside the article rather than drawn, so this scan meets a
        # picture as often as a stylesheet -- and a picture decoded as text is a
        # crash where a verdict belongs.
        unresolved = sorted(n for n, p in beside.items()
                            if TOKEN in p.read_bytes())
        if unresolved:
            return False, (f"{', '.join(unresolved)} still names a theme token "
                           "-- a Markdown page carries no stylesheet, so every "
                           "colour beside it has to be a literal or it paints "
                           "nothing")

    # HOW MANY DRAWINGS THERE SHOULD BE, COUNTED OFF THE SOURCE. A chart is a
    # slide with a form written on it; a figure is a slide with a drawing or an
    # image inside it. Both reach a stage as pictures and both have to reach an
    # article as files, and a generator that wrote the Markdown and skipped one
    # would leave a stretch with a claim and no evidence under it.
    drawn = [n for n, (attrs, _, _, body) in enumerate(slides, start=1)
             if CHART_ATTR in attrs or "<svg" in body or "<img" in body]
    if len(beside) != len(drawn):
        return False, (f"the deck draws {len(drawn)} picture(s) (slides "
                       f"{', '.join(str(n) for n in drawn)}) and the article "
                       f"carries {len(beside)} -- every chart and every figure "
                       "travels beside it as a file of its own")

    found = HEADER.search(said)
    for field in ("title", "occasion"):
        value = dict(ATTR.findall(found.group(1))).get(field, "")
        if not value or value not in said_plain:
            return False, (f'the article never says the deck\'s own {field} '
                           f'"{value}" -- the title is what a published page is '
                           "found by, and the occasion is half of what it was")

    # NO SLIDE IS DROPPED, and this is the one assertion that does not need to
    # know which slot becomes the heading: whatever a slide says, SOMETHING it
    # says has to reach the article. A generator that skipped a pattern it had
    # no branch for would otherwise write an article one act short.
    for n, (_, slots, _, _) in enumerate(slides, start=1):
        words = [t for _, t in slots if len(t) >= LEAK_FLOOR]
        if words and not any(t in said_plain for t in words):
            return False, (f"slide {n} says nothing the article says -- every "
                           "slide is a stretch, and a slide the generator had "
                           "no branch for is an act missing from the story")

    # EVERY NOTE, RUN BY RUN. A `<br/>` inside a note is where its author moved
    # to the next thought, and the article breaks the paragraph there -- so the
    # assertion is made on each run rather than on the whole note, which is what
    # a generator that dropped the second half would otherwise slip past.
    for n, (_, _, notes, _) in enumerate(slides, start=1):
        for note in notes:
            for run in BREAK.split(note):
                run = flat(run)
                if run and run not in said_plain:
                    return False, (f'slide {n} says "{run[:60]}…" in its notes '
                                   "and the article never does -- the notes are "
                                   "the prose of an article, and a deck\'s own "
                                   "detail lives nowhere else")

    for n, (_, _, _, body) in enumerate(slides, start=1):
        for _, cell in CELL.findall(body):
            words = flat(cell)
            if words and words not in said_plain:
                return False, (f"slide {n} shows a table whose cell "
                               f'"{words}" the article never writes -- a table '
                               "is a table in Markdown too")

    # NO CHAPTER THE DECK DID NOT OPEN. Every `##` of the article but the
    # references heading has to be made of the words of one slide -- which is
    # what stops this generator from inventing an act, without this file having
    # to know which pattern is a divider.
    everything = [t for _, slots, _, _ in slides for _, t in slots if t]
    chapters = [h.strip() for h in CHAPTER.findall(article)
                if f"## {h.strip()}" != REFERENCES]
    for heading in chapters:
        if not any(t in heading for t in everything):
            return False, (f'the article opens a chapter on "{heading}" and no '
                           "slide of the deck says it -- a chapter is a divider "
                           "the deck wrote, never a heading the generator "
                           "thought of")

    tail = said_plain.split(REFERENCES)[-1] if REFERENCES in said_plain else ""
    for key, fields in provenance_of(said).items():
        if f"`{key}`" not in tail:
            return False, (f'the deck declares the source "{key}" and the '
                           "article's references never list it -- an article "
                           "that cites an id nobody resolves is an article with "
                           "no provenance")
        for name, value in fields.items():
            if value and name != EXCERPT and value not in tail:
                return False, (f'the source "{key}" says "{value}" under '
                               f"`{name}` and the article's references do not")
    return True, (f"{len(slides)} stretch(es), {len(chapters)} chapter(s), "
                  f"{len(beside)} drawing(s) beside it, colours resolved")


# ── 4 · each mode, twice, byte for byte ──────────────────────────────────────

def check_deterministic(skill=SKILL, source=None, board=None, **_):
    if board is None:
        return False, "no storyboard to paint from -- the deck would not build"
    with tempfile.TemporaryDirectory(prefix="panlabs-modes-twice-") as tmp:
        plan = pathlib.Path(tmp) / "plan.storyboard.md"
        plan.write_text(board, encoding="utf-8")
        runs = 0
        for mode, name, input_ in (("--skeleton", "page.html", plan),
                                   ("--article", "page.md", source)):
            made = []
            for round_ in ("one", "two"):
                # TWO DIRECTORIES AND ONE NAME, which is what determinism means
                # for a generator that writes a file and its siblings: the
                # article REFERENCES its own drawings by basename, so changing
                # the name is supposed to change the file. Changing the
                # directory is not.
                into = pathlib.Path(tmp) / round_ / mode.strip("-")
                into.mkdir(parents=True, exist_ok=True)
                ok, said = build(skill, input_, into / name, mode)
                if not ok:
                    return False, f"{mode} was refused on the second look: {said}"
                made.append(into)
            left, right = (sorted(p.name for p in d.iterdir()) for d in made)
            if left != right:
                return False, (f"{mode} wrote {left} once and {right} the next "
                               "time -- the same input has to produce the same "
                               "files")
            for name_ in left:
                if not filecmp.cmp(made[0] / name_, made[1] / name_,
                                   shallow=False):
                    return False, (f"take the clock out of the {mode.strip('-')} "
                                   f"generator — {name_} came out different the "
                                   "second time, and a file that changes on its "
                                   "own turns a one-word fix into a diff nobody "
                                   "can read")
            runs += len(left)
    return True, f"both modes wrote the same {runs} file(s) twice"


FAMILIES = [
    ("refuses", check_refuses),
    ("skeleton", check_skeleton),
    ("article", check_article),
    ("deterministic", check_deterministic),
]


def corpus():
    """The three decks #207 counts: the two examples, and the benchmark."""
    found = sorted(str(p) for p in SKILL.glob("examples/*.deck.html"))
    found += sorted(str(p) for p in BENCHMARK.glob("*.deck.html"))
    return found


def over(skill, source):
    """Every family over one deck. Returns the number of reds."""
    name = os.path.basename(source)
    with tempfile.TemporaryDirectory(prefix="panlabs-modes-") as tmp:
        board, why = storyboard_of(skill, source, tmp)
        if board is None:
            print(f"  FAIL {name:<24} the deck would not build, so every family "
                  f"below is unavailable rather than false: {why}")
            return len(FAMILIES)
        bad = 0
        for family, fn in FAMILIES:
            try:
                ok, said = fn(skill=skill, source=source, board=board)
            except Exception as e:                              # noqa: BLE001
                ok, said = False, f"{type(e).__name__}: {e}"
            bad += not ok
            print(f"  {'ok  ' if ok else 'FAIL'} {family:<14} {name:<24} {said}")
    return bad


def main(argv):
    print("modes:")
    skill = SKILL
    sources = []
    rest = list(argv)
    if "--skill" in rest:
        at = rest.index("--skill")
        skill = pathlib.Path(rest[at + 1]).resolve()
        del rest[at:at + 2]
    # ABSOLUTE, BECAUSE EVERY BUILD RUNS FROM THE SKILL'S OWN ROOT. `SKILL.md`
    # tells a reader to run the command from there, so this check does too --
    # and a relative path typed on this command line would be resolved against
    # the wrong directory.
    sources = [str(pathlib.Path(s).resolve()) for s in rest] or corpus()

    if not sources:
        print("  FAIL corpus         there is no deck to measure -- put a "
              "source back under examples/, and the benchmark back beside this "
              "file")
        return 1
    if not (pathlib.Path(skill) / "compiler" / "build.py").exists():
        print(f"  FAIL command        {skill}/compiler/build.py is not there -- "
              "every family below runs it")
        return 1
    return sum(over(skill, s) for s in sources)


if __name__ == "__main__":
    raise SystemExit(1 if main(sys.argv[1:]) else 0)
