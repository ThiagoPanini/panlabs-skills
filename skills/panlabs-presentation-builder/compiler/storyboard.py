"""The storyboard: the deck as a story, written beside the deck -- and read back.

    /tmp/proposta.html            ->  /tmp/proposta.storyboard.md
    /tmp/proposta.storyboard.md   ->  the plan a skeleton is painted from

WHY IT IS EMITTED AT ALL. #207 puts the storyboard in the first turn, before a
pixel exists, because "estrutura é mais barata de corrigir em texto do que em
slide" -- and the second turn is where that stops being true unless the story
survives the build. Written beside the deck, it is what lets the next ask be
"slide 4 is doing the tension twice" instead of "encurte o slide sete": the
deck's own author gets the arc back in one page, in the same order the room
will hear it.

IT IS GENERATED AND NEVER WRITTEN. Everything here is read out of the source --
the header, the art direction, each slide's pattern, arc function and message --
so there is no second copy of the story to drift from the first. That is also
what makes it reproducible to the byte: no clock, no path, no count that is not
in the source.

AND SINCE #239 IT IS ALSO AN INPUT, WHICH IS WHY THE READER LIVES HERE. #237
asks for the storyboard of the first turn to be RENDERED -- a skeleton painted
from the very table the calibration proposes, so form and rhythm can be vetoed
while they are still a paragraph. A page this file writes and another file read
would be the two-ended contract this skill refuses everywhere else: one grammar,
one module, `render` and `parse` looking at the same tuples. Every heading, every
column and every separator below is named once and spelled nowhere else.

THE DOCUMENT IS PORTUGUESE, AND THAT IS THE SAME SEAM THE STAGE SITS ON. The
messages this compiler PRINTS are English (CLAUDE.md § O código é em inglês);
what it AUTHORS for a person to read is not -- the help panel inside every built
deck is Portuguese for exactly this reason, and so are the `purpose=` lines
CATALOG.md publishes. A storyboard is read by whoever is about to present, and
it carries their deck's own words back to them.
"""

import os
import re
from dataclasses import dataclass

from catalog import (ARC_ATTR, ARC_FUNCTIONS, ARC_LABEL, CLAIM, DECK_FIELDS,
                     DIRECTION_CHOICES, DIRECTION_REQUIRED, MOMENTS_CHOICE,
                     NAME, SOURCE_EXCERPT, SOURCE_WHAT, SOURCE_WHEN,
                     SOURCE_WHERE, SOURCES_SPEC, chart_of, form_names,
                     pattern_names, scale_of, slot_specs)
from source import Refused, sources_of, texts_of

SUFFIX = ".storyboard.md"

# THE TITLE IS THE PAGE'S OWN HEADING AND THE OTHER FIVE ARE THE LINE UNDER IT.
# `DECK_FIELDS` is the register's list of what a header holds, and `_agreed`
# below refuses a page that cannot carry all of it -- because a field this page
# drops is a field the skeleton would have to invent.
TITLE_FIELD = "title"

# WHAT A SLIDE'S TONE IS CALLED, AND WHY THE WORD IS HERE RATHER THAN IN THE
# REGISTER (#239). The tone of a slide is frente B's (#241: `accent` paints the
# raw brand, `inverted` is the documentation's light), and until it lands no
# source can carry a `tone=` at all -- the vocabulary ruler refuses an attribute
# a `<section>` does not declare. Naming it in `compiler/catalog.py` today would
# be the register publishing a word the dialect refuses, so it lives here, where
# it is only a COLUMN: written as absent, read back and ignored, exactly as #239
# asks ("a coluna de tom é lida e ignorada: o esqueleto pinta o que o palco
# daquele momento sabe pintar"). When the stage learns tone, this constant moves
# to the register beside `ARC_ATTR` and this comment goes with it.
TONE_ATTR = "tone"


