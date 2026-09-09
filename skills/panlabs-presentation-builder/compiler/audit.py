"""The audit: every ruler that reads the source, and the report they write.

A RULER MEASURES A DEFECT, NOT A TASTE. Whether the deck is any good is what
the contact sheet and a pair of eyes are for; what belongs here is the class
of mistake the eye does not catch -- a class that is not in the catalog, a
slot that is missing, a budget that is over.

ONE RULER READS THE DIALECT AND THE REST READ THE DOCTRINE. The first refuses
a source the compiler cannot build; every other one builds fine and would ship
a deck that fails in the room -- a slide with a paragraph on it, a title that
names a folder instead of making a point, the same shape twice in a row, a
chart whose shares do not add up. All of them are STATIC in the sense that
matters here -- none needs a BROWSER: counting words, reading a title,
comparing two `pattern=` attributes, adding up a column of numbers and asking
the disk whether a file is there and how much it weighs are all answerable
before a byte of the page exists, and a defect that can be named that early
should be. `figure-asset` (#214) is the one that reaches past the source to
the disk, because where a picture is and what is inside it is not something
the deck's own text can answer.

EVERY RED NAMES ITS OWN FIX, IN THE IMPERATIVE. "unknown class" is a
diagnosis and leaves the reader to guess; "drop the class …" is the repair.
The proof beside this file asserts the fix, not the diagnosis, which is what
stops the message from being rewritten into a shrug.

The report is printed by the build command on every run, green or red, so
that "what is wrong with this deck" is answerable without opening a browser.
"""

import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal

import charts
import figures
import fonts
import icons
from catalog import (ARC_ATTR, ARC_CALL, ARC_FUNCTIONS, BREAK_TAG,
                     CATEGORY_TITLES, COLOUR_CHOICES, COVER_CHOICE,
                     DIRECTION_REQUIRED, DIRECTION_TAG, EVIDENCE_TAGS, ICON,
                     INLINE_TAGS, MOMENT_SCALES, MOMENTS_CHOICE, NOTES_TAG,
                     PATTERNS, RENOUNCE_CHOICES, SLOT_TAG, STEP_ATTR,
                     TABLE_MAX_ROWS, allow_break_of, budget_of, chart_of,
                     choice_names, choice_of, claims_of, closings, evidence_of,
                     figure_of, form_names, form_of, group_of, moment_of,
                     pattern_names, role_of_element, scale_of, slot_specs,
                     slots_of)
from source import fields_of, plain_text, texts_of


@dataclass(frozen=True)
class Ruler:
    name: str
    headline: str


@dataclass
class Verdict:
    ruler: Ruler
    fixes: list

    @property
    def ok(self):
        return not self.fixes


VOCABULARY = Ruler(
    "vocabulary",
    "every pattern, class and tag in the source is one the catalog declares",
)

WORD_BUDGET = Ruler(
    "word-budget",
    "no slide spends more words than its pattern budgets",
)

CATEGORY_TITLE = Ruler(
    "category-title",
    "every claim on the stage makes a point, not a category",
)

REPEATED_PATTERN = Ruler(
    "repeated-pattern",
    "no slide takes the same shape as the one before it",
)

ICON_KNOWN = Ruler(
    "icon-known",
    "every icon a slide names is one the vendored Lucide set carries",
)

ICON_PAIRED = Ruler(
    "icon-paired",
    "a slot never appears without the one it is paired with",
)

CHART_DATA = Ruler(
    "chart-data",
    "every value a chart draws is a number, and a share adds up",
)

CHART_SOURCE = Ruler(
    "chart-source",
    "every chart says where its number came from, and when",
)

CHART_FIT = Ruler(
    "chart-fit",
    "every label a chart draws fits the room its form gives it",
)

FIGURE_PAINT = Ruler(
    "figure-paint",
    "every colour a drawn figure wears is a token of the theme",
)

FIGURE_ASSET = Ruler(
    "figure-asset",
    "every image a figure points at is there, and fits under the ceiling",
)

THEME_REPERTOIRE = Ruler(
    "theme-repertoire",
    "every character the deck prints is one the theme's own faces carry",
)

MOMENT_SCALE = Ruler(
    "moment-scale",
    "the deck holds as many moments as the scale it declared",
)

COLOUR_SEMANTICS = Ruler(
    "colour-semantics",
    "every content colour a slide paints with is one the direction declared",
)

RENOUNCED_PATTERN = Ruler(
    "renounced-pattern",
    "no slide takes a shape the direction gave up",
)

ARC_CLOSING = Ruler(
    "arc-closing",
    "the deck ends on a closing, and the closing asks for something",
)


# ── reading a slide, before anyone judges it ─────────────────────────────────

def _at(n, node):
    """Where a fix has to be applied, in the one form every ruler names it.

    Slide number AND source line: the number is what the reader sees on the
    stage, the line is what the reader edits, and a fix that gives only one of
    them sends somebody counting sections by hand.
    """
    return f"slide {n} (line {node.line})"


def _words(text):
    """Words the way the back row counts them: a token with a letter or a digit.

    Splitting on whitespace and keeping what has an alphanumeric in it is what
    makes "compiler/build.py" one word and an em dash none of one -- a reader
    counting the slide out loud gets the same number, which is the only number
    a budget can be argued against.
    """
    return sum(1 for token in text.split() if any(c.isalnum() for c in token))


def _bare(text):
    """A title stripped down to what it SAYS: no case, no accent, no punctuation."""
    flat = unicodedata.normalize("NFD", text)
    flat = "".join(c for c in flat if not unicodedata.combining(c))
    return " ".join(flat.casefold().split()).strip(" .:;!?…—–-·")


CATEGORIES = frozenset(_bare(t) for t in CATEGORY_TITLES)


def _slot_list(pattern):
    slots = slots_of(pattern)
    count = "one slot" if len(slots) == 1 else f"{len(slots)} slots"
    return f'the pattern "{pattern}" declares {count}: ' + ", ".join(slots)


def _emphasis(node, at, slot, allow_break):
    """Everything below a slot: emphasis the dialect knows, and no attributes.

    BREAK_TAG IS CHECKED FIRST AND NEVER RECURSED INTO. It is not a member of
    INLINE_TAGS -- a forced break is not emphasis, it is doctrine gated per
    pattern (#211's own rule: allowed only where the pattern itself permits
    it) -- and unlike `<strong>` or `<mark>` it carries no content of its own
    to validate underneath it.
    """
    fixes = []
    for child in node.children:
        if isinstance(child, str):
            continue
        if child.tag == BREAK_TAG:
            if not allow_break:
                fixes.append(
                    f'{at}, slot "{slot}": drop the <{BREAK_TAG}/> — this '
                    "pattern does not permit a forced break"
                )
                continue
            if child.children:
                fixes.append(
                    f'{at}, slot "{slot}": self-close the <{BREAK_TAG}/> — a '
                    "forced break carries no content of its own"
                )
                continue
            for key in sorted(child.attrs):
                fixes.append(
                    f'{at}, slot "{slot}": drop {key}= from the <{BREAK_TAG}/> '
                    "— geometry does not cross this seam"
                )
            continue
        if child.tag not in INLINE_TAGS:
            fixes.append(
                f'{at}, slot "{slot}": drop the <{child.tag}> — the emphasis '
                "the dialect knows is " + " and ".join(f"<{t}>" for t in INLINE_TAGS)
                + f", plus <{BREAK_TAG}/> where the pattern allows it"
            )
            continue
        for key in sorted(child.attrs):
            fixes.append(
                f'{at}, slot "{slot}": drop {key}= from the <{child.tag}> — '
                "geometry does not cross this seam"
            )
        fixes.extend(_emphasis(child, at, slot, allow_break))
    return fixes


