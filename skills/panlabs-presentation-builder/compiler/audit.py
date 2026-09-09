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
import icons
from catalog import (BREAK_TAG, CATEGORY_TITLES, EVIDENCE_TAGS, ICON,
                     INLINE_TAGS, PATTERNS, SLOT_TAG, TABLE_MAX_ROWS,
                     allow_break_of, budget_of, chart_of, claims_of,
                     evidence_of, figure_of, form_names, form_of, group_of,
                     pattern_names, role_of_element, slot_specs, slots_of)
from source import fields_of, plain_text


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
    fixes = []
    if el.tag != SLOT_TAG:
        return [
            f"{at}: write the slot as <{SLOT_TAG}>, not <{el.tag}> — every "
            "text slot in this dialect is a paragraph"
        ]

    for key in sorted(k for k in el.attrs if k != "class"):
        fixes.append(
            f"{at}: drop {key}= from the <{SLOT_TAG}> — a slot carries "
            "class= and nothing else"
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

    allowed = ("pattern",) + ((chart.attribute,) if chart else ())
    carries = " and ".join(f"{k}=" for k in allowed)
    for key in sorted(k for k in node.attrs if k not in allowed):
        fixes.append(
            f"{at}: drop {key}= from the <section> — a section carries "
            f"{carries} and nothing else"
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
    for child in node.children:
        if isinstance(child, str):
            if child.strip():
                fixes.append(
                    f"{at}: wrap the loose text in a slot — " + _slot_list(pattern)
                )
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


def _vocabulary(deck):
    fixes = []
    n = 0
    for node in deck.children:
        if node.tag != "section":
            fixes.append(
                f"line {node.line}: drop the <{node.tag}> — a deck holds "
                "<section> and nothing else"
            )
            continue
        n += 1
        fixes.extend(_slide(node, n))
    return fixes


# ── the doctrine ─────────────────────────────────────────────────────────────
# The ones below read a source the compiler could build and refuse it anyway,
# because what they measure is what the v1 shipped green and lost the room
# with. Each one skips a slide whose pattern the catalog does not know: the
# vocabulary ruler has already named that, and a second red about a stranger
# pattern is noise on top of the fix.

def _word_budget(deck):
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        ceiling = budget_of(pattern)
        if ceiling is None:
            continue
        # AN ICON IS READ, NEVER SAID. Its slot's text is a Lucide name --
        # furniture the compiler consumes, not a word the room hears -- so it
        # is left out of the same total a cover's meta line is spent from.
        spent = sum(
            _words(plain_text(el)) for el in node.elements()
            if role_of_element(pattern, el) != ICON
        )
        if spent > ceiling:
            fixes.append(
                f"{_at(n, node)}: cut the slide to {ceiling} words "
                f'— the pattern "{pattern}" budgets {ceiling} and this one spends '
                f"{spent}; what does not fit is what you say out loud"
            )
    return fixes


def _category_title(deck):
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


def _repeated_pattern(deck):
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


def _icon_known(deck):
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


def _icon_paired(deck):
    # THE REGISTER NAMES THE PAIR, THIS RULER ONLY READS IT. `Slot.pairs_with`
    # is declared once per icon slot in catalog.py (#211's "um ícone por
    # item"); a pattern with no paired slots costs this ruler nothing, so a
    # future pattern never has to opt out.
    fixes = []
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        written = {el.attrs.get("class", "").strip() for el in node.elements()}
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


def _chart_data(deck):
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


def _chart_source(deck):
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


def _chart_fit(deck):
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


def _figure_paint(deck):
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


def _figure_asset(deck):
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


# APPEND AT THE END. The order is the order the report prints, and the report
# is read top to bottom by whoever is fixing a deck: the dialect first,
# because a source that does not parse into slides has nothing for the
# doctrine to measure, then the ones that judge what the slides say.
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
)


def audit(deck):
    """Every ruler over one deck, in a stable order."""
    return [Verdict(ruler, measure(deck)) for ruler, measure in RULERS]


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