def beside(output_path):
    """Where the storyboard for a built deck goes: beside it, same stem.

    The same shape `gate/render.cjs` gives the contact sheet, and for the same
    reason -- everything one build produces answers to one name, so a directory
    with four decks in it never leaves anyone guessing which sheet belongs to
    which page.
    """
    stem = os.path.splitext(os.path.basename(output_path))[0]
    return os.path.join(os.path.dirname(os.path.abspath(output_path)), stem + SUFFIX)


# ── the page's own grammar, named once ───────────────────────────────────────
# Every string below is written by `render` and read by `parse`. They are in one
# block, at the top of one file, because the whole of #239's second half is that
# the two never disagree: a heading renamed in the writer and not in the reader
# is a storyboard that builds a deck and then refuses to be read back.

DIRECTION_HEADING = "## Direção de arte"
STORYBOARD_HEADING = "## Storyboard"
SOURCES_HEADING = "## Fontes"
EXCERPT_LEAD = "E o trecho literal, onde alguma citação do deck sai de um:"

# The mark a row puts on a slide that holds the stage alone, after its pattern.
MOMENT = "momento"

# WHAT AN EMPTY CELL SAYS. A blank cell is legal Markdown and reads as a
# rendering mistake; an em-dash is the one glyph a reader of a table already
# knows means "nothing here", and it gives `parse` something to recognise
# instead of a length to count.
ABSENT = "—"

SEPARATOR = " · "


@dataclass(frozen=True)
class Said:
    """One field of the `<deck>` header, as the page's own second line prints it.

    A HETEROGENEOUS LINE, DESCRIBED ONCE. The occasion is printed bare, the
    theme under a label, the minutes with a unit, the motion under another
    label -- and it reads well exactly because it is not a table. Written as an
    f-string and read back by a regex, that same line would be two spellings of
    one shape; written as this tuple, `render` joins the parts and `parse`
    peels them off, and a reader changing the label changes both.
    """

    field: str            # the name `DECK_FIELDS` gives it
    prefix: str = ""      # Portuguese: what precedes the value, when anything does
    suffix: str = ""      # Portuguese: what follows it
    code: bool = False    # a name drawn from a closed set, set as code


HEADER_LINE = (
    Said("occasion"),
    Said("theme", prefix="tema ", code=True),
    Said("lang"),
    Said("minutes", suffix=" min"),
    Said("motion", prefix="movimento ", code=True),
)


@dataclass(frozen=True)
class Column:
    """One column of the slide table: what this module calls it, and its heading."""

    key: str       # the name `Row` gives it
    label: str     # Portuguese: the heading the page prints


# THE SIX COLUMNS, AND THE TWO #239 ADDED. `tom` and `forma` are the ticket's
# own ("o storyboard ... ganha duas colunas, o tom do slide e a forma do gráfico
# (`chart.slope`, por exemplo)"), and the form is written QUALIFIED -- pattern,
# a dot, form -- for two reasons. A row read back in isolation says which
# pattern's vocabulary the form is drawn from, which matters the day a second
# pattern declares forms of its own; and `parse` can then refuse a form that
# belongs to another pattern instead of handing the skeleton a `type=` the
# dialect would reject three steps later.
COLUMNS = (
    Column("number", "#"),
    Column("arc", "função"),
    Column("pattern", "padrão"),
    Column("tone", "tom"),
    Column("form", "forma"),
    Column("message", "mensagem"),
)

# The three fields of a source the table publishes, and the heading each gets.
# The excerpt is the fourth and is not a column -- see `render` below.
SOURCE_COLUMNS = (SOURCE_WHAT, SOURCE_WHERE, SOURCE_WHEN)
SOURCE_LABEL = {
    SOURCE_WHAT: "o que é",
    SOURCE_WHERE: "onde",
    SOURCE_WHEN: "quando",
}


def excerpt_line(key, excerpt):
    """One source's literal excerpt, under the table that named it."""
    return f"- `{key}` — «{excerpt}»"


EXCERPT_ROW = re.compile(r"^-\s+`([^`]+)`\s+—\s+«(.*)»\s*$")

# The arc's own labels, read the other way. `ARC_LABEL` is the register's, and
# inverting it here is what keeps the page from carrying a second table of six
# Portuguese words that could disagree with the first.
ARC_OF_LABEL = {label: arc for arc, label in ARC_LABEL.items()}

