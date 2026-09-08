#!/usr/bin/env python3
"""EVERY CHECK THE COMPILER MAKES, PLANTED AGAINST AND DEMANDED RED.

    workbench/panlabs-presentation-builder/tests/check-audit.proof.py

A check only ever seen green is documentation. The compiler says no in three
different registers, and all three are here:

  the audit's rulers    read a well-formed source and report every fix at
                        once, in the report printed on every build
  the doctrine rulers   read a source that BUILDS and refuse it anyway -- a
                        budget over, a title that names a folder, the same
                        pattern twice in a row
  the compiler's        stop before there is anything to audit -- no deck in
  refusals              the file, a header field missing, a theme the skill
                        does not carry

A case passes only when all four of ADR 0001's assertions hold: the plant
really changed the source, the build went red, the red NAMED ITS OWN FIX, and
the same build against the untouched example is green.

The asserted phrase is always the FIX and never the diagnosis. "unknown
class" would pass an assertion on a message that tells the reader nothing to
do; `drop the class "highlight"` cannot.

TWO EXAMPLES, BECAUSE TWO KINDS OF DEFECT NEED DIFFERENT GROUND. The
statement deck is one slide, which is all the dialect's own rulers need; the
doctrine's rulers need a deck with several patterns and several titles in it,
and planting a second divider next to the first is not something a
one-slide source can be asked to do.

AND THREE CASES THAT DEMAND GREEN, at the bottom, because a check can also be
wrong by firing. `fill()` used to hunt for leftover `{{NAME}}` markers AFTER
substituting the author's own text into the page, so a deck that said
`{{TITLE}}` out loud was refused with a fix naming a file its author had
never opened. The category-title ruler matches a title WHOLE: a claim that
happens to contain "visão geral" is a claim, and a ruler that read it as a
substring would refuse the sentence that says the most. And it measures only
the CLAIM slots, so the one slide whose job is to name a section may name it
"Contexto" -- the first act of the arc #207 prescribes.

IT PLANTS IN A TEMP DIRECTORY, NEVER IN THE SKILL. The build command takes a
path, so the mutated source has to reach disk somewhere -- somewhere is a
`mktemp` directory that goes away with the process. The tree this measures is
never written to, and the subprocess is told not to leave bytecode in it
either: a ruler that modified its subject would be measuring itself.
"""

import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from proof_driver import Proof, cut, read, swap                        # noqa: E402

SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
BUILD = os.path.join(SKILL, "compiler", "build.py")
STATEMENT = os.path.join(SKILL, "examples", "statement.deck.html")
FEW_WORDS = os.path.join(SKILL, "examples", "few-words.deck.html")
EVIDENCE = os.path.join(SKILL, "examples", "evidence.deck.html")
SIDE_BY_SIDE = os.path.join(SKILL, "examples", "side-by-side.deck.html")
CHARTS = os.path.join(SKILL, "examples", "charts.deck.html")


STATEMENT_SOURCE = read(STATEMENT)
FEW_WORDS_SOURCE = read(FEW_WORDS)
EVIDENCE_SOURCE = read(EVIDENCE)
SIDE_BY_SIDE_SOURCE = read(SIDE_BY_SIDE)
CHARTS_SOURCE = read(CHARTS)


def _run(text):
    """Run THE DOCUMENTED COMMAND over a source; return verdict, words, page.

    Not `import build` -- the thing being proved is the command a human and an
    agent are told to run. A proof that reached past it into the library would
    be green about a compiler nobody invokes.
    """
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    with tempfile.TemporaryDirectory(prefix="panlabs-audit-proof-") as tmp:
        src = os.path.join(tmp, "planted.deck.html")
        out = os.path.join(tmp, "out.html")
        with open(src, "w", encoding="utf-8") as fh:
            fh.write(text)
        done = subprocess.run(
            [sys.executable, BUILD, src, out],
            capture_output=True, text=True, env=env, cwd=SKILL,
        )
        page = None
        if os.path.exists(out):
            with open(out, encoding="utf-8") as fh:
                page = fh.read()
        return done.returncode == 0, (done.stdout + done.stderr).strip(), page