def _slot(el, at, pattern, seen):
    """One slot: its name, the bare `step` that may make it a fragment, and
    the emphasis under it.

    THE ONE ATTRIBUTE BESIDES `class=` IS BARE, AND THAT IS THE WHOLE OF IT
    (#215). `step` says the slot arrives on a later beat; it says nothing
    about WHICH beat, because the order a fragment is revealed in is the
    order the pattern reads its slots -- a number written here would be a
    second ordering, disagreeing with the first the day somebody reorders the
    register. A valued `step=` is refused rather than ignored: silently
    dropping the number an author wrote is how a deck stops matching its own
    source.
    """
    fixes = []
    if el.tag != SLOT_TAG:
        return [
            f"{at}: write the slot as <{SLOT_TAG}>, not <{el.tag}> — every "
            "text slot in this dialect is a paragraph"
        ]

    for key in sorted(k for k in el.attrs if k not in ("class", STEP_ATTR)):
        fixes.append(
            f"{at}: drop {key}= from the <{SLOT_TAG}> — a slot carries "
            f"class= and, at most, the bare `{STEP_ATTR}`"
        )
    if el.attrs.get(STEP_ATTR, "").strip():
        fixes.append(
            f"{at}: write `{STEP_ATTR}` bare, with no value — a fragment is "
            "revealed in the order the pattern reads its slots, never in an "
            "order typed into the attribute"
        )

    classes = el.attrs.get("class", "").split()
    if not classes:
        return fixes + [
            f"{at}: name the <{SLOT_TAG}> with a class — " + _slot_list(pattern)
        ]
    if len(classes) > 1:
        fixes.append(
            f"{at}: keep one class on the <{SLOT_TAG}> — a slot has one name, "
            f'and "{" ".join(classes)}" is {len(classes)}'
        )

    for name in classes:
        if name in slots_of(pattern):
            seen.append(name)
        else:
            fixes.append(f'{at}: drop the class "{name}" — ' + _slot_list(pattern))

    fixes.extend(_emphasis(el, at, classes[0], allow_break_of(pattern)))
    return fixes


# ── a group's item, and the group itself ─────────────────────────────────────
# #212 IS THE FIRST TICKET WHERE A PATTERN SAYS MORE THAN ONE OF A NAME. Every
# slot above is written once because #210 never needed more; a metric, a
# milestone and a table's row are a SERIES, and the two functions below are
# what let one pattern hold a bounded, repeating shape instead of inventing a
# second dialect for it.

def _field_list(group):
    fields = tuple(f.name for f in group.fields)
    count = "one field" if len(fields) == 1 else f"{len(fields)} fields"
    return f"each <{group.item}> declares {count}: " + ", ".join(fields)


def _field(el, at, group, seen, allow_break, drawn=False):
    """One field inside a group's item -- the same shape as `_slot`, one level
    deeper, and kept as its own function rather than a shared one because the
    vocabulary it reads is the group's fields, never the pattern's slots.

    A DRAWN FIELD TAKES NO EMPHASIS (#213). Every other field here reaches the
    page as a `<p>` and keeps whatever bold or highlight the author put in it;
    a chart's field reaches it as SVG text, where there is nowhere for either
    to go. `plain_text` would flatten them without a word, which is the one
    outcome worth a red: a deck whose author asked for emphasis and got
    silence is a deck that lies to its own source.
    """
    fixes = []
    if el.tag != SLOT_TAG:
        return [
            f"{at}: write the field as <{SLOT_TAG}>, not <{el.tag}> — every "
            "field inside a group is a paragraph"
        ]

    for key in sorted(k for k in el.attrs if k != "class"):
        fixes.append(
            f"{at}: drop {key}= from the <{SLOT_TAG}> — a field carries "
            "class= and nothing else"
        )

    classes = el.attrs.get("class", "").split()
    field_names = tuple(f.name for f in group.fields)
    if not classes:
        return fixes + [f"{at}: name the <{SLOT_TAG}> with a class — " + _field_list(group)]
    if len(classes) > 1:
        fixes.append(
            f"{at}: keep one class on the <{SLOT_TAG}> — a field has one name, "
            f'and "{" ".join(classes)}" is {len(classes)}'
        )

    for name in classes:
        if name in field_names:
            seen.append(name)
        else:
            fixes.append(f'{at}: drop the class "{name}" — ' + _field_list(group))

    if drawn:
        for child in el.children:
            if not isinstance(child, str):
                fixes.append(
                    f'{at}, field "{classes[0]}": drop the <{child.tag}> — this '
                    "text is drawn into a chart, and a drawing has nowhere to "
                    "put emphasis"
                )
    else:
        fixes.extend(_emphasis(el, at, classes[0], allow_break))
    return fixes


def _group(container, at, pattern, group, form=None, drawn=False):
    """One group, judged against the bounds that actually apply to it.

    THE FORM TIGHTENS WHAT THE GROUP DECLARES (#213). A chart's group carries
    the envelope every one of its forms fits inside, and the form carries the
    pair that measures a slide -- two points is a fine bar chart and a broken
    line, and only the form knows which is being drawn.
    """
    low = form.minimum if form else group.minimum
    high = form.maximum if form else group.maximum
    named = f'the form "{form.name}"' if form else f'the pattern "{pattern}"'

    fixes = []
    for key in sorted(container.attrs):
        fixes.append(
            f"{at}: drop {key}= from the <{group.container}> — it carries no "
            "attribute of its own"
        )
    for child in container.children:
        if isinstance(child, str) and child.strip():
            fixes.append(
                f"{at}: wrap the loose text in a <{group.item}> — a "
                f"<{group.container}> holds <{group.item}> and nothing else"
            )

    flagged = 0
    item_count = 0
    for item in container.elements():
        if item.tag != group.item:
            fixes.append(
                f"{at}: write each entry as <{group.item}>, not <{item.tag}> "
                f"— {named} counts <{group.item}>, one per item"
            )
            continue
        item_count += 1

        extra = (group.flag,) if group.flag else ()
        if group.flag and group.flag in item.attrs:
            flagged += 1
        for key in sorted(k for k in item.attrs if k not in extra):
            fixes.append(
                f"{at}: drop {key}= from the <{group.item}>" + (
                    f" — the only attribute a <{group.item}> may carry is "
                    f"the bare `{group.flag}`" if group.flag else
                    " — it carries no attribute of its own"
                )
            )

        seen = []
        for sub in item.children:
            if isinstance(sub, str):
                if sub.strip():
                    fixes.append(f"{at}: wrap the loose text in a field — " + _field_list(group))
                continue
            fixes.extend(_field(sub, at, group, seen, allow_break_of(pattern), drawn))

        # THE SAME HOLE `_slide` CLOSES ONE LEVEL UP (#213). An empty field is
        # not a missing one, and for a drawn group it is worse than cosmetic:
        # there is no number for the generator to place a mark at.
        written = fields_of(item)
        for want in group.required_fields:
            if want not in seen:
                fixes.append(
                    f'{at}: add the missing <{SLOT_TAG} class="{want}"> to a '
                    f"<{group.item}> — every item of this group needs it"
                )
            elif not plain_text(written[want]).strip():
                fixes.append(
                    f'{at}: write something in the <{SLOT_TAG} class="{want}"> of '
                    f"a <{group.item}> — it is there and it is empty, and every "
                    "item of this group needs it answered"
                )
        for name in sorted(set(s for s in seen if seen.count(s) > 1)):
            fixes.append(
                f'{at}: keep one <{SLOT_TAG} class="{name}"> per <{group.item}> '
                "— an item declares the field once"
            )

    if item_count < low:
        fixes.append(
            f"{at}: add {low - item_count} more <{group.item}> — {named} needs "
            f"{low} to {high}, and this one has {item_count}"
        )
    elif item_count > high:
        fixes.append(
            f"{at}: drop {item_count - high} <{group.item}> — {named} needs "
            f"{low} to {high}, and this one has {item_count}"
        )
    if group.flag and flagged > 1:
        fixes.append(
            f"{at}: keep `{group.flag}` on at most one <{group.item}> — "
            f"{flagged} carry it, and {named} marks one"
        )
    return fixes


# ── a table ───────────────────────────────────────────────────────────────────
# A TABLE'S COLUMNS ARE THE DECK'S OWN WORDS, NOT THE REGISTER'S. Every group
# above has fields fixed by the catalog because a metric is always a value and
# a label; a table's header is whatever the author is comparing, so the only
# thing this pattern can fix in advance is the SHAPE -- one header, a bounded
# number of rows, every row answering every column.

def _table_cell(el, at, tag, allow_break):
    fixes = []
    if el.tag != tag:
        return [f"{at}: write the cell as <{tag}>, not <{el.tag}>"]
    for key in sorted(el.attrs):
        fixes.append(f"{at}: drop {key}= from the <{tag}> — a cell carries no attribute")
    fixes.extend(_emphasis(el, at, tag, allow_break))
    return fixes