# The art direction's choices by the heading each one prints, same idea.
CHOICE_OF_LABEL = {c.label: c for c in DIRECTION_CHOICES}


@dataclass(frozen=True)
class Row:
    """One slide of the plan: everything the page says about it."""

    number: int
    arc: str
    pattern: str
    tone: str       # "" when the page says nothing -- and it says nothing yet
    form: str       # "" for every pattern that draws no series
    message: str


@dataclass(frozen=True)
class Plan:
    """A storyboard read back: the deck it describes, before a slide exists.

    IT IS THE SAME FACTS `Deck` CARRIES AND NONE OF THE WORDS. A deck knows
    every slot of every slide; a plan knows the header, the art direction, one
    row per slide and the sources -- which is exactly what a storyboard
    publishes, and exactly what #239's skeleton has to paint from.
    """

    header: dict          # every field of `DECK_FIELDS`, by name
    direction: dict       # choice name -> the value the page published
    rows: tuple           # Row, in the order the deck is read
    sources: dict         # id -> {field: value}, in written order


def _agreed():
    """Refuse a page that cannot carry the whole header the register declares.

    A SEVENTH FIELD IN `DECK_FIELDS` IS A RED HERE, NOT A FIELD THE SKELETON
    INVENTS. `render` prints what this file lists and `parse` reads what this
    file lists, so a field added to the register and forgotten here would leave
    the storyboard describing a deck with one fact missing -- and the skeleton
    would then have to guess it or drop it, silently, in a page nobody compares.
    """
    carried = {TITLE_FIELD} | {s.field for s in HEADER_LINE}
    missing = [f for f in DECK_FIELDS if f not in carried]
    if missing:
        raise Refused(
            "add " + ", ".join(missing) + " to HEADER_LINE in "
            "compiler/storyboard.py — the register's header holds "
            + ", ".join(DECK_FIELDS)
            + ", and a field this page never prints is a field a skeleton built "
            "from it cannot know"
        )


# ── writing the page ─────────────────────────────────────────────────────────

def message_slot(pattern, written):
    """The slot a slide's message is read out of: what the slide SAYS.

    THE FIRST SLOT THAT MAKES A POINT, IN THE PATTERN'S OWN READING ORDER. Most
    patterns carry exactly one CLAIM slot and it is the obvious answer; the two
    that need the fallback are the whole reason this is a rule rather than a
    field per pattern. A section divider has no claim at all -- its biggest text
    is a NAME, and naming the next act is the divider doing its job -- and a
    figure that gave up its optional title says what it shows in the caption
    instead. Falling back in that order gets every pattern right, and adds
    nothing to the register that would have to be kept in step with the slots
    beside it.

    IT ANSWERS WITH THE SLOT AND NOT WITH THE WORDS (#239), because the rule has
    two readers now. `message` below reads the words out of a slide; the skeleton
    writes the words INTO the slot this returns, for a pattern with no slide yet
    -- and a second copy of "which slot carries the message" is how a storyboard
    ends up publishing one slot and a skeleton filling another.
    """
    for role in (CLAIM, NAME):
        for slot in slot_specs(pattern):
            if slot.role == role and slot.name in written:
                return slot
    for slot in slot_specs(pattern):
        if slot.name in written:
            return slot
    return None


def message(slide):
    """The line the storyboard prints for one slide, out of its own slots."""
    pattern = slide.attrs.get("pattern", "")
    said = texts_of(slide)
    written = {name for name, value in said.items() if value}
    slot = message_slot(pattern, written)
    return said[slot.name] if slot else ""


def cell(text):
    """One table cell: a pipe in the words would end the column early."""
    return text.replace("|", "\\|")


def _printed(field, value):
    """One part of the header line, with its label and its unit around it."""
    said = f"`{value}`" if field.code else value
    return f"{field.prefix}{said}{field.suffix}"


def header_line(header):
    """The line under the title: the whole of the header but its own name."""
    return SEPARATOR.join(_printed(f, header[f.field]) for f in HEADER_LINE)


