"""The article: a deck as prose, with its drawings beside it.

    /tmp/proposta.deck.html  ->  /tmp/proposta.md  +  /tmp/proposta.slide-05.svg

WHY IT EXISTS. #207's own promise is that nothing a deck leaves out is lost:
what does not fit the stage goes into the speaker notes, and the notes travel
inside the built page where only whoever presents ever opens them. A deck is
therefore the one artifact in this skill that says less than it knows -- and
#237 asks for the other half of it back: "um artigo em Markdown com a história
da apresentação, gerado das notas, do storyboard e das fontes, para publicar o
que apresentei sem reescrever".

IT NEVER WRITES A SENTENCE NOBODY WROTE, and that is the rule the whole file is
shaped around. Every word of the article comes out of a slot or out of a note;
what this generator contributes is ORDER and FURNITURE -- the headings, the
table pipes, the list markers, the reference list at the end. A generator
allowed to phrase one connective would be a generator whose article has to be
read against the deck before it can be published, which is the work it exists
to remove. Whoever runs the skill may retouch the prose afterwards, on request;
that is a person editing a file, not this file's licence.

THE ARTICLE IS THE DECK READ TOP TO BOTTOM. A slide becomes a stretch: the
message the storyboard publishes is the heading, and everything else the slide
holds follows IN THE ORDER IT WAS WRITTEN. The author's order and not the
catalog's, which is the reason `compiler/build.py` already gives for a group's
items one shape up -- catalog order is what a PATTERN is, because composition
is the engine's job, and prose has no composition for the engine to own.

AND WHERE A PATTERN'S COMPOSITION *IS* THE PAIRING, THE ARTICLE CANNOT KNOW IT.
A `comparison` puts `label-a` over `body-a` in one column and `label-b` over
`body-b` in the other, and the thing that pairs them is a grid in
`compiler/stage.html` -- not a fact the register holds, so not a fact this file
can read. Written in catalog order, that slide reaches the article as two names
and then two paragraphs. The lever is the source: the dialect does not care what
order a slide's slots are written in (the stage reorders them anyway), so writing
`label-a`, `body-a`, `label-b`, `body-b` makes the article read in pairs and
changes nothing about the deck. Guessing the pairing here -- "two furniture
lines and two prose lines must be two pairs" -- would be a heuristic dressed as
a rule, and it would be wrong the first time a pattern held three of one and
three of the other for another reason.

THE CHAPTERS ARE THE DIVIDERS. A slide whose message comes out of a NAME slot
is a slide naming the act that starts -- the register says as much where it
declares the role ("naming the next section is the divider doing its job") --
so it becomes the `##` that opens a chapter, and every other slide is a `###`
inside one. A deck with no divider is one long chapter, which is what it was in
the room too.

THE DRAWINGS TRAVEL BESIDE IT, WITH THE COLOURS RESOLVED. Nothing a chart or a
figure paints with is written inside it: `compiler/charts.py` emits class names
and a drawn figure names `var(--token)`, because on the stage the theme is one
inlined stylesheet away. A Markdown file carries no stylesheet, so the SVG that
goes beside one carries the theme's own rules with every `var()` replaced by the
literal the active theme declares -- read out of that theme's sheet and out of
`compiler/stage.html`, never copied into this file. It also carries its own
surface: a chart painted for a dark stage, dropped on a white page, is light
grey text on nothing.

IT IS DETERMINISTIC BYTE FOR BYTE, like the deck, the storyboard and the
skeleton. The only path the article carries is the BASENAME of a drawing beside
it, derived from the article's own name -- so one source written to one name in
two directories is the same file twice.
"""

import html
import os
import re
import shutil
from dataclasses import dataclass, field

import charts
import figures
from catalog import (CLAIM, EVIDENCE_TAGS, FIGURE, ICON, META, NAME,
                     NOTES_TAG, SLOT_TAG, SOURCE_EXCERPT, chart_of, figure_of,
                     group_of, is_table, role_of, slot_specs)
from source import Refused, fields_of, plain_text, sources_of, squeeze, texts_of
from storyboard import (SEPARATOR, SOURCE_COLUMNS, SOURCES_HEADING,
                        message_slot)

HERE = os.path.dirname(os.path.abspath(__file__))
STAGE = os.path.join(HERE, "stage.html")

