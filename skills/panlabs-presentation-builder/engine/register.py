#!/usr/bin/env python3
"""THE REGISTER -- the single place where a block's name is a fact.

This module is the answer to #97 item 3 (drift) and item 6 (vocabulary), and
it earns that by being DATA, not prose. Every consumer reads this dict:

  * `build.py`      renders a block by looking its name up here
  * `vocab.py`      emits the model-facing list from here
  * a checker       compares this dict against the skeleton's CSS by reading
                    BOTH sides, so it never has to carry the vocabulary

Nobody writes a block name twice. A name written twice is a name that drifts,
and slideless is the measured proof: 469 KB of prose could not follow 164 KB
of template, and one of its references admits deleting two of its own sections
for contradicting the engine.

WHICH blocks exist was #98's measurement and #117's decision, and both are
closed: the eight names below are final. The ceilings are the other half of
that decision, and only PART of them moved -- see the note under `ceil`.
"""

# `css`      -- the block's ROOT CLASS in the skeleton. It is here and not
#               guessed, because the first run of the gate guessed it by
#               prefix and got `table`/`metrics` wrong (`.b-tb`, `.b-mx`): a
#               check that infers a name is a check that will be wrong about
#               one, and this is the register -- the place where a name is a
#               fact, not an inference.
# `fields`   -- required keys, in the order the renderer reads them
# `opt`      -- optional keys
# `ceil`     -- character ceiling per free-text field. Named `ceil` and not
#               `cap` because `cap` is already a FIELD of `number` -- one word
#               doing two jobs is how a vocabulary starts costing more than it
#               buys. #117 published a number for the FOUR blocks regime B
#               moved -- `quote`, `number`, `list`, `steps`. The other four
#               are in regime B's one-zone half, which published no figure for
#               them, so they still carry the measured maxima of the #105
#               fiction: a floor that already renders, not a target.
# `count`    -- how many items the block admits: the `N` in #117's `N x M`.
#               Only the two blocks whose count #117 published carry it.
# `lit`      -- True when the block's parts carry `data-i` and can be lit by a
#               beat, i.e. the block is eligible to be the pinned figure
#
# `ceil` and `count` are DECLARATIVE: nothing in `build.py` refuses an argument
# for going over one, exactly as in the prototype. Publishing them to the model
# is #158's ticket -- its criterion names `tetos` -- and turning them into a
# refusal is a gate decision, not a transport one.
#
# THE RULER IS REGIME B, and the mother rule of #98 is what makes a ceiling
# safe to state as a number at all: going over one becomes ANOTHER BLOCK,
# never compression. Regime B splits the eight in two. `table`, `chart`,
# `metrics` and `parts` must fit ONE reading zone -- seeing them whole IS the
# reason to draw them. `quote`, `list`, `steps` and `number` may run TWO
# zones: they are read downward, and scrolling is the medium's own motion.
#
# What defeated regime A was not "more text fits". Regime A is the slide edge
# returning under another name -- "every block visible at once" is a PAGE
# constraint with the word page erased -- and its bill was unpayable: for a
# one-zone ceiling to close, `--nk` had to fall from 33.33 to 24, cutting 28%
# off a measure premise 5 declares to be identity. The ceiling would then be
# legislating over the brand, which inverts the hierarchy: identity is
# measured, the ceiling is derived.
#
# The price, accepted with open eyes: the reader scrolls once inside a long
# list, and two beats can no longer be told apart by height alone.
#
# WHAT REOPENS THESE NUMBERS: the recommendation was conditional -- B if the
# format is for a shared screen in a small room, A if it projects. The
# projector was never invoked, so B stands. If it rises, the regime B ceilings
# are RE-MEASURED, not adjusted.
REGISTER = {
    "quote":   dict(css="b-quote", fields=("text", "src"), opt=("head",),
                    ceil=dict(text=270, src=60), lit=False),
    "list":    dict(css="b-list", fields=("icon", "items"), opt=("head",),
                    ceil=dict(items=180), count=6, lit=True),
    "number":  dict(css="b-num", fields=("num", "suf", "cap", "note"),
                    opt=("head",),
                    ceil=dict(num=6, suf=10, cap=110, note=180), lit=False),
    # The name is `parts` and the CSS root is `b-pieces`, and the difference
    # is deliberate. #117 renamed the block because the naming rule of #98 is
    # that a name says WHAT DATA the block is, never how it draws itself --
    # `pieces` was the only one of the eight describing the drawing. It also
    # measured the cost at one line HERE, and that is only true because this
    # field decouples the model's word from the engine's class. Renaming the
    # class too would mean editing the frozen skeleton for a name no reader of
    # the vocabulary ever sees. This field exists precisely so they may differ.
    "parts":   dict(css="b-pieces", fields=("items",), opt=("head",),
                    ceil=dict(title=22, body=90), lit=True),
    "steps":   dict(css="b-steps", fields=("items",), opt=("head",),
                    ceil=dict(title=52, body=180), count=4, lit=True),
    "table":   dict(css="b-tb", fields=("cols", "rows"),
                    opt=("head", "note", "hi"),
                    ceil=dict(cell=34, note=160), lit=True),
    "metrics": dict(css="b-mx", fields=("items",), opt=("head",),
                    ceil=dict(value=6, desc=44, sub=52), lit=True),
    "chart":   dict(css="b-ch", fields=("rows",), opt=("head", "note", "unit"),
                    ceil=dict(label=8, note=160), lit=True),
}

# The beat register. A beat is one stretch of the reading column, and it is
# the ONLY structural unit the model writes. It is not a page: nothing in the
# rendered document draws a boundary at a beat, and its ordinal is derived by
# the builder -- the model never numbers anything.
BEATS = {
    "frame": dict(fields=("title", "sub"), opt=("kicker", "figure")),
    "claim": dict(fields=("claim",), opt=("kicker", "because", "figure")),
    "block": dict(fields=("block",), opt=("figure",)),
    "ask":   dict(fields=("claim", "close"),
                  opt=("kicker", "because", "figure")),
}

# `figure` is optional on EVERY beat, and it is the seam of #120: from this
# beat down, the pinned band draws this instead. It adds no name to the eight
# -- a beat's figure is a block, drawn from the same register -- and it does
# not nest the array: the beats stay flat, and the figure in force at a beat
# is derived by walking them in order.

# Inline markup allowed inside any free-text field. Anything else is a gate
# failure: prose is the model's job, geometry is not, and `<span style=...>`
# is geometry wearing prose's clothes.
INLINE = ("b",)

# Classes that carry no style and exist only for a measurer to read. Declared
# HERE so no check needs a list of its own: a hook with no rule and no
# declaration is indistinguishable from a typo, and that is the point.
HOOKS = ("ok-overlap",)