def _row(cells):
    """One Markdown table row."""
    return "| " + " | ".join(cells) + " |"


def _rule(n):
    """The delimiter row under a table's heading row."""
    return "| " + " | ".join(["---"] * n) + " |"


def shape_of(slide):
    """The form a slide draws its series in, qualified by its pattern.

    SUBSCRIPTED, NOT `.get`, FOR THE SAME REASON THE HEADER IS READ STRAIGHT.
    The vocabulary ruler refuses a chart whose `type=` is missing or is not one
    the register declares, so by the time this runs every chart has a form. A
    fallback here would print `chart.` into the column and call it a shape --
    silence where a KeyError would have named a broken check.
    """
    pattern = slide.attrs.get("pattern", "")
    chart = chart_of(pattern)
    if not chart:
        return ""
    return f"{pattern}.{slide.attrs[chart.attribute].strip()}"


def render(deck, theme, moments):
    """The whole storyboard, as Markdown, for one deck in one theme.

    `moments` is the list of slide numbers the audit counted as peaks, passed in
    rather than recounted: the ruler and this page disagreeing about how many a
    deck holds is the exact class of two-ended contract this skill refuses
    everywhere else.
    """
    _agreed()
    # THE HEADER IS ALREADY WHOLE BY THE TIME THIS RUNS. `build.py` refuses a
    # `<deck>` missing any of DECK_FIELDS before a ruler has read a slide, so
    # this line reads them straight rather than guarding each one -- a default
    # here would be a default nobody could ever reach, and reading as if one
    # were possible is how a promise stops being visible in the code.
    header = dict(deck.header, theme=theme)
    lines = [
        f"# {deck.title}",
        "",
        header_line(header),
        "",
        DIRECTION_HEADING,
        "",
        _row(["", ""]),
        _rule(2),
    ]

    said = texts_of(deck.direction) if deck.direction is not None else {}
    for choice in DIRECTION_CHOICES:
        value = said.get(choice.name, "")
        if not value:
            continue
        # A NAME IS SET AS CODE AND A SENTENCE IS NOT. `Choice.options` is the
        # register's own answer to which of the two a choice is, so the day a
        # choice stops being drawn from a closed set this page follows without
        # being told.
        printed = f"`{value}`" if choice.options else cell(value)
        if choice.name == MOMENTS_CHOICE:
            # THE RANGE IS THE REGISTER'S TO WRITE, not this page's. `Scale.span`
            # is the one place it is spelled in Portuguese, and CATALOG.md's own
            # table of scales prints the same property -- the reference and the
            # storyboard saying a range two different ways would be two ends of
            # one contract, over a string a reader compares by eye.
            scale = scale_of(value)
            if scale:
                printed += f" — {scale.span}, e este deck tem {len(moments)}"
        lines.append(_row([choice.label, printed]))

    lines += [
        "",
        STORYBOARD_HEADING,
        "",
        _row([c.label for c in COLUMNS]),
        _rule(len(COLUMNS)),
    ]
    for n, slide in enumerate(deck.sections, start=1):
        pattern = slide.attrs.get("pattern", "")
        arc = slide.attrs.get(ARC_ATTR, "").strip()
        shape = f"`{pattern}`" + (f" {SEPARATOR.strip()} {MOMENT}" if n in moments else "")
        drawn = shape_of(slide)
        # SUBSCRIPTED, NOT `.get`, FOR THE SAME REASON THE HEADER IS READ
        # STRAIGHT. The vocabulary ruler refuses a `<section>` whose `arc=` is
        # missing or is not one of the six, so by the time this runs every slide
        # has a label. A fallback here would print the English identifier into a
        # Portuguese table and call it a row -- silence where a KeyError would
        # have named a broken check.
        lines.append(_row([
            str(n),
            ARC_LABEL[arc],
            shape,
            slide.attrs.get(TONE_ATTR, "").strip() or ABSENT,
            f"`{drawn}`" if drawn else ABSENT,
            cell(message(slide)),
        ]))

    # THE PROVENANCE, LAST, AND ONLY WHEN THERE IS ONE (#238). The storyboard is
    # what whoever is about to present reads before they stand up, and the one
    # question a room asks that no slide can answer alone is "how old is that
    # number" -- the stage prints two of a source's four fields, and this is the
    # only page that publishes all four. It goes at the END because it is
    # reference and not story: a reader following the arc should reach the closing
    # before they reach a bibliography.
    #
    # THE EXCERPT IS NOT A COLUMN. It is a literal paragraph -- ninety words
    # where the other three fields are five -- and a fifth column holding one
    # would make every row of the table unreadable to publish a field that is
    # usually absent. It goes under the table, for the sources that have one.
    said = sources_of(deck)
    if said:
        lines += [
            "",
            SOURCES_HEADING,
            "",
            _row([SOURCES_SPEC.key] + [SOURCE_LABEL[f] for f in SOURCE_COLUMNS]),
            _rule(1 + len(SOURCE_COLUMNS)),
        ]
        for key, fields in said.items():
            lines.append(_row(
                [f"`{key}`"]
                + [cell(fields.get(f, "")) for f in SOURCE_COLUMNS]
            ))
        quoted = [(key, fields[SOURCE_EXCERPT]) for key, fields in said.items()
                  if fields.get(SOURCE_EXCERPT)]
        if quoted:
            lines += ["", EXCERPT_LEAD, ""]
            for key, excerpt in quoted:
                lines.append(excerpt_line(key, excerpt))

    lines.append("")
    return "\n".join(lines)