# THE ROLE THAT OPENS A CHAPTER, asked of the register rather than matched on a
# pattern's name. A slide whose message is a NAME is a slide naming something,
# and that is the whole of what a chapter heading does.
CHAPTER_ROLE = NAME

# ── the theme, resolved to literals ──────────────────────────────────────────
# THE MARKERS ARE THE CONTRACT, AND THEY ARE THE SHAPE `CATALOG.md` ALREADY
# USES. That document carries a generated block between two comments and the
# prose around it is a human's; `compiler/stage.html` carries the paint of a
# chart and of a figure between two pairs of its own, and this file reads them.
# The alternative was a copy of those rules here, kept in step with a stylesheet
# by hand -- the two-ended contract this skill refuses everywhere else.
#
# TWO BLOCKS, BECAUSE A CHART AND A FIGURE ARE PAINTED DIFFERENTLY. Every mark
# of a chart carries a class the sheet binds a colour to; a figure carries its
# own colours as attributes and inherits only two things from the page it sits
# in -- the ink and the body face. Both are unreachable from a file with no
# page around it, and both are read the same way.

PLOT_PAINT = ("/* article:plot-paint:begin */", "/* article:plot-paint:end */")
FIGURE_PAINT = ("/* article:figure-paint:begin */",
                "/* article:figure-paint:end */")

# The prefix every rule inside a marked block opens with: the slide that would
# have been around the drawing. A standalone drawing has none -- the `<svg>`
# itself is the `.plot` or the `.figure` -- so it comes off, and `marked`
# refuses a block that carries no such selector rather than writing an SVG that
# silently paints nothing.
PAINT_PREFIX = re.compile(r'\.slide\[data-pattern="[a-z-]+"\]\s+')

COMMENT = re.compile(r"/\*.*?\*/", re.S)
DECLARATION = re.compile(r"(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)")
VAR = re.compile(r"var\(\s*(--[A-Za-z0-9_-]+)\s*\)")

# The one colour the PAGE used to provide. Everything else a chart or a figure
# wears is in its own markup or in the rules above; the ground under it was the
# slide's, and a Markdown file has none to lend.
SURFACE = "--surface"

# How much room a drawing gets around itself once it is a file of its own. On
# the stage the slide's own padding holds a chart off the edge; a standalone
# viewBox has nothing, and a number written flush against the right edge is
# clipped by whatever renders it.
PAD = 24

# The emphasis the dialect allows inside a slot, and what Markdown does with
# each. `<strong>` has a Markdown spelling and `<mark>` does not -- a highlight
# is the accent rule the stage paints behind a phrase, and `**` would flatten it
# into the bold beside it -- so the tag travels as the valid HTML5 it already
# is. Every renderer an article is published through passes it to the page; a
# reader of the raw file sees a tag instead of a colour, which is the honest
# half of the trade.
BOLD = "strong"
BREAK = "br"

# What a `<br/>` becomes inside a NOTE: the break between two paragraphs. A
# slot's own `<br/>` becomes a space instead -- see `inline`.
PARAGRAPH = "\n\n"


@dataclass
class Paint:
    """What one article needs to put a drawing in a file of its own.

    It travels as one argument because every part is decided once, in `write`,
    and read together at every drawing: the theme's token values, the two sheets
    taken out of the stage, the directory the deck's source was read from --
    which is the only honest anchor for an imported figure's path -- and the
    name the drawings beside the article answer to.
    """

    colours: dict
    plot: str          # the chart's own paint, out of the stage
    figure: str        # the two things a figure inherits from the page
    base: str
    stem: str
    drawings: list = field(default_factory=list)


@dataclass(frozen=True)
class Beside:
    """One file the article carries with it: written, or copied from disk.

    EXACTLY ONE OF THE TWO IS SET, and they are `None` rather than "" so that
    which one it is is a question with an answer. A drawing this generator built
    arrives as text; an imported picture arrives as the path its bytes are at,
    because re-encoding somebody's PNG to carry it four lines is work with no
    reader.
    """

    name: str                # the basename the article references, and writes under
    text: str = None         # the SVG this generator built, when it built one
    source: str = None       # the file on disk to copy, when the figure was imported