def _table(table, at, pattern):
    fixes = []
    allow_break = allow_break_of(pattern)
    for key in sorted(table.attrs):
        fixes.append(f"{at}: drop {key}= from the <table> — it carries no attribute of its own")
    for child in table.children:
        if isinstance(child, str) and child.strip():
            fixes.append(f"{at}: wrap the loose text in a <thead> or <tbody> row")

    kids = table.elements()
    for stray in kids:
        if stray.tag not in ("thead", "tbody"):
            fixes.append(
                f"{at}: drop the <{stray.tag}> from the <table> — a table holds "
                "a <thead> and a <tbody>, nothing else"
            )
    theads = [c for c in kids if c.tag == "thead"]
    tbodies = [c for c in kids if c.tag == "tbody"]
    if len(theads) != 1:
        fixes.append(
            f'{at}: give the <table> exactly one <thead> — the pattern "{pattern}" '
            f"needs a header, and this one has {len(theads)}"
        )
    if len(tbodies) != 1:
        fixes.append(f"{at}: give the <table> exactly one <tbody> — this one has {len(tbodies)}")
    if len(theads) != 1 or len(tbodies) != 1:
        return fixes

    head_rows = [c for c in theads[0].elements() if c.tag == "tr"]
    if len(head_rows) != 1:
        fixes.append(
            f"{at}: give the <thead> exactly one <tr> — this one has {len(head_rows)}"
        )
        return fixes
    heads = head_rows[0].elements()
    for cell in heads:
        fixes.extend(_table_cell(cell, at, "th", allow_break))
    columns = len(heads)
    if columns == 0:
        fixes.append(f"{at}: give the header <tr> at least one <th> — an empty header proves nothing")
        return fixes

    body_rows = [c for c in tbodies[0].elements() if c.tag == "tr"]
    for row in body_rows:
        cells = row.elements()
        for cell in cells:
            fixes.extend(_table_cell(cell, at, "td", allow_break))
        if len(cells) != columns:
            fixes.append(
                f"{at}: give this <tr> {columns} <td> like the header, not "
                f"{len(cells)} — every row answers every column"
            )

    rows = 1 + len(body_rows)  # the header IS a line of the table
    ceiling = TABLE_MAX_ROWS
    if rows < 2:
        fixes.append(f"{at}: add a <tr> to the <tbody> — a header with no data proves nothing")
    elif rows > ceiling:
        fixes.append(
            f"{at}: drop {rows - ceiling} <tr> from the <tbody> — the pattern "
            f'"{pattern}" allows {ceiling} lines, header included, and this one has {rows}'
        )
    return fixes


# ── a figure ──────────────────────────────────────────────────────────────────
# THE VOCABULARY IS THE WHOLE GUARD, and it is the same guard the rest of this
# file spends. #214 asks that a drawing with a `<script>` in it, or one
# reaching outside the page, be refused -- and neither needs a rule of its own:
# `<script>`, `<use>`, `<image>`, `<foreignObject>`, `href=`, `style=` and every
# `on…=` are simply not in `Figure.tags` and `Figure.attrs`. A vocabulary with
# one hole punched per threat is a vocabulary that has a hole for the threat
# nobody thought of; a closed one has none by construction.
#
# WHAT IS *IN* THE COLOURS IS NOT THIS RULER'S BUSINESS. `fill=` is a legal
# attribute whose VALUE may still be a hexadecimal, and a value is a different
# question from a name -- `figure-paint` below is where that verdict lives, so
# a red about a literal colour reads as one line about colour instead of
# hiding inside a list about vocabulary.

def _drawing(node, at, figure, root=False):
    fixes = []

    if root:
        said = figures.attribute(node, figure.box).strip()
        if not said:
            fixes.append(
                f"{at}: give the <{figure.drawn}> a {figure.box}= — without one "
                "the drawing has no size of its own, and the stage has nothing "
                "to scale it against"
            )
        elif not figures.box_is_sound(said):
            fixes.append(
                f'{at}: write the {figure.box}= as four numbers with the last '
                f'two above zero, not "{said}" — they are the drawing\'s own '
                "width and height"
            )

    allowed = {a.lower() for a in figure.attrs}
    for key in sorted(k for k in node.attrs if k.lower() not in allowed):
        fixes.append(
            f"{at}: drop {key}= from the <{node.tag}> — a figure carries only "
            'the attributes CATALOG.md lists under "figure-caption", and '
            f"{key}= is not one of them"
        )

    for child in node.children:
        if isinstance(child, str):
            if child.strip() and node.tag not in figure.words:
                fixes.append(
                    f"{at}: put the loose text inside a <{figure.words[0]}> — "
                    "a drawing says a word only there"
                )
            continue
        if child.tag not in figure.tags:
            fixes.append(
                f"{at}: drop the <{child.tag}> — a drawing is built from "
                + ", ".join(f"<{t}>" for t in figure.tags)
                + ", and nothing else crosses this seam"
            )
            continue
        fixes.extend(_drawing(child, at, figure))
    return fixes


def _figure(node, at, figure):
    """One figure: the drawing walked, or the image's one attribute checked.

    WHERE THE FILE IS AND WHAT IS IN IT BELONGS TO `figure-asset`, not here.
    This ruler reads the source, and whether a path resolves is a fact about
    the disk -- keeping them apart is what lets a red say "self-close the
    <img/>" without also guessing at what the file it names might contain.
    """
    if node.tag == figure.imported:
        fixes = [
            f"{at}: drop {key}= from the <{figure.imported}> — an image carries "
            f"{figure.path}= and nothing else"
            for key in sorted(k for k in node.attrs if k.lower() != figure.path)
        ]
        # AN UNCLOSED <img> EATS THE REST OF THE SLIDE. `html.parser` knows no
        # void elements, so `<img src=…>` written open swallows whatever
        # follows it on the slide into itself. The caption it ate is then
        # "missing", and that red fires too -- about a line the author can see
        # in front of them. This one does not replace it; it stands beside it
        # and names the cause, which is the only way that pair is legible.
        if node.children:
            fixes.append(
                f"{at}: self-close the <{figure.imported}/> — written open it "
                "swallows everything after it on the slide"
            )
        return fixes
    return _drawing(node, at, figure, root=True)


# ── the speaker notes (#215) ─────────────────────────────────────────────────
# THE ONE THING IN A SLIDE THAT IS NOT ON THE STAGE. Everything above judges
# text the room reads; a note is read by one person off a panel, so the two
# rules that shape a slot -- the word budget and the pattern's own permission
# to force a line -- have nothing to say about it. What is left is the same
# discipline every other element here keeps: no attributes, no tag outside
# the closed emphasis set, and nothing written that says nothing.

def _notes(el, at):
    fixes = []
    for key in sorted(el.attrs):
        fixes.append(
            f"{at}: drop {key}= from the <{NOTES_TAG}> — it carries no "
            "attribute of its own"
        )
    # `allow_break` IS TRUE HERE WHATEVER THE PATTERN SAYS, and that is not
    # an exception to #211's rule -- it is the rule reaching its own edge. A
    # forced line on the stage is composition, which is why the pattern owns
    # it; a note has no composition to own, and a break in one is punctuation.
    fixes.extend(_emphasis(el, at, NOTES_TAG, allow_break=True))
    if not plain_text(el).strip():
        fixes.append(
            f"{at}: write something in the <{NOTES_TAG}>, or take the tag out "
            "— an empty note is furniture pretending the detail was kept"
        )
    return fixes


