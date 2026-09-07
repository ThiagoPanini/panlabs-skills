"""The catalog: every name the dialect knows, in the one place that knows it.

THE CATALOG IS THE SOURCE, NOT A DESCRIPTION OF ONE. The compiler validates
against this file and nothing else, and every document that lists a pattern
for a reader is generated from it. The v1 measured what the alternative costs:
prose written beside a register drifts from it, and the copy the agent reads
is always the one that aged.

A PATTERN DECLARES STRUCTURE AND SLOTS, NEVER A MEASURE. How tall a statement
is, how wide it runs and where it sits are the stage's business -- a pattern
that fixed a height would be a pattern that broke on the next projector.
"""

from dataclasses import dataclass


# The five things a deck's header has to say about itself. `theme` is here
# because a deck knows which identity it was written for; the build command
# can still override it, which is what lets the same deck be rebuilt in
# `base` to prove the patterns hold without a brand behind them.
DECK_FIELDS = ("title", "occasion", "theme", "lang", "minutes")

# The whole of the emphasis the dialect allows inside a slot. Two, because
# emphasis that can say four things says none of them from the back row.
INLINE_TAGS = ("em", "strong")

# A text slot is written as a paragraph. The element carries the slot's name
# as its only class, and nothing else: `style=` and a second class are
# geometry wearing the clothes of prose, and geometry does not cross this
# seam.
SLOT_TAG = "p"


@dataclass(frozen=True)
class Pattern:
    """One entry of the catalog."""

    name: str
    slots: tuple           # every slot the pattern accepts, in reading order
    required: tuple        # the subset without which the slide is not the pattern
    headline: str          # what the pattern is for, in one line


PATTERNS = {
    p.name: p
    for p in (
        Pattern(
            name="full-bleed-statement",
            slots=("statement",),
            required=("statement",),
            headline="one sentence at display size, holding the stage on its own",
        ),
    )
}


def pattern_names():
    """Every pattern the catalog declares, in a stable order."""
    return tuple(sorted(PATTERNS))


def slots_of(name):
    """The slots of a pattern, or () when the catalog has never heard of it."""
    p = PATTERNS.get(name)
    return p.slots if p else ()