def write(path, deck, theme, moments):
    """Put the storyboard beside the deck, and say where it went."""
    where = beside(path)
    with open(where, "w", encoding="utf-8") as fh:
        fh.write(render(deck, theme, moments))
    return where


# ── reading the page back (#239) ─────────────────────────────────────────────
# WHAT THE READER IS FOR, AND WHAT IT IS NOT. It turns the page into a `Plan` --
# the header, the art direction, a row per slide, the sources -- and judges only
# what it cannot pass on: a heading that is not there, a column that is missing,
# a name the register never heard of. Everything else is the dialect ruler's,
# one step later, over the source the skeleton paints.
#
# EVERY REFUSAL NAMES ITS OWN FIX, IN THE IMPERATIVE, the same standard
# `compiler/audit.py` holds itself to: a page a reader has to guess at is a page
# whose author goes back to writing the deck by hand.

CODED = re.compile(r"`([^`]+)`")


def _cells(line):
    """One table row's cells, or None when the line is not a row.

    A CELL IS SPLIT ON THE PIPES THAT ARE NOT ESCAPED, because `cell` above
    writes a slide's own `|` as `\\|` so a sentence cannot end a column early --
    and a reader splitting on every pipe would find a phantom column in exactly
    the deck that needed the escape.
    """
    said = line.strip()
    if not said.startswith("|") or not said.endswith("|"):
        return None
    parts = re.split(r"(?<!\\)\|", said)[1:-1]
    return [p.strip().replace("\\|", "|") for p in parts]


def _is_rule(cells):
    """A delimiter row, or the empty heading row the two-column table opens on."""
    return all(not c or set(c) <= set("-: ") for c in cells)


def _table(block):
    """Every real row of the first table in a block, delimiters dropped."""
    rows = []
    for line in block:
        cells = _cells(line)
        if cells is None:
            if rows:
                break            # the table ended; whatever follows is not it
            continue
        if _is_rule(cells):
            continue
        rows.append(cells)
    return rows


def _blocks(text):
    """The page split by its `##` headings: heading -> the lines under it."""
    out, key, body = {}, None, []
    for line in text.split("\n"):
        if line.startswith("## "):
            if key is not None:
                out.setdefault(key, body)
            key, body = line.strip(), []
            continue
        body.append(line)
    if key is not None:
        out.setdefault(key, body)
    return out


def _coded(said):
    """The first backticked token of a cell, or "" when there is none."""
    found = CODED.search(said)
    return found.group(1).strip() if found else ""