def _slide(node, n):
    fixes = []
    at = _at(n, node)

    # THE ALLOWED ATTRIBUTES COME FROM THE PATTERN, WHICH IS WHY THE PATTERN IS
    # READ FIRST (#213). Every pattern but one carries `pattern=` and nothing
    # else; a chart carries the register's own `type=` beside it, because the
    # form is not a slot -- it says what the series is DRAWN as, and there is
    # no text on the stage for it to be.
    known = ", ".join(pattern_names())
    pattern = node.attrs.get("pattern")
    chart = chart_of(pattern) if pattern in PATTERNS else None

    allowed = ("pattern", ARC_ATTR) + ((chart.attribute,) if chart else ())
    carries = " and ".join(f"{k}=" for k in allowed)
    for key in sorted(k for k in node.attrs if k not in allowed):
        fixes.append(
            f"{at}: drop {key}= from the <section> — a section carries "
            f"{carries} and nothing else"
        )

    # THE FUNCTION IN THE ARC, READ BEFORE THE PATTERN IS EVEN KNOWN (#217).
    # The two are independent -- a chart can be the tension or the evidence --
    # so a slide whose pattern is a stranger still owes an answer here, and the
    # two early returns below would swallow the question if it were asked after
    # them. Two fixes for two mistakes is the right count; one fix hiding
    # another is not.
    arcs = ", ".join(ARC_FUNCTIONS)
    arc = node.attrs.get(ARC_ATTR, "").strip()
    if not arc:
        fixes.append(
            f"{at}: give the <section> an {ARC_ATTR}= from the arc: {arcs} — "
            "the pattern says what the slide looks like and never what it is for"
        )
    elif arc not in ARC_FUNCTIONS:
        fixes.append(
            f'{at}: replace the {ARC_ATTR} "{arc}" with one the arc declares: '
            f"{arcs}"
        )

    if not pattern:
        return fixes + [f"{at}: give the <section> a pattern= from the catalog: {known}"]
    if pattern not in PATTERNS:
        return fixes + [
            f'{at}: replace the pattern "{pattern}" with one the catalog '
            f"declares: {known}"
        ]

    form = None
    if chart:
        forms = ", ".join(form_names(pattern))
        written = node.attrs.get(chart.attribute, "").strip()
        if not written:
            fixes.append(
                f"{at}: give the <section> a {chart.attribute}= from the "
                f"catalog: {forms}"
            )
        else:
            form = form_of(pattern, written)
            if form is None:
                fixes.append(
                    f'{at}: replace the {chart.attribute} "{written}" with one '
                    f"the catalog declares: {forms}"
                )

    group = group_of(pattern)
    figure = figure_of(pattern)
    # WHAT THE PATTERN SHOWS BESIDES ITS WORDS, ASKED OF THE REGISTER ONCE. A
    # group, a table and a figure are three shapes of the same thing -- written
    # as a tag of their own rather than as a named `<p>` -- and this used to be
    # an `if group … elif table …` chain that a fourth shape would have grown a
    # third branch in, here and in `build.py` both. `kind` is the word every
    # message below uses, so a red about a missing figure says "figure".
    evidence = evidence_of(pattern)
    kind = evidence.kind if evidence else ""
    tags = evidence.tags if evidence else ()
    named = " or ".join(f"<{t}>" for t in tags)

    seen = []
    evidence_seen = False
    # WRONG TAG IS STILL AN ANSWER, and the difference decides how many reds one
    # mistake costs. A `<ul>` where a figure goes already has a fix naming both
    # halves ("write the figure as <svg> or <img>, not <ul>"); adding "and this
    # slide has none" underneath it is the ruler describing the same mistake
    # twice, which is the shape audit.py refuses everywhere else it counts.
    evidence_tried = False
    notes_seen = False
    for child in node.children:
        if isinstance(child, str):
            if child.strip():
                fixes.append(
                    f"{at}: wrap the loose text in a slot — " + _slot_list(pattern)
                )
            continue

        # THE SAME "A SECOND ONE IS NEVER A SECOND CHANCE" AS THE EVIDENCE
        # BELOW (#212's own lesson, one shape over): `build.py` takes the
        # first `<notes>` it finds and would drop the rest without a word.
        if child.tag == NOTES_TAG:
            if notes_seen:
                fixes.append(
                    f"{at}: keep one <{NOTES_TAG}> — a slide has one set of "
                    "speaker notes, and a second one is a note nobody reads"
                )
                continue
            notes_seen = True
            fixes.extend(_notes(child, at))
            continue

        if child.tag in EVIDENCE_TAGS:
            evidence_tried = True
            if child.tag in tags:
                # A SECOND CONTAINER IS NEVER A SECOND CHANCE. Every pattern
                # that carries evidence carries exactly one -- `build.py`'s
                # `slide_markup` picks the LAST one it sees and drops the
                # rest silently, which is exactly the class of defect this
                # ruler exists to catch before it reaches the page.
                if evidence_seen:
                    fixes.append(
                        f'{at}: keep one {kind} — the pattern "{pattern}" '
                        "carries one, not two"
                    )
                    continue
                evidence_seen = True
                if figure:
                    fixes.extend(_figure(child, at, figure))
                elif group:
                    fixes.extend(
                        _group(child, at, pattern, group, form, drawn=bool(chart))
                    )
                else:
                    fixes.extend(_table(child, at, pattern))
                continue
            if tags:
                fixes.append(
                    f"{at}: write the {kind} as {named}, not <{child.tag}> — "
                    f'the pattern "{pattern}" needs its evidence there'
                )
            else:
                fixes.append(
                    f"{at}: drop the <{child.tag}> — the pattern \"{pattern}\" "
                    "shows nothing besides its words; " + _slot_list(pattern)
                )
            continue

        fixes.extend(_slot(child, at, pattern, seen))

    # A REQUIRED SLOT THAT IS THERE AND EMPTY IS NOT A SLOT THAT IS THERE, and
    # until #213 only the first half of that was measured. `<p class="source">
    # </p>` satisfied every check this ruler made and shipped a chart with no
    # legend under it -- the same hole in every pattern, since a cover with an
    # empty headline or a thesis with an empty sentence pass exactly as easily.
    # The composition each pattern leans on is built out of its REQUIRED slots
    # (the register's own note on the anchor and the horizon), so an empty one
    # is a hole in the layout and not only in the prose.
    said = {}
    for el in node.elements():
        name = el.attrs.get("class", "").strip()
        if el.tag == SLOT_TAG and name:
            said.setdefault(name, plain_text(el).strip())

    for want_slot in PATTERNS[pattern].required:
        if want_slot not in seen:
            fixes.append(
                f'{at}: add the missing <{SLOT_TAG} class="{want_slot}"> — the '
                f'pattern "{pattern}" is not itself without it'
            )
        elif not said.get(want_slot):
            fixes.append(
                f'{at}: write something in the <{SLOT_TAG} class="{want_slot}"> '
                f'— the pattern "{pattern}" requires it, and an empty slot '
                "holds a place on the stage without saying anything in it"
            )
    for name in sorted(set(s for s in seen if seen.count(s) > 1)):
        fixes.append(
            f'{at}: keep one <{SLOT_TAG} class="{name}"> — the pattern '
            f'"{pattern}" declares the slot once'
        )
    if tags and not (evidence_seen or evidence_tried):
        fixes.append(
            f'{at}: add the {kind} — the pattern "{pattern}" needs its '
            f"evidence, written as {named}, and this slide has none"
        )
    return fixes


# ── the art direction, which is the header's second half (#217) ──────────────
# IT READS LIKE A SLIDE ON PURPOSE. A choice is a `<p>` with the choice's name
# in its `class=`, so whoever can write a slot can write the header, and the
# function below is `_slide` with everything a slide has and a header does not
# -- a pattern, evidence, notes, fragments -- taken out, rather than a second
# dialect grown beside the first.
#
# AND IT REPEATS `_slide`'S OPENING CASCADE RATHER THAN SHARING IT, WHICH WAS
# WEIGHED. The two walks look alike -- loose text, a tag that is not `<p>`, an
# attribute nobody declared, two classes on one name -- but every branch differs
# in what it PERMITS: a slot may carry the bare `step` and a choice may not, a
# slide's prose may force a line where its pattern allows it and a header's
# never may, a slide names its slots from a pattern and a header names its
# choices from the register. A shared helper would take four flags to say that,
# and a helper with a flag per caller is two functions wearing one name. The
# duplication that stayed is a shape; the rules underneath it are not shared.
#
# A NAME FROM A CLOSED SET IS HELD TO IT; PROSE IS HELD TO BEING THERE. The
# cover, the scale and the three renunciations name something this register
# knows, and a stranger among them is a direction pointing at nothing. The
# signature, the register of the text and the difference from the canonical
# example are sentences a person wrote, and the only honest thing a compiler can
# ask of a sentence is that it exists.
#
# SIX OF THE TEN CHOICES ARE RECORDED AND NOT MEASURED, WHICH IS NOT THE SAME AS
# FORGOTTEN. A direction is a record of decisions; four of them happen to leave a
# mark a machine can find in the slides -- how many peaks, which colours, which
# shapes were given up, and that the deck ends by asking -- and those four have
# rulers below. The cover, the signature and the register of the text leave no
# such mark: a ruler for "the signature really does repeat" would be measuring
# taste, which is what the contact sheet and a pair of eyes are for.
#
# THE DIFFERENCE WAS THE ONE THAT WAS MERELY EARLY, AND IT IS NO LONGER EARLY.
# #207 asks the direction to declare "em que difere do exemplo canônico da
# skill", and until #219 there was no canonical example to differ FROM: holding a
# deck against a fixture nobody had named would have been a ruler measuring the
# corpus instead of a defect. #219 named it -- `examples/canonical.deck.html`,
# and `SKILL.md` and `CATALOG.md` both say so -- so the precondition this note
# was waiting on is met, and what is missing now is the ruler rather than its
# subject.
#
# IT IS STILL NOT WRITTEN HERE, AND THE REASON IS SCOPE AND NOT DOUBT. #219's own
# acceptance is about the corpus (coverage, synthetic text, weight, one command
# that regenerates); enforcing #207's story 46 ("obrigada a diferir do exemplo
# canônico em capa e assinatura") is a ruler with its own plant and its own
# entry in the reference, and landing it inside a movimento-de-terra would put
# two decisions under one squash. It has a ticket of its own:
# https://github.com/ThiagoPanini/panlabs-skills/issues/233 -- and this note is
# the one place a reader of `_direction` finds out that the gap is known, which
# is the difference between a deferral and an omission.
#
# WHAT THE RULER CAN AND CANNOT ASK, for whoever writes it: `cover` is drawn
# from a closed set and compares exactly; `signature` is a sentence, and the
# only honest comparison is against the canonical's own words, which catches the
# deck that COPIED the example and not the one that reworded it. That is the
# real failure mode -- #207 asks for this so decks stop converging on the
# composition the example demonstrates -- and it is why the canonical's own
# `difference` line names its cover and its signature instead of saying it has
# none.

