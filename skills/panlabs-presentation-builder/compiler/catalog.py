#!/usr/bin/env python3
"""The catalog: every name the dialect knows, in the one place that knows it.

    python3 compiler/catalog.py            # the reference, on stdout
    python3 compiler/catalog.py --check    # CATALOG.md still says what this says
    python3 compiler/catalog.py --write    # make it say so

THE CATALOG IS THE SOURCE, NOT A DESCRIPTION OF ONE. The compiler validates
against this file and nothing else, and the reference a model reads before
writing a deck is GENERATED from it -- `CATALOG.md` carries a block this file
prints, and `--check` refuses a block that drifted. The v1 measured what the
alternative costs: prose written beside a register drifts from it, and the
copy the agent reads is always the one that aged.

A PATTERN DECLARES STRUCTURE AND SLOTS, NEVER A MEASURE. How tall a statement
is, how wide it runs and where it sits are the stage's business -- a pattern
that fixed a height would be a pattern that broke on the next projector.

A PATTERN'S REQUIRED SLOTS ARE WHAT KEEPS THE STAGE FULL. Everything in this
first catalog says few words, and few words is exactly what leaves a
projector half dark -- the render gate refuses a slide whose content spans
less of the stage height than the floor `gate/render.cjs` carries as
OCCUPANCY_MIN_RATIO (calibrated in #209; the number lives there and is not
restated here, so recalibrating it cannot leave a lie in this file). A
slide with two words survives that floor by having an ANCHOR and a HORIZON:
something small at the top edge and something large at the bottom, with the
stage between them. That is why a cover requires its `meta` line and a pivot
question requires its `kicker`: drop either and the pattern stops being able
to hold the stage, whatever the theme does.

THE PROSE IN THIS FILE IS PORTUGUESE AND THE REST OF IT IS ENGLISH, on
purpose. `purpose=` is the line the reference publishes to whoever writes a
deck, so it follows the same seam CLAUDE.md draws for a schema's own
`description`: identifiers, comments and every message the compiler PRINTS
are English; the prose that explains a pattern to its author is not.
"""

import argparse
import os
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


# ── what a slot is for ───────────────────────────────────────────────────────
# The role is the register's answer to "how loud is this, and who measures
# it". The stage reads it as `data-role=` on the emitted paragraph and styles
# by it, so a pattern that adds a `meta` slot in a later ticket inherits the
# treatment instead of restating it; the category-title ruler reads it to
# know which slots are supposed to make a CLAIM. The reference publishes them
# by the Portuguese names below.
#
# NAME EXISTS BECAUSE OF THE ARC. A section divider's title is set as large as
# any claim and is the only text on the stage that is SUPPOSED to name a
# folder -- naming the next section "Contexto" is the divider doing its job,
# and #207's own arc opens on that word. Reading it as a claim would let the
# category-title ruler refuse the spec's first act, so the register says what
# the text is and the ruler measures only what claims.
CLAIM = "claim"        # the sentence the slide is there to say
NAME = "name"          # a section's name -- where a category is the right word
FIGURE = "figure"      # a number or token, set large and read as an image
BODY = "body"          # the prose that supports the claim
META = "meta"          # furniture: the label, the index, the source, the date

ROLE_LABEL = {
    CLAIM: "afirmação",
    NAME: "nome",
    FIGURE: "número",
    BODY: "corpo",
    META: "metadado",
}


@dataclass(frozen=True)
class Slot:
    """One named place for text inside a pattern."""

    name: str
    role: str
    purpose: str       # Portuguese: the line the reference publishes about it


@dataclass(frozen=True)
class Pattern:
    """One entry of the catalog."""

    name: str
    slots: tuple       # every slot the pattern accepts, in reading order
    required: tuple    # the slot names without which the slide is not the pattern
    budget: int        # words the WHOLE slide may spend, furniture included
    purpose: str       # Portuguese: the line the reference publishes about it


# THE ORDER IS THE ARC, not the alphabet: a deck opens with a cover, turns on
# a question, states its thesis, holds the stage with a sentence, borrows a
# voice, takes a breath, and asks for something. The reference publishes them
# in this order and every message that lists them uses it too, because the
# order teaches when to reach for which.
#
# THE BUDGETS ARE THE SPEC'S (#207), AND THEY ARE THE SLIDE'S, NOT THE SLOT'S.
# A label is words the room reads too, so a cover's `meta` and a question's
# `kicker` are spent from the same 25 or 12 as the headline. Nothing here
# counts what you SAY over the slide, which is where everything that did not
# fit belongs.
#
# AND ONE CEILING OVER ALL OF THEM: no slide, whatever its pattern, spends
# more than this. It is the spec's backstop for the patterns that have not
# been registered yet -- the ones this catalog still owes are wider (two
# columns 60, three columns and comparison 75), and the only place the
# ceiling can be broken is here, when a budget is written. `--check` is what
# refuses it.
ABSOLUTE_BUDGET = 90

