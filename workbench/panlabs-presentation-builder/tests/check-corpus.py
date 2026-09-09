#!/usr/bin/env python3
"""THE CORPUS EXERCISES THE WHOLE REGISTER, OR SAYS WHAT IT LEAVES OUT.

    workbench/panlabs-presentation-builder/tests/check-corpus.py [EXAMPLES_DIR]

#219 asks for two examples that between them use "os dezoito padrões, os seis
tipos de gráfico e a figura sob medida", and until this file that sentence was
a claim in three documents and a fact in nobody's check. It is exactly the kind
of claim that rots without a sound: somebody shortens a deck, the sparkline goes
with it, every layer of the suite stays green, and `CATALOG.md` keeps telling a
model that the two decks show it every form there is.

WHAT IT READS IS THE REGISTER, NEVER A LIST WRITTEN HERE. `catalog.pattern_names()`
and `catalog.form_names()` are the same functions the compiler validates against,
so a pattern added by a later ticket is a pattern this check starts demanding on
the day it lands -- which is the point. A list copied into this file would be a
second place to remember, and the one that quietly stays at eighteen.

IT IS NOT A RULER OF THE COMPILER, AND THAT IS WHY IT LIVES HERE. Nothing about
a deck is wrong because the corpus does not exercise some pattern; what is wrong
is the tree PROMISING to teach a catalog it does not show. That is a fact about
the corpus a maintainer keeps, which is this workbench's whole subject.

Exit 0 when every pattern and every chart form appears at least once, 1 otherwise
with the names of what is missing.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
sys.path.insert(0, os.path.join(SKILL, "compiler"))

import catalog                                                        # noqa: E402
import source                                                         # noqa: E402


def used(examples):
    """Every pattern and every chart form the sources under `examples` take.

    IT PARSES RATHER THAN GREPS. `pattern="chart"` inside a comment, or inside
    the prose of a `<notes>`, is not a slide taking that shape -- and a check
    that counted it would be green over a corpus that had stopped carrying the
    pattern the day somebody wrote about it instead of using it.
    """
    patterns, forms = set(), set()
    for name in sorted(os.listdir(examples)):
        if not name.endswith(".deck.html"):
            continue
        path = os.path.join(examples, name)
        with open(path, encoding="utf-8") as fh:
            deck = source.read(fh.read(), base=examples)
        for node in deck.sections:
            pattern = node.attrs.get("pattern", "")
            if not pattern:
                continue
            patterns.add(pattern)
            chart = catalog.chart_of(pattern)
            if chart:
                said = node.attrs.get(chart.attribute, "").strip()
                if said:
                    forms.add(said)
    return patterns, forms


def main(argv):
    examples = argv[0] if argv else os.path.join(SKILL, "examples")
    if not os.path.isdir(examples):
        print(f"REFUSED · put the examples back at {examples} — with no corpus "
              "there is nothing to hold the register to")
        return 1

    declared = set(catalog.pattern_names())
    charted = {name for name in declared if catalog.chart_of(name)}
    every_form = set()
    for name in charted:
        every_form |= set(catalog.form_names(name))

    try:
        patterns, forms = used(examples)
    except source.Refused as e:
        print(f"REFUSED · {e} — fix the source before asking what the corpus covers")
        return 1

    # THE DIRECTORY IS NAMED THE WAY THE READER WOULD TYPE IT. Relative to the
    # skill when it is inside it, which is the real corpus and every message a
    # session sees; verbatim otherwise, because a proof pointing this at a temp
    # directory would otherwise print nine `../` and name nothing.
    said_at = examples
    if os.path.commonpath([os.path.abspath(examples), SKILL]) == SKILL:
        said_at = os.path.relpath(examples, SKILL)

    fixes = []
    missing = sorted(declared - patterns)
    if missing:
        fixes.append(
            f"add a slide in {', '.join(missing)} to one of the decks under "
            f"{said_at}/, or take the pattern out of compiler/catalog.py — the "
            "tree says the two examples show the whole catalog, and these are "
            "the ones it does not show"
        )
    absent = sorted(every_form - forms)
    if absent:
        fixes.append(
            f"add a chart drawn as {', '.join(absent)} to one of the decks under "
            f"{said_at}/, or take the form out of compiler/catalog.py — a form "
            "nobody in the corpus draws is a form nobody has ever seen rendered"
        )

    print(f"── corpus · {len(patterns)} of {len(declared)} patterns · "
          f"{len(forms)} of {len(every_form)} chart forms")
    if fixes:
        print("   ✗ corpus-covers-the-register · every pattern and every chart "
              "form the register declares is drawn at least once")
        for fix in fixes:
            print(f"       | {fix}")
        return 1
    print("   ✓ corpus-covers-the-register · every pattern and every chart form "
          "the register declares is drawn at least once")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
