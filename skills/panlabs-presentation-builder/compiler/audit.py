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

from catalog import (CATEGORY_TITLES, INLINE_TAGS, PATTERNS, SLOT_TAG,
                     budget_of, claims_of, pattern_names, slots_of)
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


# ── reading a slide, before anyone judges it ─────────────────────────────────

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


def _emphasis(node, at, slot):
    """Everything below a slot: emphasis the dialect knows, and no attributes."""
    fixes = []
    for child in node.children:
        if isinstance(child, str):
            continue
        if child.tag not in INLINE_TAGS:
            fixes.append(
                f'{at}, slot "{slot}": drop the <{child.tag}> — the emphasis '
                "the dialect knows is " + " and ".join(f"<{t}>" for t in INLINE_TAGS)
            )
            continue
        for key in sorted(child.attrs):
            fixes.append(
                f'{at}, slot "{slot}": drop {key}= from the <{child.tag}> — '
                "geometry does not cross this seam"
            )
        fixes.extend(_emphasis(child, at, slot))
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

    fixes.extend(_emphasis(el, at, classes[0]))
    return fixes


def _slide(node, n):
    fixes = []
    at = f"slide {n} (line {node.line})"

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

    seen = []
    for child in node.children:
        if isinstance(child, str):
            if child.strip():
                fixes.append(
                    f"{at}: wrap the loose text in a slot — " + _slot_list(pattern)
                )
            continue
        fixes.extend(_slot(child, at, pattern, seen))

    for want in PATTERNS[pattern].required:
        if want not in seen:
            fixes.append(
                f'{at}: add the missing <{SLOT_TAG} class="{want}"> — the '
                f'pattern "{pattern}" is not itself without it'
            )
    for name in sorted(set(s for s in seen if seen.count(s) > 1)):
        fixes.append(
            f'{at}: keep one <{SLOT_TAG} class="{name}"> — the pattern '
            f'"{pattern}" declares the slot once'
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
        spent = sum(_words(plain_text(el)) for el in node.elements())
        if spent > ceiling:
            fixes.append(
                f"slide {n} (line {node.line}): cut the slide to {ceiling} words "
                f'— the pattern "{pattern}" budgets {ceiling} and this one spends '
                f"{spent}; what does not fit is what you say out loud"
            )
    return fixes


def _category_title(deck):
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
                    f'slide {n} (line {node.line}), slot "{slot}": rewrite '
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
                f"slide {n} (line {node.line}): give this slide another pattern "
                f'— "{pattern}" already ran on slide {n - 1}, and two slides in '
                "the same shape read as one that failed to advance"
            )
        before = pattern
    return fixes


# APPEND AT THE END. The order is the order the report prints, and the report
# is read top to bottom by whoever is fixing a deck: the dialect first,
# because a source that does not parse into slides has nothing for the
# doctrine to measure, then the three that judge what the slides say.
RULERS = (
    (VOCABULARY, _vocabulary),
    (WORD_BUDGET, _word_budget),
    (CATEGORY_TITLE, _category_title),
    (REPEATED_PATTERN, _repeated_pattern),
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