def _direction(node):
    """The art-direction block: every choice the register declares, and no more."""
    at = f"the <{DIRECTION_TAG}> (line {node.line})"
    known = ", ".join(choice_names())
    fixes = []

    for key in sorted(node.attrs):
        fixes.append(
            f"{at}: drop {key}= from the <{DIRECTION_TAG}> — the art direction "
            "is written as choices inside it, never as attributes on it"
        )

    seen = []
    for child in node.children:
        if isinstance(child, str):
            if child.strip():
                fixes.append(
                    f"{at}: wrap the loose text in a choice — the "
                    f"<{DIRECTION_TAG}> declares {known}"
                )
            continue
        if child.tag != SLOT_TAG:
            fixes.append(
                f"{at}: write the choice as <{SLOT_TAG}>, not <{child.tag}> — "
                "every line of the art direction is a paragraph, the same as a "
                "slot"
            )
            continue
        for key in sorted(k for k in child.attrs if k != "class"):
            fixes.append(
                f"{at}: drop {key}= from the <{SLOT_TAG}> — a choice carries "
                "class= and nothing else"
            )
        classes = child.attrs.get("class", "").split()
        if not classes:
            fixes.append(
                f"{at}: name the <{SLOT_TAG}> with a class — the "
                f"<{DIRECTION_TAG}> declares {known}"
            )
            continue
        if len(classes) > 1:
            fixes.append(
                f"{at}: keep one class on the <{SLOT_TAG}> — a choice has one "
                f'name, and "{" ".join(classes)}" is {len(classes)}'
            )
        for name in classes:
            if choice_of(name):
                seen.append(name)
            else:
                fixes.append(
                    f'{at}: drop the class "{name}" — the <{DIRECTION_TAG}> '
                    f"declares {known}"
                )
        fixes.extend(_emphasis(child, at, classes[0], allow_break=False))

    said = texts_of(node)
    for name in DIRECTION_REQUIRED:
        if name not in seen:
            fixes.append(
                f'{at}: add the missing <{SLOT_TAG} class="{name}"> — '
                f"{choice_of(name).purpose}"
            )
        elif not said.get(name):
            fixes.append(
                f'{at}: write something in the <{SLOT_TAG} class="{name}"> — '
                "a choice left blank is a choice nobody made"
            )
    for name in sorted(set(s for s in seen if seen.count(s) > 1)):
        fixes.append(
            f'{at}: keep one <{SLOT_TAG} class="{name}"> — the '
            f"<{DIRECTION_TAG}> declares the choice once"
        )

    # A NAME DRAWN FROM A CLOSED SET, HELD TO IT. `Choice.options` is empty for
    # the three prose choices, so this loop costs them nothing and a choice
    # added later never has to opt out.
    for name in sorted(set(seen)):
        choice = choice_of(name)
        value = said.get(name, "")
        if not choice or not choice.options or not value:
            continue
        if value not in choice.options:
            fixes.append(
                f'{at}: replace "{value}" in the <{SLOT_TAG} class="{name}"> '
                "with one of: " + ", ".join(choice.options)
            )

    # AND THE THREE WAYS THE DIRECTION CAN CONTRADICT ITSELF. Three renunciations
    # that name the same pattern are one renunciation written three times; a deck
    # that renounces the cover it declared has given up the slide it opens on;
    # and a deck that renounces the closing has given up the slide the doctrine
    # requires. None of the three is visible to any ruler reading the SLIDES --
    # and the third is worse than incoherent, it is UNSATISFIABLE: `_arc_closing`
    # demands a closing at the end and `_renounced_pattern` refuses the very same
    # slide, so the build has two reds and no source can answer both. A refusal
    # whose fix does not exist is the one shape of red this file must never
    # print, so it is caught here, where the fix is one word in the header.
    given_up = [said.get(n, "") for n in RENOUNCE_CHOICES]
    for name in sorted({p for p in given_up if p and given_up.count(p) > 1}):
        fixes.append(
            f'{at}: renounce something other than "{name}" in one of '
            + ", ".join(RENOUNCE_CHOICES)
            + " — the three are three, and the same name written twice gives up "
            "one shape and calls it two"
        )
    cover = said.get(COVER_CHOICE, "")
    if cover and cover in given_up:
        fixes.append(
            f'{at}: stop renouncing "{cover}" — it is the cover this direction '
            "declared, and a deck cannot open on a pattern it gave up"
        )
    for name in sorted(set(given_up) & set(closings())):
        fixes.append(
            f'{at}: stop renouncing "{name}" — every deck ends on a closing, so '
            "a deck that gives that shape up is a deck no source can satisfy"
        )
    return fixes


def _vocabulary(deck, theme):
    fixes = []
    n = 0
    header = False
    for index, node in enumerate(deck.children):
        if node.tag == DIRECTION_TAG:
            if header:
                fixes.append(
                    f"line {node.line}: keep one <{DIRECTION_TAG}> — a deck has "
                    "one art direction, and a second one is a second deck"
                )
                continue
            header = True
            if index:
                fixes.append(
                    f"line {node.line}: move the <{DIRECTION_TAG}> to the top of "
                    "the <deck> — it is the header's second half, and a header "
                    "written after the slides is a header nobody read"
                )
            fixes.extend(_direction(node))
            continue
        if node.tag != "section":
            fixes.append(
                f"line {node.line}: drop the <{node.tag}> — a deck holds one "
                f"<{DIRECTION_TAG}> and its <section>s, and nothing else"
            )
            continue
        n += 1
        fixes.extend(_slide(node, n))
    if not header:
        fixes.append(
            f"add a <{DIRECTION_TAG}> as the first child of the <deck>, carrying "
            + ", ".join(DIRECTION_REQUIRED)
            + " — a deck with no art direction is a deck whose form nobody chose"
        )
    return fixes


# ── the doctrine ─────────────────────────────────────────────────────────────
# The ones below read a source the compiler could build and refuse it anyway,
# because what they measure is what the v1 shipped green and lost the room
# with. Each one skips a slide whose pattern the catalog does not know: the
# vocabulary ruler has already named that, and a second red about a stranger
# pattern is noise on top of the fix.

def _word_budget(deck, theme):
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        ceiling = budget_of(pattern)
        if ceiling is None:
            continue
        # AN ICON IS READ, NEVER SAID. Its slot's text is a Lucide name --
        # furniture the compiler consumes, not a word the room hears -- so it
        # is left out of the same total a cover's meta line is spent from.
        #
        # AND A NOTE IS SAID, NEVER READ (#215). The budget counts what the
        # room reads off the stage; #207's own rule is that what does not fit
        # goes to the notes and nothing is lost, so a budget that also counted
        # the notes would price the fix at the same rate as the defect.
        spent = sum(
            _words(plain_text(el)) for el in node.elements()
            if el.tag != NOTES_TAG and role_of_element(pattern, el) != ICON
        )
        if spent > ceiling:
            fixes.append(
                f"{_at(n, node)}: cut the slide to {ceiling} words "
                f'— the pattern "{pattern}" budgets {ceiling} and this one spends '
                f"{spent}; what does not fit is what you say out loud"
            )
    return fixes


def _category_title(deck, theme):
    # THE CLAIM SLOTS AND NOTHING ELSE. A section divider's title carries the
    # role NAME, not CLAIM, because naming the next section "Contexto" is the
    # divider doing its job -- and "contexto" is both a refused title and the
    # first act of the arc #207 prescribes. The register draws that line; this
    # ruler only reads it.
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        claims = claims_of(node.attrs.get("pattern", ""))
        for el in node.elements():
            slot = el.attrs.get("class", "").strip()
            if slot not in claims:
                continue
            said = plain_text(el)
            if _bare(said) in CATEGORIES:
                fixes.append(
                    f'{_at(n, node)}, slot "{slot}": rewrite '
                    f'"{said}" as a claim with a verb or a number — a category '
                    "names the folder, and the page number already says where "
                    "the room is"
                )
    return fixes


