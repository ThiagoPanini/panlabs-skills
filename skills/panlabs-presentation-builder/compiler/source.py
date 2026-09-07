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

from catalog import DECK_FIELDS, INLINE_TAGS


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


def read(text):
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
    return Deck(header=dict(deck.attrs), children=deck.elements())


# ── back out to markup ───────────────────────────────────────────────────────
# Only ever called on a source the rulers already passed, so the whitelist
# below is a second lock rather than the first: an emphasis tag that reached
# here without being in the catalog is a rule that stopped being enforced,
# and it should stop the build rather than reach the page.

def _squeeze(s):
    """Runs of whitespace become one space. Boundaries are left alone."""
    return re.sub(r"\s+", " ", s)


def plain_text(node, _top=True):
    """A slot's contents as a sentence: the emphasis flattened into the words.

    The same whitespace rule as `inline_markup` below, and for the same
    reason -- squeeze per run, strip once at the top. It lives beside it
    rather than in the audit because both are READING the tree, and two
    copies of one whitespace rule is how "the <strong>room</strong>" ends up
    counted as one word in one place and two in the other.
    """
    out = []
    for child in node.children:
        out.append(_squeeze(child) if isinstance(child, str)
                   else plain_text(child, _top=False))
    said = "".join(out)
    return said.strip() if _top else said


def inline_markup(node, _top=True):
    """A slot's contents as markup: text escaped, emphasis kept, nothing else.

    The squeeze runs per text run and the strip runs ONCE, at the top. Doing
    both per run eats the space between a word and an emphasised word --
    "the <strong>room</strong>" comes back as "the<strong>room</strong>", and
    the deck reads as a typo nobody typed.
    """
    out = []
    for child in node.children:
        if isinstance(child, str):
            out.append(html.escape(_squeeze(child), quote=False))
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
