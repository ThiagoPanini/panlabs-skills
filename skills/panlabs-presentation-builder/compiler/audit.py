"""The audit: every ruler that reads the source, and the report they write.

A RULER MEASURES A DEFECT, NOT A TASTE. Whether the deck is any good is what
the contact sheet and a pair of eyes are for; what belongs here is the class
of mistake the eye does not catch -- a class that is not in the catalog, a
slot that is missing, a budget that is over.

ONE RULER READS THE DIALECT AND THREE READ THE DOCTRINE. The first refuses a
source the compiler cannot build; the other three build fine and would ship a
deck that fails in the room -- a slide with a paragraph on it, a title that
names a folder instead of making a point, the same shape twice in a row. All
four are STATIC because the source already answers them: counting words,
reading a title and comparing two `pattern=` attributes needs no browser, and
a defect that can be named before a byte is written should be.

EVERY RED NAMES ITS OWN FIX, IN THE IMPERATIVE. "unknown class" is a
diagnosis and leaves the reader to guess; "drop the class …" is the repair.
The proof beside this file asserts the fix, not the diagnosis, which is what
stops the message from being rewritten into a shrug.

The report is printed by the build command on every run, green or red, so
that "what is wrong with this deck" is answerable without opening a browser.
"""

import unicodedata
from dataclasses import dataclass

import icons
from catalog import (BREAK_TAG, CATEGORY_TITLES, ICON, INLINE_TAGS, PATTERNS,
                     SLOT_TAG, TABLE_MAX_ROWS, allow_break_of, budget_of,
                     claims_of, group_of, is_table, pattern_names,
                     role_of_element, slot_specs, slots_of)
from source import plain_text


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
    "no pattern runs on two slides in a row",
)

ICON_KNOWN = Ruler(
    "icon-known",
    "every icon a slide names is one the vendored Lucide set carries",
)