def _repeated_pattern(deck, theme):
    # WHAT REPEATS IS THE SHAPE, AND FOR A CHART THE SHAPE IS THE FORM (#213).
    # A bar chart followed by a line is not a slide that failed to advance --
    # the room sees a different picture, which is the whole of what this ruler
    # was ever measuring. A bar chart followed by another bar chart is, and
    # still goes red.
    #
    # THIS IS NOT A LOOSENING; IT KEEPS THE RULER INVARIANT UNDER THE
    # PACKAGING. #207 says "não repetir padrão em slides consecutivos" and it
    # also chose to carry all six chart forms as ONE of its eighteen patterns
    # ("gráfico com título-tese"). Had the six been six patterns instead, a bar
    # beside a line would have passed this ruler without anybody calling it a
    # weakening -- so reading `pattern=` alone would make the ruler's verdict
    # depend on how the catalogue happens to be packaged rather than on what is
    # on the stage. Comparing the shape is what makes the two packagings agree.
    fixes = []
    before = None
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        chart = chart_of(pattern)
        form = node.attrs.get(chart.attribute, "").strip() if chart else ""
        shape = (pattern, form)
        if pattern and shape == before:
            said, word = ((form, chart.attribute) if chart and form
                          else (pattern, "pattern"))
            fixes.append(
                f"{_at(n, node)}: give this slide another {word} "
                f'— "{said}" already ran on slide {n - 1}, and two slides in '
                "the same shape read as one that failed to advance"
            )
        before = shape
    return fixes


def _icon_known(deck, theme):
    # A NAME THE VENDORED SET DOES NOT CARRY IS STATIC, same as every other
    # doctrine ruler here: the source already says the name, and no render is
    # needed to know it is not one of the 1764 `themes/base/icons/` ships.
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        for el in node.elements():
            if role_of_element(pattern, el) != ICON:
                continue
            slot = el.attrs.get("class", "").strip()
            name = plain_text(el)
            if name and not icons.known(name):
                fixes.append(
                    f'{_at(n, node)}, slot "{slot}": replace the icon "{name}" '
                    "with one from themes/base/icons/lucide-icon-nodes.json — "
                    "the vendored Lucide set has no icon by that name"
                )
    return fixes


def _icon_paired(deck, theme):
    # THE REGISTER NAMES THE PAIR, THIS RULER ONLY READS IT. `Slot.pairs_with`
    # is declared once per icon slot in catalog.py (#211's "um ícone por
    # item"); a pattern with no paired slots costs this ruler nothing, so a
    # future pattern never has to opt out.
    #
    # AND "TOGETHER" IS ALSO A MOMENT, NOT ONLY A PRESENCE (#215). A pair
    # where one half carries `step` and the other does not is a pair written
    # in full and painted in halves: the text arrives with a hole where its
    # icon goes, or the icon floats beside nothing. That is the same defect
    # this ruler's headline already names, read at the beat rather than at
    # the build -- so it goes red here rather than in a second ruler saying
    # the same sentence about the same two slots.
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        written = {}
        for el in node.elements():
            written.setdefault(el.attrs.get("class", "").strip(), el)
        for slot in slot_specs(pattern):
            if not slot.pairs_with:
                continue
            here, there = slot.name in written, slot.pairs_with in written
            if here != there:
                missing = slot.pairs_with if here else slot.name
                fixes.append(
                    f'{_at(n, node)}: add the missing <p class="{missing}"> — '
                    f'"{slot.name}" and "{slot.pairs_with}" travel together, '
                    "never one without the other"
                )
                continue
            if not here:
                continue
            stepped = STEP_ATTR in written[slot.name].attrs
            pair_stepped = STEP_ATTR in written[slot.pairs_with].attrs
            if stepped != pair_stepped:
                late = slot.pairs_with if stepped else slot.name
                fixes.append(
                    f'{_at(n, node)}: mark <p class="{late}"> with `{STEP_ATTR}` '
                    f'too, or take it off <p class="{slot.name if stepped else slot.pairs_with}"> '
                    f'— "{slot.name}" and "{slot.pairs_with}" arrive on the same '
                    "beat or on none"
                )
    return fixes


# ── the chart ────────────────────────────────────────────────────────────────
# THE THREE BELOW READ NUMBERS, WHICH NO OTHER RULER IN THIS FILE DOES. Every
# ruler above measures WORDS -- how many, which shape, whether a name is in a
# register. A chart is the first thing this dialect carries whose defect is
# arithmetic, and #94 measured that this is exactly where a hand goes wrong:
# the markup always renders, and what is false is the sum, the unit, or a
# label that has no room. None of the three is visible to the eye at speed and
# none is visible to a markup validator at all.

def _chart_of_slide(node):
    """A chart slide as (chart, form, points), or three Nones for anything else.

    IT ANSWERS NOTHING FOR EVERY SHAPE THE VOCABULARY RULER ALREADY NAMED. A
    stranger pattern, a form nobody declared, a missing `<ul>` -- each already
    has a red that says what to do, and a second red from down here would be
    noise stacked on the fix.
    """
    pattern = node.attrs.get("pattern", "")
    chart, group = chart_of(pattern), group_of(pattern)
    if not (chart and group):
        return None, None, None
    form = form_of(pattern, node.attrs.get(chart.attribute, "").strip())
    container = next((el for el in node.elements() if el.tag == group.container), None)
    if form is None or container is None:
        return None, None, None
    return chart, form, charts.series(container, group)


# A minus sign, in either of the two characters a keyboard and a word
# processor produce for it.
NEGATIVE = ("-", "−")

# The date a source line has to carry. A year is the whole of it: "post-mortems
# · 2026" and "IBGE, Censo 2022" both date a number well enough for a room to
# ask how old it is, and demanding a full date would refuse the way every real
# source is actually cited.
DATED = re.compile(r"(19|20)\d{2}")


def _chart_data(deck, theme):
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        chart, form, points = _chart_of_slide(node)
        if not points:
            continue
        at = _at(n, node)

        for p in points:
            # AN EMPTY FIELD IS NAMED BY THE VOCABULARY RULER, which refuses a
            # required field that is present and says nothing (`_group`). One
            # red per defect: saying "and it is not a number either" on top of
            # that would be this ruler describing the same emptiness twice.
            if not p.said:
                continue
            if p.value is not None:
                continue
            if p.said.lstrip().startswith(NEGATIVE):
                fixes.append(
                    f'{at}: write the value of "{p.label}" as a positive number '
                    f'— "{p.said}" falls below the axis, and no form here draws '
                    "a mark under one"
                )
            else:
                fixes.append(
                    f'{at}: write the value of "{p.label}" as digits with at most '
                    f'one comma, not "{p.said}" — the unit belongs in the unit '
                    "slot, and the number is drawn exactly as it is written"
                )

        good = [p.value for p in points if p.value is not None]
        if len(good) == len(points):
            if not any(good):
                fixes.append(
                    f"{at}: give the series a value above zero — every point is "
                    "zero, and a chart of zeroes draws a flat nothing"
                )
            elif form.proportion and sum(good) != Decimal(chart.total):
                said = format(sum(good).normalize(), "f").replace(".", ",")
                fixes.append(
                    f"{at}: make the values add up to {chart.total} — they add "
                    f"up to {said}, and a share that does not total "
                    f"{chart.total} is a share of something else"
                )

        if form.proportion:
            for p in points:
                if p.marked:
                    fixes.append(
                        f"{at}: drop `mark` from the <li> — a share paints one "
                        "colour per slice, and marking one would break the map "
                        "between a colour and the name beside it"
                    )
                    break
    return fixes


def _chart_source(deck, theme):
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        _, _, points = _chart_of_slide(node)
        if not points:
            continue
        for el in node.elements():
            if el.attrs.get("class", "").strip() != "source":
                continue
            said = plain_text(el)
            if said and not DATED.search(said):
                fixes.append(
                    f'{_at(n, node)}, slot "source": add the year the data is '
                    f'from to "{said}" — a number the room cannot date is a '
                    "number it cannot check"
                )
    return fixes


