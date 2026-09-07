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

    def text(self):
        out = []
        for c in self.children:
            out.append(c if isinstance(c, str) else c.text())
        return "".join(out)


@dataclass
class Deck:
    header: dict            # the `<deck>` attributes, verbatim
    slides: list            # the Elements directly under `<deck>`, verbatim
    root: Element

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
        line = self.getpos()[0]
        node = Element(tag=tag, attrs=dict(attrs), line=line)
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
    return Deck(header=dict(deck.attrs), slides=deck.elements(), root=deck)


# ── back out to markup ───────────────────────────────────────────────────────
# Only ever called on a source the rulers already passed, so the whitelist
# below is a second lock rather than the first: an emphasis tag that reached
# here without being in the catalog is a rule that stopped being enforced,
# and it should stop the build rather than reach the page.

def _squeeze(s):
    """Runs of whitespace become one space. Boundaries are left alone."""
    return re.sub(r"\s+", " ", s)


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
                f"drop the <{child.tag}> inside the slot — the emphasis the "
                "dialect knows is " + " and ".join(f"<{t}>" for t in INLINE_TAGS)
            )
        out.append(f"<{child.tag}>{inline_markup(child, _top=False)}</{child.tag}>")

    markup = "".join(out)
    return markup.strip() if _top else markup