def _header(text):
    """The title and the line under it, back into the six fields of a header."""
    lines = [l.strip() for l in text.split("\n")]
    at = next((i for i, l in enumerate(lines)
               if l.startswith("# ") and l[2:].strip()), None)
    if at is None:
        raise Refused(
            "open the storyboard with `# ` and the deck's title — it is where "
            "the title of the deck is written, and a plan with no title builds "
            "a deck with none"
        )
    title = lines[at][2:].strip()

    shape = SEPARATOR.join(f"{f.prefix}…{f.suffix}" for f in HEADER_LINE)
    said = next((l for l in lines[at + 1:] if l and not l.startswith("#")), "")
    parts = said.split(SEPARATOR)
    if len(parts) != len(HEADER_LINE):
        raise Refused(
            f'write the line under the title as "{shape}" — it carries '
            + ", ".join(f.field for f in HEADER_LINE)
            + f", and this page has {len(parts)} part(s) where there should be "
            f"{len(HEADER_LINE)}"
        )

    header = {TITLE_FIELD: title}
    for field, part in zip(HEADER_LINE, parts):
        value = part.strip()
        if field.prefix and value.startswith(field.prefix):
            value = value[len(field.prefix):]
        if field.suffix and value.endswith(field.suffix):
            value = value[:-len(field.suffix)]
        value = (_coded(value) if field.code else value).strip()
        if not value:
            raise Refused(
                f"give the line under the title a {field.field} — write it as "
                f'"{shape}", and nothing in a header is optional'
            )
        header[field.field] = value
    return header


def _direction(block):
    """The art-direction table, back into the choices the register declares."""
    known = ", ".join(c.label for c in DIRECTION_CHOICES)
    out = {}
    for cells in _table(block):
        if len(cells) < 2:
            continue
        label, printed = cells[0], cells[1]
        choice = CHOICE_OF_LABEL.get(label)
        if choice is None:
            raise Refused(
                f'rename the "{label}" line of {DIRECTION_HEADING[3:]} to one '
                f"the register declares: {known}"
            )
        # THE SAME RULE `render` WROTE IT UNDER, READ THE OTHER WAY. A choice
        # drawn from a closed set was printed as code, so the first backticked
        # token is its whole value -- which is also what drops the range the
        # moments row carries after it. A prose choice is the cell, and an
        # em-dash inside a sentence stays inside it.
        out[choice.name] = _coded(printed) if choice.options else printed

    # THE REQUIRED CHOICES ARE CHARGED HERE AND NOT BY THE DIALECT RULER, and
    # the difference is which artifact the fix names. The ruler would refuse the
    # source a skeleton painted -- "add the missing <p class="cover">" -- and
    # point whoever is reading at a file they never wrote. The missing line is
    # in the PAGE, so the refusal names the page's own row.
    missing = [c.label for c in DIRECTION_CHOICES
               if c.name in DIRECTION_REQUIRED and not out.get(c.name, "").strip()]
    if missing:
        raise Refused(
            f'add the {", ".join(missing)} line(s) to {DIRECTION_HEADING[3:]} — '
            "a deck with no art direction is a deck whose form nobody chose, "
            "and a plan that leaves one blank leaves it to the accident of "
            "whoever writes the source"
        )
    return out