def build(text):
    ok, said, _ = _run(text)
    return ok, said


def block(title, real, cases, width):
    """One fixture's worth of cases, sharing one green control.

    THE CONTROL IS BUILT ONCE PER BLOCK, not once per case, and the reason is
    measured: every successful build hands the page to `gate/render.cjs`, which
    launches a Chromium (#209) -- so a block of six cases used to pay six
    browser launches to re-derive a result that cannot differ between them.
    `check-render.proof.cjs` states the same rule in its own header. What the
    assertion needs is that the unplanted source is green, and one run answers
    that for every case that shares the source.
    """
    settled = []

    def control(_key):
        if not settled:
            settled.append(build(real))
        return settled[0]

    proof = Proof(
        title=title,
        label=lambda key: key,
        invoke=lambda key, payload: build(payload),
        planted=lambda payload: payload != real,
        control=control,
        width=width,
    )
    return proof.run(cases)


# The whole of the fifth slide of the few-words deck, as its source writes it.
# The repeated-pattern ruler is the one check that cannot be planted by
# changing a slide: it needs a SECOND slide of the same pattern next to the
# first, and duplicating a section that is valid on its own is what makes the
# repetition the only thing red.
DIVIDER = """  <section pattern="section-divider">
    <p class="index">02</p>
    <p class="title">O que a máquina mede</p>
  </section>"""

# Thirty words where the pattern budgets twelve -- the ticket's own number
# (#210), counted the way the ruler counts: a whitespace token with a letter
# or a digit in it.
THIRTY_WORDS = (
    "Uma suíte verde, rodada de ponta a ponta na máquina de quem escreveu o "
    "deck, não prova nada sobre o que a última fileira da sala ainda lê no "
    "telão."
)

# Every group and table `evidence.deck.html` carries, exactly as its source
# writes them -- the needles the cases below plant against and the ground
# the "row dropped" / "item dropped" cases below cut into. #212's own
# acceptance criteria name three of these numbers verbatim: seven lines in a
# table, one item in the metrics, two marks in the timeline.
METRICS_UL = """    <ul>
      <li><p class="value">42%</p><p class="label">conversão</p></li>
      <li><p class="value">1,8×</p><p class="label">tempo de resposta</p></li>
      <li><p class="value">−12%</p><p class="label">churn</p></li>
    </ul>"""

METRICS_UL_ONE = """    <ul>
      <li><p class="value">42%</p><p class="label">conversão</p></li>
    </ul>"""

TIMELINE_OL = """    <ol>
      <li><p class="label">Descoberta</p><p class="date">Jan</p></li>
      <li><p class="label">Piloto</p><p class="date">Mar</p></li>
      <li now><p class="label">Lançamento</p><p class="date">Jun</p></li>
      <li><p class="label">Expansão</p><p class="date">Set</p></li>
    </ol>"""

TIMELINE_OL_TWO = """    <ol>
      <li><p class="label">Descoberta</p><p class="date">Jan</p></li>
      <li><p class="label">Piloto</p><p class="date">Mar</p></li>
    </ol>"""

TIMELINE_OL_TWO_NOW = """    <ol>
      <li now><p class="label">Descoberta</p><p class="date">Jan</p></li>
      <li now><p class="label">Piloto</p><p class="date">Mar</p></li>
      <li><p class="label">Lançamento</p><p class="date">Jun</p></li>
      <li><p class="label">Expansão</p><p class="date">Set</p></li>
    </ol>"""

TABLE_BODY = """        <tr><td>Checkout</td><td>14 min</td><td>6 min</td></tr>
        <tr><td>Catálogo</td><td>21 min</td><td>9 min</td></tr>
        <tr><td>Pagamentos</td><td>18 min</td><td>7 min</td></tr>"""