PATTERNS = {
    p.name: p
    for p in (
        Pattern(
            name="cover-headline",
            slots=(
                Slot("kicker", META, "o rótulo curto que situa o deck antes do título"),
                Slot("title", CLAIM, "a manchete: o que este deck afirma"),
                Slot("subtitle", BODY, "uma frase que estende a manchete"),
                Slot("meta", META, "a ocasião e a data, na base do palco"),
            ),
            required=("title", "meta"),
            budget=25,
            purpose="A capa que abre pela manchete — o deck se apresenta pelo que afirma",
        ),
        Pattern(
            name="cover-numbered",
            slots=(
                Slot("number", FIGURE, "o número que abre a capa, no maior corpo do palco"),
                Slot("title", CLAIM, "o que o número quer dizer, logo abaixo dele"),
                Slot("meta", META, "de onde veio o número, e quando foi medido"),
            ),
            required=("number", "title"),
            budget=25,
            purpose="A capa que abre por um número, com o título dizendo o que ele mede",
        ),
        Pattern(
            name="pivot-question",
            slots=(
                Slot("kicker", META, "o rótulo que avisa a plateia de que vem uma pergunta"),
                Slot("question", CLAIM, "a pergunta em que a apresentação vira"),
            ),
            required=("kicker", "question"),
            budget=12,
            purpose="A pergunta que vira a apresentação, em corpo de display",
        ),
        Pattern(
            name="thesis-title",
            slots=(
                Slot("title", CLAIM, "a tese, com verbo ou número"),
                Slot("sentence", BODY, "a única frase que sustenta a tese"),
            ),
            required=("title", "sentence"),
            budget=25,
            purpose="A tese no alto e uma frase só no pé, com o palco inteiro entre as duas",
        ),
        Pattern(
            name="full-bleed-statement",
            slots=(
                Slot("statement", CLAIM, "a frase que o slide inteiro sustenta"),
            ),
            required=("statement",),
            budget=12,
            purpose="Uma frase em corpo de display, segurando o palco sozinha",
        ),
        Pattern(
            name="pull-quote",
            slots=(
                Slot("quote", CLAIM, "a frase citada, na voz de quem a disse"),
                Slot("attribution", META, "quem disse, e em que papel"),
            ),
            required=("quote", "attribution"),
            budget=30,
            purpose="Uma citação segurando o palco, com a atribuição na base",
        ),
        Pattern(
            name="section-divider",
            slots=(
                Slot("index", FIGURE, "o número da seção que começa, no alto do palco"),
                Slot("title", NAME, "o nome da seção, no pé do palco"),
            ),
            required=("index", "title"),
            budget=8,
            purpose="O respiro entre duas seções — um número no alto, o nome embaixo",
        ),
        Pattern(
            name="closing-call",
            slots=(
                Slot("thesis", BODY, "a tese, relembrada em uma linha"),
                Slot("call", CLAIM, "o que você pede à plateia"),
                Slot("meta", META, "onde a conversa continua depois do deck"),
            ),
            required=("thesis", "call"),
            budget=30,
            purpose="O fecho que volta à tese e pede alguma coisa",
        ),
    )
}


# THE TITLES THAT NAME A FOLDER INSTEAD OF A POINT. A slide whose claim is
# one of these has spent the biggest type on the stage saying where the
# reader is, which the page number already answers. The list is short and
# Portuguese because it is DATA about the language a deck is written in, not
# a message the compiler prints; it is the spec's own list (#207), and it
# grows by ticket, never by guess.
CATEGORY_TITLES = (
    "visão geral",
    "agenda",
    "introdução",
    "conclusão",
    "próximos passos",
    "contexto",
    "resumo",
    "obrigado",
)


def pattern_names():
    """Every pattern the catalog declares, in the arc's order."""
    return tuple(PATTERNS)


def slot_specs(name):
    """The slots of a pattern, or () when the catalog never heard of it.

    EVERY OTHER READER GOES THROUGH THIS ONE. A source reaches the audit
    before anything has agreed it is valid, so "a pattern the catalog never
    heard of" is a real case rather than a defensive one -- and it is
    answered here, once, instead of at each caller.
    """
    p = PATTERNS.get(name)
    return p.slots if p else ()


def slots_of(name):
    """The slot NAMES of a pattern, in reading order."""
    return tuple(s.name for s in slot_specs(name))


def claims_of(name):
    """The slots of a pattern that are supposed to make a claim."""
    return tuple(s.name for s in slot_specs(name) if s.role == CLAIM)


def budget_of(name):
    """The words a slide of this pattern may spend, or None for a stranger."""
    p = PATTERNS.get(name)
    return p.budget if p else None


# ── the reference the model reads ────────────────────────────────────────────
# Generated, never written: `CATALOG.md` carries the block between the two
# markers below and nothing else of this file's business. The prose around
# the block is a human's to write.

BEGIN = "<!-- catalog:begin -->"
END = "<!-- catalog:end -->"

DOCUMENT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "CATALOG.md")