def _rows(block):
    """The slide table, back into one `Row` per slide."""
    rows = _table(block)
    if not rows:
        raise Refused(
            f"give {STORYBOARD_HEADING[3:]} a table — one row per slide, "
            "carrying " + ", ".join(c.label for c in COLUMNS)
        )

    heading, body = rows[0], rows[1:]
    at = {}
    for column in COLUMNS:
        if column.label not in heading:
            raise Refused(
                f'add the "{column.label}" column to {STORYBOARD_HEADING[3:]} '
                "— the table carries " + ", ".join(c.label for c in COLUMNS)
                + ", and a plan missing one of them is a plan with a hole in "
                "every slide"
            )
        at[column.key] = heading.index(column.label)

    known = ", ".join(pattern_names())
    out = []
    for n, cells in enumerate(body, start=1):
        if len(cells) < len(COLUMNS):
            raise Refused(
                f"write row {n} of {STORYBOARD_HEADING[3:]} with all "
                f"{len(COLUMNS)} columns — it has {len(cells)}, and a row short "
                "of a column is a row whose cells mean the wrong thing"
            )
        said = {key: cells[i] for key, i in at.items()}

        arc = ARC_OF_LABEL.get(said["arc"])
        if arc is None:
            raise Refused(
                f'replace "{said["arc"]}" in row {n} with a function of the '
                "arc: " + ", ".join(ARC_LABEL[a] for a in ARC_FUNCTIONS)
            )

        pattern = _coded(said["pattern"])
        if pattern not in pattern_names():
            raise Refused(
                f'replace the pattern "{pattern or said["pattern"]}" in row {n} '
                f"with one the catalog declares: {known}"
            )

        if not said["message"].strip():
            raise Refused(
                f"write the message of row {n} — it is the one line of a plan "
                "that is not a placeholder, and a slide with nothing to say is "
                "a slide nobody can judge the form of"
            )

        out.append(Row(
            number=n,
            arc=arc,
            pattern=pattern,
            tone="" if said["tone"] == ABSENT else said["tone"],
            form=_form(said["form"], pattern, n),
            message=said["message"],
        ))
    return tuple(out)


def _form(said, pattern, n):
    """One `forma` cell, back into the form a chart is drawn in."""
    chart = chart_of(pattern)
    drawn = "" if said == ABSENT else _coded(said)
    if not drawn:
        return ""
    if not chart:
        raise Refused(
            f'clear the forma of row {n} to "{ABSENT}" — the pattern '
            f'"{pattern}" draws no series, and a form written beside one that '
            "does not is a shape nobody can paint"
        )
    owner, _, form = drawn.partition(".")
    forms = ", ".join(f"{pattern}.{f}" for f in form_names(pattern))
    if owner != pattern or form not in form_names(pattern):
        raise Refused(
            f'replace the forma "{drawn}" in row {n} with one the catalog '
            f"declares: {forms}"
        )
    return form


def _sources(block):
    """The provenance table and its excerpts, back into one map by id."""
    out = {}
    for cells in _table(block):
        if len(cells) < 1 + len(SOURCE_COLUMNS):
            continue
        key = _coded(cells[0])
        if not key or key in out:
            continue
        out[key] = {name: cells[i + 1].strip()
                    for i, name in enumerate(SOURCE_COLUMNS)}
    for line in block:
        found = EXCERPT_ROW.match(line.strip())
        if found and found.group(1) in out:
            out[found.group(1)][SOURCE_EXCERPT] = found.group(2)
    return out


def parse(text):
    """One storyboard, back into the plan of the deck it describes.

    IT READS THE PAGE AND NEVER THE DECK, which is what makes the first turn
    possible at all: the plan a skeleton is painted from is the table the
    calibration proposed, and there is no source anywhere for it to have come
    from. A page written by hand and a page this file wrote are the same input.
    """
    _agreed()
    blocks = _blocks(text)
    if STORYBOARD_HEADING not in blocks:
        raise Refused(
            f'give the page a "{STORYBOARD_HEADING}" section — it is the table '
            "of slides, and a storyboard without one describes no deck"
        )
    if DIRECTION_HEADING not in blocks:
        raise Refused(
            f'give the page a "{DIRECTION_HEADING}" section — a deck with no '
            "art direction is a deck whose form nobody chose, and the table "
            "carries " + ", ".join(c.label for c in DIRECTION_CHOICES)
        )
    return Plan(
        header=_header(text),
        direction=_direction(blocks[DIRECTION_HEADING]),
        rows=_rows(blocks[STORYBOARD_HEADING]),
        sources=_sources(blocks.get(SOURCES_HEADING, [])),
    )


def read(path):
    """One storyboard on disk, back into a plan. Refuses a file it cannot read."""
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError as e:
        raise Refused(
            f"point at a storyboard this command can read — {e.strerror}: {path}"
        )
    return parse(text)