def palette(sheets):
    """Every token the active theme declares, by name, last declaration winning.

    IT READS THE THEME'S OWN SHEETS AND NEVER A TABLE HERE.
    `themes/base/tokens.css` says the vocabulary of names is closed and every
    other theme overrides it, so what this returns is whatever the theme in hand
    actually sets -- and a token renamed there becomes a refusal rather than a
    colour that quietly stopped being painted.
    """
    found = {}
    for name, value in DECLARATION.findall(COMMENT.sub("", sheets)):
        found[name] = value.strip()
    return found


def literal(css, colours):
    """One stylesheet, or one drawing, with every `var(--token)` resolved."""
    def pick(match):
        name = match.group(1)
        if name not in colours:
            raise Refused(
                f"declare {name} in themes/base/tokens.css — the article writes "
                "every drawing as a file of its own, with the theme's colours "
                "in it as literals, and this theme sets no value for that name"
            )
        return colours[name]
    return VAR.sub(pick, css)


def marked(markers, colours):
    """One marked block of the stage, as a sheet a standalone drawing can wear."""
    begin, end = markers
    stage = open(STAGE, encoding="utf-8").read()
    if begin not in stage or end not in stage:
        raise Refused(
            f"put {begin} and {end} around that paint in compiler/stage.html — "
            "the article reads the stage's own rules instead of keeping a second "
            "copy of them, and with no markers there is nothing to read"
        )
    block = stage.split(begin, 1)[1].split(end, 1)[0]
    if not PAINT_PREFIX.search(block):
        raise Refused(
            f"rewrite the block between {begin} and {end} in "
            "compiler/stage.html so every rule opens with the slide's own "
            "`.slide[data-pattern=…]` — the article strips that prefix to paint "
            "a drawing with no slide around it, and a rule it cannot strip is a "
            "rule that never reaches the file beside the article"
        )
    # THE COMMENTS STAY IN THE STAGE. They are why a rule is what it is, written
    # for whoever edits the stylesheet -- and this sheet is going inside a file
    # somebody publishes, where the argument behind `:has()` is forty lines of
    # noise between them and the drawing.
    said = COMMENT.sub("", PAINT_PREFIX.sub("", block))
    said = re.sub(r"\n{3,}", "\n\n", said)
    return literal(said, colours).strip()


# ── one drawing, as a file of its own ────────────────────────────────────────

def _n(value):
    """A coordinate, short and stable: the rule `compiler/charts.py` writes by."""
    said = f"{float(value):.2f}".rstrip("0").rstrip(".")
    return "0" if said in ("", "-0") else said


def _padded(view):
    """A viewBox with room on all four sides, and the box that fills it."""
    found = figures.BOX.match(view)
    if not found:
        raise Refused(
            f'fix the vocabulary ruler — it passed a viewBox of "{view}", which '
            "is not four numbers, and this generator will not write a drawing "
            "whose own size nobody validated"
        )
    x, y, w, h = (float(v) for v in found.groups())
    box = (x - PAD, y - PAD, w + 2 * PAD, h + 2 * PAD)
    return " ".join(_n(v) for v in box), box


def standalone(view, body, described, sheet, paint, kind):
    """One drawing as an `.svg` file: its own namespace, sheet and surface.

    `sheet` IS THE ONE THING THE TWO CALLERS DISAGREE ABOUT, and everything else
    they need comes out of the same `Paint` -- so the sheet is an argument and
    the palette is not. Taking both apart would be passing one record's two
    halves as two parameters, and the day a third kind of drawing lands the
    third caller has to know which halves those were.
    """
    said, (x, y, w, h) = _padded(view)
    ground = (f'<rect x="{_n(x)}" y="{_n(y)}" width="{_n(w)}" '
              f'height="{_n(h)}" '
              f'fill="{literal(f"var({SURFACE})", paint.colours)}"/>')
    style = f"<style>\n{sheet}\n</style>" if sheet else ""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'class="{kind}" viewBox="{said}" role="img" '
        f'aria-label="{html.escape(described, quote=True)}">'
        f"{style}{ground}{body}</svg>\n"
    )


def _chart(slide, pattern, container, paint):
    """One chart of a deck, as a standalone SVG and the words describing it."""
    chart = chart_of(pattern)
    points = charts.series(container, group_of(pattern))
    said = charts.described(points)
    drawn = standalone(
        f"0 0 {charts.PLOT_W} {charts.PLOT_H}",
        charts.marks(slide.attrs[chart.attribute].strip(), points),
        said,
        paint.plot,
        paint,
        "plot",
    )
    return drawn, said


