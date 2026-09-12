"""The dialect: restricted HTML in, a tree of facts out.

THIS FILE JUDGES ALMOST NOTHING, AND THAT IS THE POINT. It turns a source
file into the smallest structure that still says what the author wrote --
which element, which attributes, which line -- and hands it to `audit.py`,
which is where every verdict about the source lives. Splitting them means the
rulers can grow, ticket after ticket, without a parser growing an opinion in
a second place.

The one thing it does refuse is a file that has no deck in it at all: there
is no tree to hand on, so there is nothing for a ruler to be red about.

A source looks like this, and the header is the `<deck>` tag's attributes:

    <deck title="…" occasion="…" theme="base" lang="pt-BR" minutes="20">
      <section pattern="full-bleed-statement">
        <p class="statement">The suite was green and the <strong>room</strong> was not.</p>
      </section>
    </deck>
"""

import html
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser

from catalog import (BREAK_TAG, DECK_FIELDS, DIRECTION_TAG, INLINE_TAGS,
                     SOURCE_WHAT, SOURCE_WHEN, SOURCES_SPEC, SOURCES_TAG)


class Refused(Exception):
    """The build stops here, and the message says what to do about it."""


@dataclass
class Element:
    tag: str
    attrs: dict
    line: int
    children: list = field(default_factory=list)   # Element | str

    def elements(self):
        return [c for c in self.children if isinstance(c, Element)]


@dataclass
class Deck:
    header: dict            # the `<deck>` attributes, verbatim
    children: list          # every Element directly under `<deck>`, verbatim
    # WHERE THE SOURCE WAS READ FROM, because a figure may point at a file
    # (#214) and the only honest anchor for that path is the directory the
    # author was writing in -- not the directory the build happened to be run
    # from, which is a different place every time somebody runs it. It is a
    # fact ABOUT the source rather than a judgement of it, which is why it
    # rides here and not in the audit.
    base: str = ""

    @property
    def sections(self):
        """The slides proper: the children that are actually `<section>`.

        The two lists differ only in a source with a mistake in it, and that
        is exactly why both exist. `children` is what the vocabulary ruler
        reads, because a stray `<div>` under the deck is one of the things it
        is there to name; `sections` is what everyone else reads, because a
        stray `<div>` is not a slide and counting it as one would put the
        wrong number on every page.
        """
        return [e for e in self.children if e.tag == "section"]

    @property
    def direction(self):
        """The art-direction block, or None when the source has none (#217).

        THE FIRST ONE, NEVER A MERGE OF SEVERAL. A source with two `<direction>`
        blocks is a source with two art directions, and the vocabulary ruler is
        what names that -- taking the first here rather than raising keeps this
        file judging nothing, the same way `sections` counts a stray `<div>` out
        instead of refusing it.
        """
        return next((e for e in self.children if e.tag == DIRECTION_TAG), None)

    @property
    def provenance(self):
        """The `<sources>` block, or None when the source carries none (#238).

        THE FIRST ONE, FOR THE SAME REASON `direction` TAKES THE FIRST. A source
        with two blocks is a source with two lists of sources, and naming that is
        the vocabulary ruler's job -- this file judges nothing.

        AND IT IS NOT CALLED `sources`, BECAUSE `Deck.sections` IS ALREADY THE
        PLURAL OF A SLIDE. A reader scanning `deck.sources` beside `deck.sections`
        in the same function has to stop and count letters to know which is
        which; the word for "where this deck says it read things" is the one that
        does not look like anything else here.
        """
        return next((e for e in self.children if e.tag == SOURCES_TAG), None)

    @property
    def title(self):
        return self.header.get("title", "")

    @property
    def theme(self):
        return self.header.get("theme", "")

    @property
    def lang(self):
        return self.header.get("lang", "")