def _chart_fit(deck, theme):
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        _, form, points = _chart_of_slide(node)
        if not points:
            continue
        for kind, said, ceiling in charts.overlong(form.name, points):
            elsewhere = (
                ', or draw the series as "bars-h", where every label has a '
                "column of its own"
                if kind == "label" and form.name != "bars-h" else ""
            )
            fixes.append(
                f'{_at(n, node)}: shorten the {kind} "{said}" to {ceiling} '
                f'characters — the "{form.name}" form gives it that much room, '
                f"and a drawing neither wraps a label nor says it could not"
                + elsewhere
            )
    return fixes


# ── the figure ───────────────────────────────────────────────────────────────
# THE TWO BELOW MEASURE THE ONE SLOT THE CATALOG DOES NOT LIMIT (#214), and
# each measures the half of it that the vocabulary ruler structurally cannot.
# `fill=` is a legal attribute, so a hexadecimal inside one is a VALUE nobody
# else weighs; a `src=` is a legal attribute, so a path that moved is a fact
# about the DISK nobody else can see. Both defects build, render and ship: the
# first as a figure wearing `base` in every theme, the second as the blank
# rectangle #207 calls a "retrato vazio".

def _figures_of_slide(node):
    """The (figure, element) pairs on one slide, or nothing for every other one.

    A slide whose pattern carries no figure yields nothing at all, which is
    what keeps the two rulers below silent about the seventeen patterns they
    have no business reading. Everything a figure pattern DOES carry is
    yielded, the second figure on an already-red slide included: a colour
    written into a drawing is a defect whether or not the slide also has two
    drawings, and a ruler that went quiet because a neighbour fired would hide
    it until the neighbour was fixed.
    """
    figure = figure_of(node.attrs.get("pattern", ""))
    if not figure:
        return
    for el in node.elements():
        if el.tag in (figure.drawn, figure.imported):
            yield figure, el


def _figure_paint(deck, theme):
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        for figure, el in _figures_of_slide(node):
            if el.tag != figure.drawn:
                continue
            for tag, key, said in figures.paints(el, figure):
                value = said.strip()
                if value == figure.unpainted or figures.token(value) in figure.tokens:
                    continue
                fixes.append(
                    f"{_at(n, node)}: repaint the {key} of the <{tag}> as "
                    f'"{figure.unpainted}" or one of the theme\'s own tokens, '
                    f'not "{said}" — the tokens are '
                    + ", ".join(figure.tokens)
                    + ", and a colour written into a drawing is a drawing that "
                    "wears base in every theme there will ever be"
                )
    return fixes


def _figure_asset(deck, theme):
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        for figure, el in _figures_of_slide(node):
            if el.tag != figure.imported:
                continue
            said = figures.attribute(el, figure.path)
            resolved = figures.resolve(said, deck.base, figure)
            if resolved.fix:
                fixes.append(f"{_at(n, node)}: {resolved.fix}")
    return fixes


def _theme_repertoire(deck, theme):
    """Every character on the stage, held against what the theme can paint.

    A THEME THAT SHIPS NO FACES MAKES NO PROMISE, and this ruler stays quiet
    for it. `base` paints with `system-ui` and its neighbours -- what those
    cover is a fact about the machine the deck is opened on, not about the
    theme, and charging a repertoire nobody declared would be inventing the
    subject. `fonts.repertoire()` answers None for exactly that case.

    WHY IT IS A RULER AT ALL. A subsetter drops in silence whatever the source
    face did not have (#91 measured this: of 150 characters asked for, one
    face delivered 149 and another 144), so an author who writes `→` in a
    theme whose faces stop at `↑ ↓` gets the system's fallback glyph -- a
    different face, mid-sentence, with no error anywhere and no network to
    blame. The refusal names the character and its code point, because a
    dash-like thing that is the wrong dash-like thing is invisible in a diff.

    AN ICON SLOT IS NOT READ. Its text is a Lucide name the compiler consumes
    into a `<symbol>`; nothing of it reaches the stage. Every other slot does,
    the notes included -- a note is painted in the theme's own faces the
    moment the presenter opens the panel, and a tofu there is a tofu the room
    never sees and the presenter always does.
    """
    covers = fonts.repertoire(theme)
    if not covers:
        return []
    have = set(covers)
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        for el in node.elements():
            if role_of_element(pattern, el) == ICON:
                continue
            missing = sorted(
                {c for c in plain_text(el) if c not in have and not c.isspace()},
                key=ord,
            )
            if not missing:
                continue
            where = el.attrs.get("class", "").strip()
            said = f'slot "{where}"' if where else f"<{el.tag}>"
            spelled = ", ".join(f'"{c}" (U+{ord(c):04X})' for c in missing)
            fixes.append(
                f"{_at(n, node)}, {said}: rewrite {spelled} with a character the "
                f'theme "{theme}" carries — its faces are cut to a repertoire, '
                "and what is outside it paints in whatever face the machine "
                "falls back to"
            )
    return fixes


# ── the direction, read back against the slides (#217) ───────────────────────
# THE FOUR BELOW ARE THE ONLY RULERS HERE THAT READ TWO PLACES AT ONCE. Every
# other one weighs a slide against the CATALOG, which is the same for every deck;
# these weigh a slide against a promise THIS deck made about itself in its own
# header -- how many peaks it would hold, which colours mean something, which
# shapes it gave up, and that it would end by asking for something.
#
# ALL FOUR GO QUIET WITHOUT A DIRECTION. `_vocabulary` has already said the
# header is missing, and four more reds about promises nobody made would bury
# the one fix that produces them all. Same rule the doctrine rulers keep for a
# pattern the catalog never heard of.


def _direction_said(deck):
    """What the deck's own art direction declared, by choice name.

    None -- not an empty dict -- when there is no direction to read: the four
    rulers below have to tell "the header is missing" (say nothing, the
    vocabulary ruler has it) from "the header is there and this choice is
    blank" (which is that ruler's business too, but not silently).
    """
    node = deck.direction
    return texts_of(node) if node is not None else None


def _is_moment(node):
    """Whether this slide is one of the deck's moments (#217).

    A DRAWING IS A MOMENT AND A PHOTOGRAPH IS NOT, which is the one half of
    #207's definition the register cannot settle on its own: "figura desenhada"
    is a fact about what this slide holds, not about the pattern it uses.
    Everything else -- a chart, a full-bleed statement -- is settled by
    `Pattern.moment` and needs no reading at all.
    """
    pattern = node.attrs.get("pattern", "")
    if not moment_of(pattern):
        return False
    figure = figure_of(pattern)
    if not figure:
        return True
    return any(el.tag == figure.drawn for el in node.elements())


def moments_of(deck):
    """Which slides, by number, are the deck's moments.

    PUBLIC BECAUSE THE STORYBOARD MARKS WHAT THIS RULER COUNTS.
    `compiler/storyboard.py` prints a peak beside the slide that is one, and the
    ruler below holds the count against the declared scale -- the two disagreeing
    about how many a deck holds is the exact two-ended contract this skill
    refuses everywhere else, so there is one answer and both ask for it.
    """
    return [n for n, node in enumerate(deck.sections, start=1) if _is_moment(node)]


def _moment_scale(deck, theme):
    said = _direction_said(deck)
    if said is None:
        return []
    scale = scale_of(said.get(MOMENTS_CHOICE, ""))
    if scale is None:
        return []
    # ENGLISH, AND NOT `Scale.span`. That property is the Portuguese the
    # reference and the storyboard publish for a person to read; this is a fix
    # the compiler PRINTS, and CLAUDE.md's seam runs between the two. The
    # register is still the only place the numbers live.
    span = (f"{scale.minimum} to {scale.maximum}" if scale.maximum is not None
            else f"{scale.minimum} or more")

    peaks = moments_of(deck)
    count = len(peaks)
    fixes = []
    if count < scale.minimum or (scale.maximum is not None and count > scale.maximum):
        where = ("slides " + ", ".join(str(n) for n in peaks) if count
                 else "no slide is one")
        # THE SCALE THAT WOULD FIT, WHEN THERE IS ONE. Both halves of this fix
        # are real -- cut the peaks, or admit the deck is the size it is -- and
        # naming the second one costs a lookup. There is no scale for zero, and
        # that is the register's answer rather than a gap: a deck with no peak
        # has nothing to be sober about.
        fits = next(
            (s.name for s in MOMENT_SCALES
             if s.minimum <= count and (s.maximum is None or count <= s.maximum)),
            None,
        )
        instead = (f'declare "{fits}"' if fits
                   else "give the deck a moment — no scale admits none")
        fixes.append(
            f"bring the deck to {span} moments, or {instead} in "
            f'<{SLOT_TAG} class="{MOMENTS_CHOICE}"> — the direction says '
            f'"{scale.name}" ({span}) and the deck holds {count} ({where}); a '
            "moment is a drawn figure, a chart or a full-bleed statement"
        )
    if scale.motion and deck.header.get("motion", "").strip() != scale.motion:
        fixes.append(
            f'write motion="{scale.motion}" on the <deck>, or declare a smaller '
            f'scale in <{SLOT_TAG} class="{MOMENTS_CHOICE}"> — a deck with that '
            f"many peaks has assumed the stage, and only the {scale.motion} "
            "profile carries them"
        )
    return fixes