def _drawn(figure, container, described, paint):
    """One hand-drawn figure of a deck, as a standalone SVG."""
    return standalone(
        figures.attribute(container, figure.box).strip(),
        literal(figures.body(container, figure), paint.colours),
        described,
        paint.figure,
        paint,
        "figure",
    )


def _imported(figure, container, paint):
    """Where an imported figure's bytes are, and the extension they answer to.

    IT IS COPIED AND NEVER EMBEDDED. A deck inlines a picture as a `data:` URI
    because a deck is ONE file; an article is a file and its drawings, so the
    bytes go beside it under a name derived from the article's own -- which is
    also what keeps the picture there when the source's directory is not.
    """
    resolved = figures.resolve(
        figures.attribute(container, figure.path), paint.base, figure)
    if resolved.fix:
        # THE SECOND LOCK, the same one `compiler/build.py` keeps. The
        # `figure-asset` ruler already refused this source, so reaching here
        # means a check stopped being enforced -- and an article referencing a
        # picture nobody can open is worse than no article.
        raise Refused(resolved.fix)
    return resolved.path, os.path.splitext(resolved.path)[1].lower()


# ── the article itself ───────────────────────────────────────────────────────

def _cell(text):
    """One table cell: a pipe in the words would end the column early."""
    return text.replace("|", "\\|")


def inline(node, on_break=" "):
    """A slot's or a note's words, with the deck's own emphasis carried over.

    A FORCED LINE IS THE STAGE'S COMPOSITION AND NOT THE ARTICLE'S. `<br/>`
    inside a slot is where its author wanted the line to turn on a 16:9
    projector, and an article sets its own measure -- so by default it comes
    through as the space `source.plain_text` already counts it as, and the
    sentence reads as one sentence. A NOTE is the exception, and `notes_of`
    passes the break it wants: there the same tag is where its author moved to
    the next thought, and it is the only paragraph mark a note has.
    """
    out = []
    for child in node.children:
        if isinstance(child, str):
            out.append(squeeze(child))
            continue
        if child.tag == BREAK:
            out.append(on_break)
            continue
        if child.tag == BOLD:
            out.append(f"**{inline(child, on_break)}**")
            continue
        out.append(f"<{child.tag}>{inline(child, on_break)}</{child.tag}>")
    said = "".join(out)
    # THE SQUEEZE RUNS ONCE, AT THE TOP, for the reason `source.inline_markup`
    # gives: per run it eats the space between a word and an emphasised word.
    # What it cleans up here is the pair of spaces a `<br/>` written with air
    # around it leaves behind.
    return re.sub(r"[ \t]{2,}", " ", said).strip()


def said_as(role, text):
    """One slot's words, set by the role the register gives the slot.

    THE ROLE AND NOTHING ELSE, so a pattern added later reads as prose with no
    line added here. A claim and a name are the strongest text on a stage and
    are bold; a number set large is read as an image there and is bold here;
    prose is prose; furniture -- a label, an index, a unit -- is the small type
    of the stage and is italic.
    """
    if role in (CLAIM, NAME, FIGURE):
        return f"**{text}**"
    if role == META:
        return f"*{text}*"
    return text


def citation(key):
    """Where a citing slot's id goes: a pointer at the list at the end.

    THE STAGE PRINTS THE SOURCE AND THE ARTICLE POINTS AT IT, and the
    difference is the medium. A slide has one line under it and no
    bibliography, so `compiler/build.py` writes "what · when" where the id was;
    an article has a reference list, so the id stays an id and is resolved once
    at the end -- which is how four charts reading one panel cite it four times
    and print it once.
    """
    return f"*Fonte `{key}`.*"


def table_of(container):
    """One `<table>` of a deck, as a Markdown table."""
    thead = next(c for c in container.elements() if c.tag == "thead")
    tbody = next(c for c in container.elements() if c.tag == "tbody")
    head = next(c for c in thead.elements() if c.tag == "tr")
    heads = [_cell(inline(c)) for c in head.elements() if c.tag == "th"]
    out = ["| " + " | ".join(heads) + " |",
           "| " + " | ".join(["---"] * len(heads)) + " |"]
    for tr in tbody.elements():
        if tr.tag != "tr":
            continue
        cells = [_cell(inline(c)) for c in tr.elements() if c.tag == "td"]
        out.append("| " + " | ".join(cells) + " |")
    return "\n".join(out)