class _Reader(HTMLParser):
    """Every element, with its line, into one tree. No judgement anywhere."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Element(tag="#document", attrs={}, line=0)
        self.stack = [self.root]

    def _open(self, tag, attrs):
        # A VALUELESS ATTRIBUTE COMES BACK AS None, NOT "". `<deck title>` and
        # `<p class>` are both things a hand-written source really contains,
        # and every reader downstream asks an attribute for `.strip()` or
        # `.split()`. Normalising here is what turns a stack trace into a
        # refusal that names the missing value.
        line = self.getpos()[0]
        clean = {k: ("" if v is None else v) for k, v in attrs}
        node = Element(tag=tag, attrs=clean, line=line)
        self.stack[-1].children.append(node)
        return node

    def handle_starttag(self, tag, attrs):
        self.stack.append(self._open(tag, attrs))

    def handle_startendtag(self, tag, attrs):
        self._open(tag, attrs)

    def handle_endtag(self, tag):
        # An unbalanced close is not this reader's failure to name: it pops
        # to the nearest matching open and lets the rulers see the shape that
        # produced. Raising here would trade one legible red for a stack trace.
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def read(text, base=""):
    """Parse a source into a Deck. Refuses only when there is no deck at all."""
    reader = _Reader()
    reader.feed(text)
    reader.close()

    decks = [e for e in reader.root.elements() if e.tag == "deck"]
    if not decks:
        raise Refused(
            "wrap the whole source in a <deck …> element carrying "
            + ", ".join(DECK_FIELDS)
        )
    if len(decks) > 1:
        raise Refused(
            f"keep one <deck> in the file — there are {len(decks)}, and a file "
            "with two decks builds one of them and drops the other"
        )

    deck = decks[0]
    return Deck(header=dict(deck.attrs), children=deck.elements(), base=base)


# ── back out to markup ───────────────────────────────────────────────────────
# Only ever called on a source the rulers already passed, so the whitelist
# below is a second lock rather than the first: an emphasis tag that reached
# here without being in the catalog is a rule that stopped being enforced,
# and it should stop the build rather than reach the page.

def squeeze(s):
    """Runs of whitespace become one space. Boundaries are left alone."""
    return re.sub(r"\s+", " ", s)


def fields_of(item):
    """One group item's children, by the field name each carries as its class.

    IT LIVES HERE BECAUSE TWO READERS WANT IT AND THE RULE IS ONE. `build.py`
    writes a group back out as markup and `charts.py` reads one into numbers;
    both have to answer "which `<p>` is the value", and two copies of that
    answer is how the day a field stops being named by `class=` breaks one of
    them silently. This file already owns every other walk over the parsed
    tree.
    """
    return {el.attrs.get("class", "").strip(): el for el in item.elements()}


def plain_text(node, _top=True):
    """A slot's contents as a sentence: the emphasis flattened into the words.

    The same whitespace rule as `inline_markup` below, and for the same
    reason -- squeeze per run, strip once at the top. It lives beside it
    rather than in the audit because both are READING the tree, and two
    copies of one whitespace rule is how "the <strong>room</strong>" ends up
    counted as one word in one place and two in the other.

    BREAK_TAG COUNTS AS A SPACE, NEVER AS NOTHING. A forced line inside a
    sentence still separates two words for whoever is counting them --
    dropping it silently would turn "primeiro<br/>segundo" into the one word
    "primeirosegundo" for the word-budget ruler, which is a defect the ruler
    would never see because the merge happens one layer below it.
    """
    out = []
    for child in node.children:
        if isinstance(child, str):
            out.append(squeeze(child))
        elif child.tag == BREAK_TAG:
            out.append(" ")
        else:
            out.append(plain_text(child, _top=False))
    said = "".join(out)
    return said.strip() if _top else said


def texts_of(node):
    """`fields_of` one step further: the words each named child carries.

    THE ART DIRECTION HAS TWO READERS AND ONE RULE (#217). `compiler/audit.py`
    holds the deck to what the direction declared and `compiler/storyboard.py`
    publishes it, and both want the WORDS rather than the elements -- so both
    would otherwise spell the same `plain_text(...).strip()` comprehension, which
    is how the day a choice stops being named by `class=` breaks one of them and
    not the other. An unnamed child is dropped: it is a mistake the vocabulary
    ruler names, and there is no key to file it under here.
    """
    return {
        name: plain_text(el).strip()
        for name, el in fields_of(node).items()
        if name
    }


def sources_of(deck):
    """The deck's provenance, by id, in written order -- None when there is none.

    THREE READERS, ONE WALK (#238). `compiler/audit.py` holds every citation to
    this map, `compiler/build.py` prints two of each source's fields onto the
    stage, and `compiler/storyboard.py` publishes all four beside the deck. The
    walk is three lines long, which is exactly how three copies of it end up
    disagreeing about the one case that matters: what an item with no `id=` is.

    NONE IS NOT AN EMPTY DICT, and the difference is a red. "There is no block"
    is one fix in the header; "the block is there and this id is not in it" is a
    different fix in a slide, and a caller that could not tell them apart would
    print both.

    A NAMELESS ITEM AND A REPEATED NAME ARE BOTH DROPPED HERE AND NAMED THERE.
    This file judges nothing (see the module docstring): the vocabulary ruler
    refuses an `<li>` with no `id=` and a second `<li>` under a name already
    taken, so what this returns is the map those reds describe -- first writing
    wins, which is the same rule `fields_of` keeps one level down.
    """
    node = deck.provenance
    if node is None:
        return None
    found = {}
    for item in node.elements():
        if item.tag != SOURCES_SPEC.item:
            continue
        key = item.attrs.get(SOURCES_SPEC.key, "").strip()
        if not key or key in found:
            continue
        found[key] = texts_of(item)
    return found


def source_line(fields):
    """What the stage prints where a citation's id was: the what and the when.

    ONE PLACE, BECAUSE TWO READERS NEED THE SAME ANSWER (#238).
    `compiler/build.py` writes this line onto the page and `compiler/audit.py`
    charges its words to the slide's budget -- and a budget counting a line a
    build assembled differently is a budget that is wrong in the one direction a
    budget must not be. The separator is the register's (`SOURCES_SPEC`), not
    this function's.

    A BLANK FIELD DROPS OUT RATHER THAN PRINTING A BARE SEPARATOR. Both fields
    are required and `_sources` refuses a blank one, so this can only be reached
    by a caller that skipped the audit -- and a dangling "· " on a stage is a
    worse way to find that out than a line one field short.
    """
    return SOURCES_SPEC.separator.join(
        said for said in (fields.get(SOURCE_WHAT, "").strip(),
                          fields.get(SOURCE_WHEN, "").strip())
        if said
    )


def inline_markup(node, _top=True):
    """A slot's contents as markup: text escaped, emphasis kept, nothing else.

    The squeeze runs per text run and the strip runs ONCE, at the top. Doing
    both per run eats the space between a word and an emphasised word --
    "the <strong>room</strong>" comes back as "the<strong>room</strong>", and
    the deck reads as a typo nobody typed.

    BREAK_TAG IS WRITTEN SELF-CLOSED AND NEVER RECURSED INTO. The audit
    refuses a `<br>` that carries a child before this ever runs (source.py
    judges nothing; see the module docstring), so by the time a source
    reaches here a `<br>` is already known to be empty -- writing it as
    `<br/>` rather than recursing is what keeps a forced break from ever
    being handed markup validated for a different tag.
    """
    out = []
    for child in node.children:
        if isinstance(child, str):
            out.append(html.escape(squeeze(child), quote=False))
            continue
        if child.tag == BREAK_TAG:
            out.append(f"<{BREAK_TAG}/>")
            continue
        if child.tag not in INLINE_TAGS:
            raise Refused(
                f"fix the vocabulary ruler — it passed a <{child.tag}> inside "
                "a slot and this serializer will not write markup nobody "
                "validated. A reader seeing this has found a broken check, "
                "not a broken deck"
            )
        out.append(f"<{child.tag}>{inline_markup(child, _top=False)}</{child.tag}>")

    markup = "".join(out)
    return markup.strip() if _top else markup