# Six data rows plus the header is seven lines of a table -- one over #212's
# own ceiling ("tabela de sete linhas ... reprovam").
TABLE_BODY_SIX = "\n".join(
    f'        <tr><td>Squad {n}</td><td>{n} min</td><td>{n - 1} min</td></tr>'
    for n in range(1, 7)
)

# #213'S OWN NEEDLES. The chart deck's first slide is a `bars-h` of five
# points, its third is a `line` of five, and its last is a `share` of three --
# which is what lets the cases below plant a count against the FORM's bounds
# rather than the group's. `bars-h` allows six and the group allows twelve, so
# a seventh bar is refused by the form alone: that difference is the whole
# reason a form carries a pair of numbers of its own.
BARS_UL = """    <ul>
      <li><p class="label">Checkout</p><p class="value">6</p></li>
      <li><p class="label">Catálogo</p><p class="value">9</p></li>
      <li><p class="label">Pagamentos</p><p class="value">7</p></li>
      <li><p class="label">Busca</p><p class="value">4</p></li>
      <li mark><p class="label">Perfil</p><p class="value">11</p></li>
    </ul>"""

BARS_UL_SEVEN = "    <ul>\n" + "\n".join(
    f'      <li><p class="label">Squad {n}</p><p class="value">{n}</p></li>'
    for n in range(1, 8)
) + "\n    </ul>"

LINE_UL = """    <ul>
      <li><p class="label">rev 1</p><p class="value">31</p></li>
      <li><p class="label">rev 2</p><p class="value">44</p></li>
      <li><p class="label">rev 3</p><p class="value">52</p></li>
      <li><p class="label">rev 4</p><p class="value">61</p></li>
      <li><p class="label">rev 5</p><p class="value">66</p></li>
    </ul>"""

LINE_UL_TWO = """    <ul>
      <li><p class="label">rev 1</p><p class="value">31</p></li>
      <li><p class="label">rev 2</p><p class="value">44</p></li>
    </ul>"""

# Every value written and legal, and they add up to 95 -- the one defect is
# arithmetic, which is exactly the class #94 measured a hand getting wrong.
SHARE_UL = """    <ul>
      <li><p class="label">Plataforma</p><p class="value">65</p></li>
      <li><p class="label">Produto</p><p class="value">25</p></li>
      <li><p class="label">Suporte</p><p class="value">10</p></li>
    </ul>"""

SHARE_UL_SHORT = SHARE_UL.replace(
    '<p class="value">25</p>', '<p class="value">20</p>')

SHARE_UL_MARKED = SHARE_UL.replace(
    '<li><p class="label">Plataforma</p>', '<li mark><p class="label">Plataforma</p>')

# The whole first slide of the chart deck, so a second copy of it can be put
# next to the first -- the only way to plant a repetition, same as the divider
# above.
BARS_SLIDE = """  <section pattern="chart" type="bars-h">
    <p class="title">O build caiu abaixo de dez minutos em quatro squads</p>
    <p class="unit">minutos por build, mediana</p>
    <p class="source">esteira de CI · jun/2026</p>
""" + BARS_UL + "\n  </section>"

# What a colour looks like, in any of the four notations a hand reaches for.
# `fill=` and `stroke=` are here because a chart that painted itself would not
# need a hexadecimal to break the rule -- `fill="currentColor"` would do it.
STAIN = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(?:fill|stroke|style)=")
PLOT = re.compile(r'<svg class="plot".*?</svg>', re.S)


def the_page_is_not_a_template():
    """A deck may say `{{TITLE}}` out loud, and it stays said.

    THE SKELETON'S HOLES ARE FILLED IN A SINGLE PASS precisely so that the
    author's own words are never scanned for a marker of their own; going
    back to a substitution per hole brings back a refusal that blames
    `compiler/stage.html` for a sentence its author wrote.
    """
    if STATEMENT_SOURCE is None:
        print(f"  FAIL {'setup':<22} no example to plant in")
        return 1

    planted = STATEMENT_SOURCE.replace("Nenhuma suíte verde",
                                       "Nenhuma {{TITLE}} verde", 1)
    ok, said, page = _run(planted)
    kept = bool(page) and "Nenhuma {{TITLE}} verde" in page
    marks = f"[{'+' if ok else '-'}{'+' if kept else '-'}]"
    good = ok and kept
    print(f"  {'ok  ' if good else 'FAIL'} {'author prose':<22} {marks} "
          "a slide whose own text looks like a hole")
    if not good:
        print(f"       <- {'refused: ' + said if not ok else 'the page lost the text'}")
    return 0 if good else 1