def group_of_slide(container, pattern):
    """One repeating group of a deck, as a Markdown list.

    THE MARKER IS THE TAG'S. A group written as `<ol>` is a sequence -- the
    milestones of a timeline -- and one written as `<ul>` is a set; the register
    already decided which each pattern is, and numbering a list the deck never
    numbered would be this file adding an argument.
    """
    group = group_of(pattern)
    ordered = group.container == "ol"
    out = []
    for i, item in enumerate(container.elements(), start=1):
        if item.tag != group.item:
            continue
        fields = fields_of(item)
        said = SEPARATOR.join(
            said_as(f.role, inline(fields[f.name]))
            for f in group.fields if f.name in fields
        )
        if group.flag and group.flag in item.attrs:
            said += f" *({group.flag_purpose})*"
        out.append(f"{i}. {said}" if ordered else f"- {said}")
    return "\n".join(out)


def notes_of(element):
    """One slide's speaker notes, as the paragraphs of its stretch.

    A FORCED LINE IS A PARAGRAPH BREAK HERE. On the stage a `<br/>` inside a
    note is punctuation in a panel one person reads; in an article the same
    break is where its author moved to the next thought, and running two of
    them together would be this file deciding they were one.
    """
    return [run.strip() for run in inline(element, PARAGRAPH).split(PARAGRAPH)
            if run.strip()]


def exhibit(slide, n, container, pattern, paint):
    """Whatever a slide shows besides its words, as one Markdown block.

    THE FOUR SHAPES ARE THE REGISTER'S, asked in the same order
    `compiler/build.py` asks them -- a figure, a chart, a group, a table. Two
    of the four leave a file beside the article; the other two are Markdown all
    the way down.
    """
    figure = figure_of(pattern)
    if figure:
        caption = texts_of(slide).get(figure.caption, "")
        if container.tag == figure.drawn:
            name = f"{paint.stem}.slide-{n:02d}.svg"
            paint.drawings.append(
                Beside(name, text=_drawn(figure, container, caption, paint)))
        else:
            where, extension = _imported(figure, container, paint)
            name = f"{paint.stem}.slide-{n:02d}{extension}"
            paint.drawings.append(Beside(name, source=where))
        return f"![{_cell(caption)}]({name})"
    if chart_of(pattern):
        name = f"{paint.stem}.slide-{n:02d}.svg"
        drawn, said = _chart(slide, pattern, container, paint)
        paint.drawings.append(Beside(name, text=drawn))
        return f"![{_cell(said)}]({name})"
    if group_of(pattern):
        return group_of_slide(container, pattern)
    if is_table(pattern):
        return table_of(container)
    return ""


def chapter(slide, pattern):
    """The heading a divider opens a chapter with: everything the divider says.

    THE PATTERN EXISTS TO PUT A NUMBER OVER A NAME, and the two together are
    the act's own title -- printing the name as a heading and the number as a
    paragraph under it would split one line of the deck into two of the article.
    """
    return "## " + SEPARATOR.join(
        inline(el) for el in slide.elements()
        if el.tag == SLOT_TAG
        and role_of(pattern, el.attrs.get("class", "").strip()) is not None
    )