def reference():
    """The whole register, as Markdown, exactly as CATALOG.md publishes it."""
    out = [
        "O cabeçalho é o próprio `<deck>`, e os cinco campos são obrigatórios: "
        + ", ".join(f"`{f}`" for f in DECK_FIELDS)
        + f". Um slot é um `<{SLOT_TAG}>` com o nome do slot na `class=` e nada mais. "
        "Dentro de um slot a ênfase é livre, com duas marcações: "
        + " e ".join(f"`<{t}>`" for t in INLINE_TAGS)
        + ".",
        "",
        f"São {len(PATTERNS)} padrões, na ordem do arco. O orçamento é do slide "
        "inteiro, mobília inclusive, e nenhum slide passa de "
        f"{ABSOLUTE_BUDGET} palavras seja qual for o padrão.",
        "",
    ]
    for p in PATTERNS.values():
        out += [
            f"### `{p.name}` · até {p.budget} palavras",
            "",
            p.purpose + ".",
            "",
            "| slot | papel | obrigatório | o que vai nele |",
            "| --- | --- | --- | --- |",
        ]
        for s in p.slots:
            need = "sim" if s.name in p.required else "não"
            out.append(f"| `{s.name}` | {ROLE_LABEL[s.role]} | {need} | {s.purpose} |")
        out.append("")

    out += [
        "### Títulos que reprovam",
        "",
        "Um slot de papel **afirmação** que diga só uma destas reprova a construção — "
        "a categoria nomeia a pasta, não o ponto:",
        "",
        ", ".join(f"«{t}»" for t in CATEGORY_TITLES) + ".",
    ]
    return "\n".join(out)


def _block(text):
    """The generated block of a document, or None when the markers are gone."""
    if BEGIN not in text or END not in text:
        return None
    return text.split(BEGIN, 1)[1].split(END, 1)[0].strip("\n")


def _document(path):
    """The document's text, and why it could not be read. One of the two is None."""
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read(), None
    except OSError as e:
        return None, e.strerror


def check(path):
    """True when the register is in order and the document publishes it.

    The document is named by its BASENAME in every message, not by the path it
    was handed: the proof beside this file points `--check` at a planted copy
    in a temp directory, and a red that opened with six `../` would be naming
    a file nobody has.
    """
    where = os.path.basename(path)

    # THE REGISTER IS CHECKED BEFORE THE DOCUMENT, because a document that
    # faithfully publishes a budget the spec forbids is two problems, and
    # only one of them is the document's.
    over = [p for p in PATTERNS.values() if p.budget > ABSOLUTE_BUDGET]
    if over:
        worst = max(over, key=lambda p: p.budget)
        print(f'REFUSED · bring the budget of "{worst.name}" down to '
              f"{ABSOLUTE_BUDGET} words or fewer in compiler/catalog.py — it "
              f"declares {worst.budget}, over the ceiling #207 puts on any "
              "slide whatever its pattern")
        return False

    text, why = _document(path)
    if why:
        print(f"REFUSED · put {where} back and run `python3 compiler/catalog.py "
              f"--write` — {why}")
        return False

    found = _block(text)
    if found is None:
        print(f"REFUSED · put {BEGIN} and {END} back around the generated block of "
              f"{where}, then run `python3 compiler/catalog.py --write` — without "
              "the markers there is nothing to keep in step with the register")
        return False

    want = reference()
    if found != want:
        drift = sum(1 for a, b in zip(found.split("\n"), want.split("\n")) if a != b)
        drift += abs(len(found.split("\n")) - len(want.split("\n")))
        print(f"REFUSED · run `python3 compiler/catalog.py --write` — {where} is "
              f"{drift} line(s) out of step with compiler/catalog.py, and the "
              "reference a model reads is always the copy that aged")
        return False

    print(f"   ✓ {where} publishes the register: {len(PATTERNS)} patterns, "
          f"{sum(len(p.slots) for p in PATTERNS.values())} slots, "
          f"{len(CATEGORY_TITLES)} refused titles")
    return True


def write(path):
    """Put the register back into the document, between the markers."""
    text, why = _document(path)
    if why:
        print(f"REFUSED · write {path} by hand first, with {BEGIN} and {END} in "
              f"it — {why}")
        return False
    if _block(text) is None:
        print(f"REFUSED · put {BEGIN} and {END} into {path} around the place the "
              "generated block belongs")
        return False

    head, rest = text.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(head + BEGIN + "\n\n" + reference() + "\n\n" + END + tail)
    print(f"   wrote the register into {path}")
    return True


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="catalog.py",
        description="The pattern register, and the reference generated from it.",
    )
    ap.add_argument("document", nargs="?", default=DOCUMENT,
                    help="the Markdown file carrying the generated block")
    ap.add_argument("--check", action="store_true",
                    help="refuse when the document drifted from this register")
    ap.add_argument("--write", action="store_true",
                    help="rewrite the document's generated block from this register")
    args = ap.parse_args(argv)

    if args.check and args.write:
        print("REFUSED · ask for --check or --write, not both — one reads and the "
              "other writes, and running them together hides which one answered")
        return 1
    if args.check:
        return 0 if check(args.document) else 1
    if args.write:
        return 0 if write(args.document) else 1
    print(reference())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