ICON_PAIRED = Ruler(
    "icon-paired",
    "a slot never appears without the one it is paired with",
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


def _field(el, at, group, seen, allow_break):
    """One field inside a group's item -- the same shape as `_slot`, one level
    deeper, and kept as its own function rather than a shared one because the
    vocabulary it reads is the group's fields, never the pattern's slots."""
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

    fixes.extend(_emphasis(el, at, classes[0], allow_break))
    return fixes


def _group(container, at, pattern, group):
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

    now_count = 0
    item_count = 0
    for item in container.elements():
        if item.tag != group.item:
            fixes.append(
                f"{at}: write each entry as <{group.item}>, not <{item.tag}> "
                f'— the pattern "{pattern}" counts <{group.item}>, one per item'
            )
            continue
        item_count += 1

        extra = ("now",) if group.now_flag else ()
        if group.now_flag and "now" in item.attrs:
            now_count += 1
        for key in sorted(k for k in item.attrs if k not in extra):
            fixes.append(
                f"{at}: drop {key}= from the <{group.item}>" + (
                    f" — the only attribute a <{group.item}> may carry is "
                    "the bare `now`" if group.now_flag else
                    " — it carries no attribute of its own"
                )
            )

        seen = []
        for sub in item.children:
            if isinstance(sub, str):
                if sub.strip():
                    fixes.append(f"{at}: wrap the loose text in a field — " + _field_list(group))
                continue
            fixes.extend(_field(sub, at, group, seen, allow_break_of(pattern)))

        for want in group.required_fields:
            if want not in seen:
                fixes.append(
                    f'{at}: add the missing <{SLOT_TAG} class="{want}"> to a '
                    f"<{group.item}> — every item of this group needs it"
                )
        for name in sorted(set(s for s in seen if seen.count(s) > 1)):
            fixes.append(
                f'{at}: keep one <{SLOT_TAG} class="{name}"> per <{group.item}> '
                "— an item declares the field once"
            )

    if item_count < group.minimum:
        fixes.append(
            f"{at}: add {group.minimum - item_count} more <{group.item}> — the "
            f'pattern "{pattern}" needs {group.minimum} to {group.maximum}, and '
            f"this one has {item_count}"
        )
    elif item_count > group.maximum:
        fixes.append(
            f"{at}: drop {item_count - group.maximum} <{group.item}> — the "
            f'pattern "{pattern}" needs {group.minimum} to {group.maximum}, and '
            f"this one has {item_count}"
        )
    if group.now_flag and now_count > 1:
        fixes.append(
            f"{at}: keep `now` on at most one <{group.item}> — {now_count} are "
            "marked as the present moment, and a timeline has only one"
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


# ── the containers a group or a table is written as, and nothing else can be ──
CONTAINER_TAGS = ("ul", "ol", "table")


def _slide(node, n):
    fixes = []
    at = _at(n, node)

    for key in sorted(k for k in node.attrs if k != "pattern"):
        fixes.append(
            f"{at}: drop {key}= from the <section> — a section carries "
            "pattern= and nothing else"
        )

    known = ", ".join(pattern_names())
    pattern = node.attrs.get("pattern")
    if not pattern:
        return fixes + [f"{at}: give the <section> a pattern= from the catalog: {known}"]
    if pattern not in PATTERNS:
        return fixes + [
            f'{at}: replace the pattern "{pattern}" with one the catalog '
            f"declares: {known}"
        ]

    group = group_of(pattern)
    table = is_table(pattern)
    # THE WORD THE PATTERN CALLS ITS OWN EVIDENCE, and the tag it is written
    # as. A `table` pattern never carries a `Group` -- its columns are the
    # deck's own words, not the register's (`_table`'s own docstring) -- so a
    # message about it says "table", never "group".
    kind = "table" if table else "group"
    want = "table" if table else (group.container if group else None)

    seen = []
    evidence_seen = False
    for child in node.children:
        if isinstance(child, str):
            if child.strip():
                fixes.append(
                    f"{at}: wrap the loose text in a slot — " + _slot_list(pattern)
                )
            continue

        if child.tag in CONTAINER_TAGS:
            if want and child.tag == want:
                # A SECOND CONTAINER IS NEVER A SECOND CHANCE. Every pattern
                # that carries evidence carries exactly one -- `build.py`'s
                # `slide_markup` picks the LAST one it sees and drops the
                # rest silently, which is exactly the class of defect this
                # ruler exists to catch before it reaches the page.
                if evidence_seen:
                    fixes.append(
                        f"{at}: keep one <{want}> — the pattern \"{pattern}\" "
                        f"carries one {kind}, not two"
                    )
                    continue
                evidence_seen = True
                fixes.extend(
                    _group(child, at, pattern, group) if group
                    else _table(child, at, pattern)
                )
                continue
            if want:
                fixes.append(
                    f"{at}: write the {kind} as <{want}>, not <{child.tag}> — "
                    f'the pattern "{pattern}" needs its evidence in a <{want}>'
                )
            else:
                fixes.append(
                    f"{at}: drop the <{child.tag}> — the pattern \"{pattern}\" "
                    "has no group; " + _slot_list(pattern)
                )
            continue

        fixes.extend(_slot(child, at, pattern, seen))

    for want_slot in PATTERNS[pattern].required:
        if want_slot not in seen:
            fixes.append(
                f'{at}: add the missing <{SLOT_TAG} class="{want_slot}"> — the '
                f'pattern "{pattern}" is not itself without it'
            )
    for name in sorted(set(s for s in seen if seen.count(s) > 1)):
        fixes.append(
            f'{at}: keep one <{SLOT_TAG} class="{name}"> — the pattern '
            f'"{pattern}" declares the slot once'
        )
    if want and not evidence_seen:
        fixes.append(
            f"{at}: add a <{want}> — the pattern \"{pattern}\" needs its "
            "evidence and this slide has none"
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
# The three below read a source the compiler could build and refuse it anyway,
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
    fixes = []
    before = None
    for n, node in enumerate(deck.sections, start=1):
        pattern = node.attrs.get("pattern", "")
        if pattern and pattern == before:
            fixes.append(
                f"{_at(n, node)}: give this slide another pattern "
                f'— "{pattern}" already ran on slide {n - 1}, and two slides in '
                "the same shape read as one that failed to advance"
            )
        before = pattern
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


# APPEND AT THE END. The order is the order the report prints, and the report
# is read top to bottom by whoever is fixing a deck: the dialect first,
# because a source that does not parse into slides has nothing for the
# doctrine to measure, then the five that judge what the slides say.
RULERS = (
    (VOCABULARY, _vocabulary),
    (WORD_BUDGET, _word_budget),
    (CATEGORY_TITLE, _category_title),
    (REPEATED_PATTERN, _repeated_pattern),
    (ICON_KNOWN, _icon_known),
    (ICON_PAIRED, _icon_paired),
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