def stretch(slide, n, paint):
    """One slide of the deck, as the blocks of one stretch of the article."""
    pattern = slide.attrs.get("pattern", "")
    said = texts_of(slide)
    message = message_slot(pattern, {k for k, v in said.items() if v})

    if message is not None and message.role == CHAPTER_ROLE:
        # A CHAPTER IS A HEADING AND ITS NOTES, NEVER A HEADING ALONE. Returning
        # here with the heading dropped the speaker notes of every divider --
        # which is the one class of text this whole file exists to rescue, since
        # a note never reached the stage either. A divider carries at most two
        # slots and both are in the heading, so the note is all that is left.
        return [chapter(slide, pattern)] + [
            said for el in slide.elements() if el.tag == NOTES_TAG
            for said in notes_of(el)
        ]

    blocks = []
    if message is not None:
        # A QUOTATION IS NOT A HEADING, AND THE REGISTER IS WHAT SAYS SO.
        # `Slot.verbatim` marks the one text on a stage whose words are somebody
        # else's -- so it opens the stretch as the blockquote a reader of an
        # article already knows a borrowed voice by, rather than as this
        # article's own section title.
        said_as_heading = "> " if message.verbatim else "### "
        blocks.append(said_as_heading + said[message.name])

    # AN ICON'S OTHER HALF IS A LIST ITEM (`Slot.pairs_with`). The icon itself
    # prints nothing here, and the line it travelled with was a bullet on the
    # stage -- a set of them written as loose paragraphs would be an article
    # that lost the one thing the pattern was about.
    listed = {s.pairs_with for s in slot_specs(pattern)
              if s.role == ICON and s.pairs_with}

    for el in slide.children:
        if isinstance(el, str):
            continue
        if el.tag == NOTES_TAG:
            blocks.extend(notes_of(el))
            continue
        if el.tag in EVIDENCE_TAGS:
            blocks.append(exhibit(slide, n, el, pattern, paint))
            continue
        if el.tag != SLOT_TAG:
            continue
        name = el.attrs.get("class", "").strip()
        role = role_of(pattern, name)
        # AN ICON PRINTS NOTHING, HERE AS ON THE STAGE. Its content is a Lucide
        # name -- furniture for a sprite, never a sentence the room reads -- and
        # an article has no sprite to point at; the text of the item it is
        # paired with is what says the thing.
        if role is None or role == ICON:
            continue
        if message is not None and name == message.name:
            continue
        slot = next((s for s in slot_specs(pattern) if s.name == name), None)
        if slot is not None and slot.cites:
            blocks.append(citation(plain_text(el)))
            continue
        if name in listed:
            item = f"- {inline(el)}"
            # ONE LIST AND NOT FIVE. Every block of this stretch is separated by
            # a blank line, which turns five consecutive items into a list
            # spaced like paragraphs; joined, they are the tight list the slide
            # showed.
            if blocks and blocks[-1].startswith("- "):
                blocks[-1] += "\n" + item
            else:
                blocks.append(item)
            continue
        blocks.append(said_as(role, inline(el)))
    return [b for b in blocks if b]


def references(deck):
    """The sources as a reference list, under the storyboard's own heading.

    EVERY ID A STRETCH CITES IS RESOLVED HERE ONCE, which is the shape a reader
    of an article already knows -- and the one thing the stage cannot do,
    because a slide has a line under it and no bibliography. The excerpt rides
    under its own source, as the continuation of the item: it is the literal
    paragraph a quotation was cut out of, and whoever checks a quotation checks
    it against that.
    """
    found = sources_of(deck)
    if not found:
        return []
    lines = ["", SOURCES_HEADING]
    for key, fields in found.items():
        said = SEPARATOR.join(
            fields[f] for f in SOURCE_COLUMNS if fields.get(f))
        lines += ["", f"- `{key}` — {said}"]
        if fields.get(SOURCE_EXCERPT):
            lines.append(f"  «{fields[SOURCE_EXCERPT]}»")
    return lines


def render(deck, paint):
    """The whole article, as Markdown, for one deck in one theme."""
    lines = [f"# {deck.title}", "", deck.header["occasion"]]
    for n, slide in enumerate(deck.sections, start=1):
        for block in stretch(slide, n, paint):
            lines += ["", block]
    lines += references(deck)
    lines.append("")
    return "\n".join(lines)


def write(path, deck, theme, sheets):
    """Put the article where it was asked for, its drawings beside it.

    Returns every path written, the article first, so the caller says where each
    of them went -- the same promise the deck mode makes about the page and the
    storyboard beside it.
    """
    where = os.path.dirname(os.path.abspath(path))
    colours = palette(sheets)
    paint = Paint(
        colours=colours,
        plot=marked(PLOT_PAINT, colours),
        figure=marked(FIGURE_PAINT, colours),
        base=deck.base,
        stem=os.path.splitext(os.path.basename(path))[0],
    )
    text = render(deck, paint)

    os.makedirs(where, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    written = [path]
    for drawing in paint.drawings:
        beside = os.path.join(where, drawing.name)
        if drawing.source is not None:
            shutil.copyfile(drawing.source, beside)
        else:
            with open(beside, "w", encoding="utf-8") as fh:
                fh.write(drawing.text)
        written.append(beside)
    return written