def the_category_is_the_whole_title():
    """A claim that CONTAINS a category is a claim, and it stays built.

    The category-title ruler compares the whole title, normalised, against the
    list -- never a substring. "A visão geral do time falhou em três semanas"
    is a thesis with a verb and a number in it, and a ruler that went looking
    for "visão geral" inside it would refuse exactly the sentences the
    doctrine is asking for.
    """
    if FEW_WORDS_SOURCE is None:
        print(f"  FAIL {'setup':<22} no example to plant in")
        return 1

    planted = FEW_WORDS_SOURCE.replace(
        "Um slide diz uma coisa",
        "A visão geral do time falhou em três semanas", 1)
    ok, said, page = _run(planted)
    kept = bool(page) and "falhou em três semanas" in page
    marks = f"[{'+' if ok else '-'}{'+' if kept else '-'}]"
    good = ok and kept
    print(f"  {'ok  ' if good else 'FAIL'} {'claim around a word':<22} {marks} "
          "a title that contains a category and still makes a point")
    if not good:
        print(f"       <- {'refused: ' + said if not ok else 'the page lost the title'}")
    return 0 if good else 1


def the_divider_may_name_the_arc():
    """A section divider called "Contexto" builds, and the thesis above it does not.

    The category-title ruler measures CLAIM slots, and a divider's title
    carries the role NAME: naming the next section after the arc's first act
    is the divider doing its job, and #207 prescribes that very word
    ("contexto → tensão → tese → provas → plano → chamada"). Reading the
    divider as a claim would let this ruler refuse the spec.
    """
    if FEW_WORDS_SOURCE is None:
        print(f"  FAIL {'setup':<22} no example to plant in")
        return 1

    planted = FEW_WORDS_SOURCE.replace(
        "<p class=\"title\">O que a máquina mede</p>",
        "<p class=\"title\">Contexto</p>", 1)
    ok, said, page = _run(planted)
    kept = bool(page) and ">Contexto<" in page
    marks = f"[{'+' if ok else '-'}{'+' if kept else '-'}]"
    good = ok and kept
    print(f"  {'ok  ' if good else 'FAIL'} {'divider names a folder':<22} {marks} "
          "the one slide whose whole job is naming one")
    if not good:
        print(f"       <- {'refused: ' + said if not ok else 'the page lost the name'}")
    return 0 if good else 1


def the_chart_svg_carries_no_colour():
    """A chart is drawn without one colour in it, and the theme paints it.

    #213 ASKS FOR THIS BY NAME ("nenhum hex literal no SVG gerado"), and the
    way it is kept is structural rather than watched: compiler/charts.py emits
    geometry and class names, compiler/stage.html binds each class to a token.
    This case is what would notice the day somebody found it easier to write
    the colour into the mark -- the deck would still build, still render, and
    quietly wear `base` in every theme.
    """
    ok, said, page = _run(CHARTS_SOURCE)
    plots = PLOT.findall(page or "")
    stained = [p for p in plots if STAIN.search(p)]
    good = ok and len(plots) >= 6 and not stained
    marks = f"[{'+' if ok else '-'}{'+' if plots and not stained else '-'}]"
    print(f"  {'ok  ' if good else 'FAIL'} {'chart wears no paint':<22} {marks} "
          f"{len(plots)} drawn charts, and not one colour written into them")
    if not good:
        if not ok:
            print(f"       <- refused: {said}")
        elif len(plots) < 6:
            print(f"       <- only {len(plots)} <svg class=\"plot\"> on the built page")
        else:
            print(f"       <- a colour reached the SVG: {STAIN.search(stained[0]).group(0)}")
    return 0 if good else 1