def _colour_semantics(deck, theme):
    """Every content colour a slide spends, held to a meaning the header gave it.

    A COLOUR IS SPENT TWO WAYS, AND BOTH COUNT. A drawing is the one place an
    author writes a colour by hand, and `figures.paints` reads it back off the
    element -- that half is exact, down to the attribute. A CHART spends colour
    without anybody typing one: `compiler/stage.html` draws its marks, its line,
    its area and its slices out of the two the theme lends, and the room sees
    them exactly as it sees a figure's. `Chart.content` is where the register
    says which, and it says both rather than which-form-reaches-which, for the
    reason written beside it.

    LEAVING THE CHART OUT WAS THE FIRST CUT AT THIS, AND IT WAS WRONG. It made
    the ruler exact and made the promise empty: a deck of six charts spends both
    colours across every slide, declares neither, and would have gone green on
    the pattern #207's own user story ("a mesma cor marque a mesma coisa do
    começo ao fim, para ler o deck pela cor sem legenda") is most about.
    """
    said = _direction_said(deck)
    if said is None:
        return []
    # THE TOKEN COMES FROM THE REGISTER, NOT FROM THE CLASS NAME. `Choice.token`
    # is the one place the two are tied together, so a renamed token is a change
    # in one file rather than a string this ruler pastes "--" in front of.
    lent = {choice_of(n).token: choice_of(n) for n in COLOUR_CHOICES}

    # ONE RED PER COLOUR, NAMING THE FIRST SLIDE THAT SPENDS IT. The fix is a
    # single line in the header whatever the count, and a figure that paints
    # eight strokes in the same undeclared colour is one mistake, not eight.
    fixes = []
    told = set()

    def charge(n, node, token, instead):
        """One red per colour, naming the first slide that spends it.

        The fix is a single line in the header whatever the count, so a drawing
        that paints eight strokes in the same undeclared colour is one mistake
        and not eight -- and a deck of six charts spending the same two is two.
        """
        choice = lent.get(token)
        if choice is None or said.get(choice.name) or choice.token in told:
            return
        told.add(choice.token)
        fixes.append(
            f'{_at(n, node)}: say what {choice.token} means in this deck, with a '
            f'<{SLOT_TAG} class="{choice.name}"> in the <{DIRECTION_TAG}>, or '
            f"{instead} — the theme lends two content colours and the direction "
            "is where each one is given its meaning, once, for the whole deck"
        )

    for n, node in enumerate(deck.sections, start=1):
        for figure, el in _figures_of_slide(node):
            if el.tag != figure.drawn:
                continue
            for tag, key, value in figures.paints(el, figure):
                charge(n, node, figures.token(value.strip()),
                       f"repaint the {key} of the <{tag}>")
        chart = chart_of(node.attrs.get("pattern", ""))
        if chart:
            for token in chart.content:
                charge(n, node, token, "draw this slide some other way")
    return fixes


def _renounced_pattern(deck, theme):
    said = _direction_said(deck)
    if said is None:
        return []
    given_up = {}
    for name in RENOUNCE_CHOICES:
        pattern = said.get(name, "")
        if pattern in PATTERNS:
            given_up.setdefault(pattern, name)

    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        if pattern in given_up:
            fixes.append(
                f'{_at(n, node)}: give this slide another pattern, or stop '
                f'renouncing "{pattern}" in <{SLOT_TAG} '
                f'class="{given_up[pattern]}"> — a renunciation the deck walks '
                "back is a renunciation that decided nothing"
            )
    return fixes


def _arc_closing(deck, theme):
    """#207's mandatory closing, and the one slide whose function is fixed.

    A DECK THAT STOPS IS NOT A DECK THAT CLOSED. Every other slide is free to
    take any function of the arc; the last one is the ask, and a deck that runs
    out of slides instead of arriving at one leaves the room without knowing what
    is expected of it -- which is #207's own user story for the closing.

    AND A CLOSING IN THE MIDDLE IS THE SAME DEFECT SEEN FROM THE OTHER SIDE. A
    deck that asks for something and then keeps talking has not closed either --
    it has buried its ask. The ruler names it as a third fix rather than a fourth
    ruler, because all three are the same sentence about the same slide.
    """
    slides = deck.sections
    if not slides:
        return []
    ends = closings()
    named = " or ".join(f'"{c}"' for c in ends)
    total = len(slides)
    last = slides[-1]

    fixes = []
    for n, node in enumerate(slides[:-1], start=1):
        if node.attrs.get("pattern", "") in ends:
            fixes.append(
                f"{_at(n, node)}: move this closing to the end of the deck, or "
                f"give it another pattern — it asks the room for something and "
                f"then {total - n} more slide(s) keep talking"
            )
    if last.attrs.get("pattern", "") not in ends:
        return fixes + [
            f"{_at(total, last)}: end the deck on a {named} slide — a deck that "
            "stops without coming back to its thesis and asking for something "
            "leaves the room not knowing what is expected of it"
        ]
    arc = last.attrs.get(ARC_ATTR, "").strip()
    if arc != ARC_CALL:
        # THE SLIDE THAT SAYS NOTHING AND THE SLIDE THAT SAYS THE WRONG THING GET
        # THE SAME FIX, and the tail is what keeps the message from reading
        # broken in the first case. The vocabulary ruler names a missing `arc=`
        # too, and it names it in general; this one names the value the LAST
        # slide in particular has to carry, which is a second fact and not a
        # second copy.
        saying = f'"{arc}"' if arc else "nothing"
        fixes.append(
            f'{_at(total, last)}: write {ARC_ATTR}="{ARC_CALL}" on the closing — '
            f"the last slide of a deck is the ask, and this one says {saying}"
        )
    return fixes


# APPEND AT THE END. The order is the order the report prints, and the report
# is read top to bottom by whoever is fixing a deck: the dialect first,
# because a source that does not parse into slides has nothing for the
# doctrine to measure, then the ones that judge what the slides say.
#
# EVERY RULER IS CALLED WITH THE DECK AND THE THEME, and most of them do not
# read the second (#216). One registry with one signature is what lets a new
# ruler that DOES need the theme be appended rather than plumbed: the
# alternative -- a second registry, or a ruler wrapped in a closure at the
# call site -- puts the report's order in two places, which is where an
# append-only list stops being one.
RULERS = (
    (VOCABULARY, _vocabulary),
    (WORD_BUDGET, _word_budget),
    (CATEGORY_TITLE, _category_title),
    (REPEATED_PATTERN, _repeated_pattern),
    (ICON_KNOWN, _icon_known),
    (ICON_PAIRED, _icon_paired),
    (CHART_DATA, _chart_data),
    (CHART_SOURCE, _chart_source),
    (CHART_FIT, _chart_fit),
    (FIGURE_PAINT, _figure_paint),
    (FIGURE_ASSET, _figure_asset),
    (THEME_REPERTOIRE, _theme_repertoire),
    (MOMENT_SCALE, _moment_scale),
    (COLOUR_SEMANTICS, _colour_semantics),
    (RENOUNCED_PATTERN, _renounced_pattern),
    (ARC_CLOSING, _arc_closing),
)


def audit(deck, theme):
    """Every ruler over one deck in one theme, in a stable order."""
    return [Verdict(ruler, measure(deck, theme)) for ruler, measure in RULERS]


def report(deck, theme, verdicts):
    """The audit, as the build command prints it."""
    slides = len(deck.sections)
    plural = "slide" if slides == 1 else "slides"
    lines = [f'── audit · "{deck.title}" · theme {theme} · {slides} {plural}']
    for v in verdicts:
        lines.append(f"   {'✓' if v.ok else '✗'} {v.ruler.name} · {v.ruler.headline}")
        for fix in v.fixes:
            lines.append(f"       | {fix}")

    reds = sum(1 for v in verdicts if not v.ok)
    total = f"{len(verdicts)} ruler" + ("" if len(verdicts) == 1 else "s")
    lines.append(
        f"   {total}, {reds} red — nothing was written" if reds
        else f"   {total}, green"
    )
    return "\n".join(lines)