def main():
    missing = [
        os.path.relpath(path, SKILL)
        for path, text in (
            (STATEMENT, STATEMENT_SOURCE),
            (FEW_WORDS, FEW_WORDS_SOURCE),
            (EVIDENCE, EVIDENCE_SOURCE),
            (SIDE_BY_SIDE, SIDE_BY_SIDE_SOURCE),
            (CHARTS, CHARTS_SOURCE),
        )
        if text is None
    ]
    if missing:
        return Proof("the compiler's checks", lambda k: k, None, None, None).refuse(
            f"put a source back under {', '.join(missing)} — with no real example "
            "there is no control, and a proof with no control measures its own "
            "author"
        )

    failed = block("the vocabulary ruler", STATEMENT_SOURCE, [
        (
            "foreign class",
            "a class the catalog never declared",
            swap(STATEMENT_SOURCE, 'class="statement"', 'class="highlight"'),
            'drop the class "highlight"',
        ),
        (
            "unknown pattern",
            "a pattern the catalog never declared",
            swap(STATEMENT_SOURCE, 'pattern="full-bleed-statement"',
                 'pattern="mega-cover"'),
            'replace the pattern "mega-cover"',
        ),
        (
            "missing slot",
            "the pattern's required slot taken away",
            cut(STATEMENT_SOURCE, r'<p class="statement">.*?</p>', "the statement slot"),
            'add the missing <p class="statement">',
        ),
        (
            "smuggled geometry",
            "a size typed into the source as an attribute",
            swap(STATEMENT_SOURCE, "<strong>", '<strong style="font-size:9px">'),
            "drop style= from the <strong>",
        ),
    ], width=22)

    print()
    failed += block("the doctrine rulers", STATEMENT_SOURCE, [
        (
            "budget over",
            "thirty words where the pattern budgets twelve",
            swap(STATEMENT_SOURCE,
                 "Nenhuma suíte verde substitui a <strong>primeira fileira</strong> "
                 "lendo o slide projetado.",
                 THIRTY_WORDS),
            "cut the slide to 12 words",
        ),
    ], width=22)

    print()
    failed += block("the doctrine rulers, over a deck", FEW_WORDS_SOURCE, [
        (
            "category title",
            "the biggest type on the stage naming a folder",
            swap(FEW_WORDS_SOURCE, "Um slide diz uma coisa", "Próximos passos"),
            'rewrite "Próximos passos" as a claim',
        ),
        (
            "pattern twice in a row",
            "a second divider right after the first",
            swap(FEW_WORDS_SOURCE, DIVIDER, DIVIDER + "\n\n" + DIVIDER),
            "give this slide another pattern",
        ),
    ], width=22)

    print()
    failed += block("the group and table rulers", EVIDENCE_SOURCE, [
        (
            "table over the ceiling",
            "a header plus six data rows -- seven lines, one over the ceiling",
            swap(EVIDENCE_SOURCE, TABLE_BODY, TABLE_BODY_SIX),
            "drop 1 <tr>",
        ),
        (
            "table with no header",
            "the <thead> taken away",
            cut(EVIDENCE_SOURCE, r"\s*<thead>.*?</thead>", "the table's header"),
            "give the <table> exactly one <thead>",
        ),
        (
            "metrics under the floor",
            "one metric where the pattern needs two to four",
            swap(EVIDENCE_SOURCE, METRICS_UL, METRICS_UL_ONE),
            "add 1 more <li>",
        ),
        (
            "timeline under the floor",
            "two marks where the pattern needs three to six",
            swap(EVIDENCE_SOURCE, TIMELINE_OL, TIMELINE_OL_TWO),
            "add 1 more <li>",
        ),
        (
            "two moments at once",
            "two marks both claiming to be the present moment",
            swap(EVIDENCE_SOURCE, TIMELINE_OL, TIMELINE_OL_TWO_NOW),
            "keep `now` on at most one",
        ),
    ], width=24)

    print()
    failed += block("the compiler's refusals", STATEMENT_SOURCE, [
        (
            "no deck",
            "the element the whole source hangs from, gone",
            cut(STATEMENT_SOURCE, r"<deck\b[^>]*>", "its opening <deck> tag"),
            "wrap the whole source in a <deck",
        ),
        (
            "header field gone",
            "one of the five the header has to say",
            swap(STATEMENT_SOURCE, 'occasion="Retrospectiva de engenharia"', ""),
            "give the <deck> an occasion=",
        ),
        (
            "attribute with no value",
            "a header field written but never answered",
            swap(STATEMENT_SOURCE, 'title="A régua e a plateia"', "title"),
            "give the <deck> a title=",
        ),
        (
            "theme not carried",
            "a theme the skill does not have on disk",
            swap(STATEMENT_SOURCE, 'theme="base"', 'theme="panlabs"'),
            "build with a theme this skill carries",
        ),
    ], width=22)

    print()
    failed += block("the closed inline vocabulary (#211)", SIDE_BY_SIDE_SOURCE, [
        (
            "foreign tag",
            "<em>, which no longer belongs to the closed set",
            swap(SIDE_BY_SIDE_SOURCE, "<mark>bastam</mark>", "<em>bastam</em>"),
            "drop the <em>",
        ),
        (
            "break not permitted",
            "a forced break inside a pattern that never declared allow_break",
            swap(SIDE_BY_SIDE_SOURCE, "um catálogo que", "um catálogo<br/>que"),
            "does not permit a forced break",
        ),
        (
            "break not self-closed",
            "<br> left open, swallowing the text that follows it",
            swap(SIDE_BY_SIDE_SOURCE, "depois:<br/>caixa", "depois:<br>x</br>caixa"),
            "self-close the <br/>",
        ),
    ], width=22)

    print()
    failed += block("the list ceiling (#211)", SIDE_BY_SIDE_SOURCE, [
        (
            "sixth item",
            "a sixth icon+text pair, past the five the register declares",
            swap(
                SIDE_BY_SIDE_SOURCE,
                '<p class="item-5-text">A licença mora ao lado do sprite, em themes/base/icons.</p>',
                '<p class="item-5-text">A licença mora ao lado do sprite, em themes/base/icons.</p>\n'
                '    <p class="item-6-icon">star</p>\n'
                '    <p class="item-6-text">Um sexto item que o catálogo nunca declarou.</p>',
            ),
            'drop the class "item-6-icon"',
        ),
    ], width=22)

    print()
    failed += block("the icon-known ruler (#211)", SIDE_BY_SIDE_SOURCE, [
        (
            "unknown icon",
            "a name the vendored Lucide set never shipped",
            swap(SIDE_BY_SIDE_SOURCE, ">circle-check<", ">circle-checkmark<"),
            'replace the icon "circle-checkmark"',
        ),
    ], width=22)

    print()
    failed += block("the icon-paired ruler (#211)", SIDE_BY_SIDE_SOURCE, [
        (
            "icon without its text",
            "an item's icon left in, its text taken away",
            cut(SIDE_BY_SIDE_SOURCE,
                r'\s*<p class="item-3-text">[^<]*</p>\n', "item-3-text"),
            'add the missing <p class="item-3-text">',
        ),
        (
            "text without its icon",
            "an item's text left in, its icon taken away",
            cut(SIDE_BY_SIDE_SOURCE,
                r'\s*<p class="item-3-icon">[^<]*</p>\n', "item-3-icon"),
            'add the missing <p class="item-3-icon">',
        ),
    ], width=22)

    print()
    failed += block("the chart's dialect (#213)", CHARTS_SOURCE, [
        (
            "form not declared",
            "a chart drawn in a shape the register never carried",
            swap(CHARTS_SOURCE, 'type="bars-h"', 'type="donut"'),
            'replace the type "donut"',
        ),
        (
            "no form at all",
            "a chart that never says what it is drawn as",
            swap(CHARTS_SOURCE, '<section pattern="chart" type="bars-h">',
                 '<section pattern="chart">'),
            "give the <section> a type=",
        ),
        (
            "over the form's ceiling",
            "seven bars where bars-h takes six, and the group would take twelve",
            swap(CHARTS_SOURCE, BARS_UL, BARS_UL_SEVEN),
            "drop 1 <li>",
        ),
        (
            "under the form's floor",
            "two points where a line needs three",
            swap(CHARTS_SOURCE, LINE_UL, LINE_UL_TWO),
            "add 1 more <li>",
        ),
        (
            "same form twice over",
            "a second bars-h right after the first",
            swap(CHARTS_SOURCE, BARS_SLIDE, BARS_SLIDE + "\n\n" + BARS_SLIDE),
            "give this slide another type",
        ),
        (
            "emphasis on drawn text",
            "a bold inside a label that reaches the page as a drawing",
            swap(CHARTS_SOURCE, '<p class="label">Checkout</p>',
                 '<p class="label"><strong>Checkout</strong></p>'),
            "drop the <strong>",
        ),
    ], width=24)

    print()
    failed += block("the chart's numbers (#213)", CHARTS_SOURCE, [
        (
            "value is not a number",
            "the unit typed into the value, where the number belongs alone",
            swap(CHARTS_SOURCE, '<p class="value">6</p>', '<p class="value">6 min</p>'),
            'write the value of "Checkout" as digits',
        ),
        (
            "value below the axis",
            "a negative where no form draws a mark",
            swap(CHARTS_SOURCE, '<p class="value">6</p>', '<p class="value">-6</p>'),
            'write the value of "Checkout" as a positive number',
        ),
        (
            "label with no value",
            "a point named and never measured",
            cut(CHARTS_SOURCE, r'<p class="value">6</p>', "the first bar's value"),
            'add the missing <p class="value">',
        ),
        (
            "value field left empty",
            "the field written, named, and never answered",
            swap(CHARTS_SOURCE, '<p class="value">6</p>', '<p class="value"></p>'),
            'write something in the <p class="value">',
        ),
        (
            "label field left empty",
            "a mark with a number and no name",
            swap(CHARTS_SOURCE, '<p class="label">Checkout</p>', '<p class="label"></p>'),
            'write something in the <p class="label">',
        ),
        (
            "share short of a hundred",
            "three slices adding up to ninety-five",
            swap(CHARTS_SOURCE, SHARE_UL, SHARE_UL_SHORT),
            "make the values add up to 100",
        ),
        (
            "a marked slice",
            "the accent spent on one slice of a bar that is already all colour",
            swap(CHARTS_SOURCE, SHARE_UL, SHARE_UL_MARKED),
            "drop `mark` from the <li>",
        ),
        (
            "label with no room",
            "a name three times the width the column gives it",
            swap(CHARTS_SOURCE, '<p class="label">Jan</p>',
                 '<p class="label">Infraestrutura de dados</p>'),
            'shorten the label "Infraestrutura de dados"',
        ),
    ], width=24)

    print()
    failed += block("the dated legend (#213)", CHARTS_SOURCE, [
        (
            "source with no date",
            "where the number came from, and never when",
            swap(CHARTS_SOURCE, "esteira de CI · jun/2026", "esteira de CI"),
            "add the year the data is from",
        ),
        (
            "no source at all",
            "a chart citing nothing",
            cut(CHARTS_SOURCE, r'\s*<p class="source">esteira de CI[^<]*</p>',
                "the first chart's source"),
            'add the missing <p class="source">',
        ),
        (
            "source left empty",
            "the legend written, named, and saying nothing",
            swap(CHARTS_SOURCE, '<p class="source">esteira de CI · jun/2026</p>',
                 '<p class="source"></p>'),
            'write something in the <p class="source">',
        ),
    ], width=24)

    print()
    print("and the four that demand green:  [built kept]")
    failed += the_page_is_not_a_template()
    failed += the_category_is_the_whole_title()
    failed += the_divider_may_name_the_arc()
    failed += the_chart_svg_carries_no_colour()
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
