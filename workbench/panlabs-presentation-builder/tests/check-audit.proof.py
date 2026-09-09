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

TWO GROUNDS, BECAUSE A PLANT NEEDS SOMETHING TO PLANT INTO. Until #219 the
tree carried seven small decks, one per ticket, and each block here planted
into whichever of them happened to hold its construct. #219 collapsed the
seven into the two the spec asks for -- one per theme, covering the eighteen
patterns between them -- and every needle below is now aimed at one of those
two. Which one is decided by what the deck HOLDS and never by which is
shorter: `proposal` is the deck of words, and carries the dialect's own
rulers, the doctrine's, the notes, the fragments and the one drawn figure
whose colours a header can still be held to; `canonical` is the deck of
numbers, and carries every group, every chart form, the imported picture and
the scale of moments a deck of six charts is under.

AND THE CASES AT THE BOTTOM DEMAND GREEN, because a check can also be wrong
by firing. `fill()` used to hunt for leftover `{{NAME}}` markers AFTER
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
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from proof_driver import Drifted, Proof, cut, read, swap               # noqa: E402

SKILL = os.path.abspath(os.path.join(HERE, "..", "..", "..",
                                     "skills", "panlabs-presentation-builder"))
BUILD = os.path.join(SKILL, "compiler", "build.py")
PROPOSAL = os.path.join(SKILL, "examples", "proposal.deck.html")
CANONICAL = os.path.join(SKILL, "examples", "canonical.deck.html")

# THE ONE FIXTURE THAT IS NOT TEXT. Both decks are entirely readable as a
# string; the canonical one points at a picture, and half of what #214 asks be
# refused is a fact about that FILE rather than about the deck naming it.
CAPTURE = os.path.join(SKILL, "examples", "capture.png")


PROPOSAL_SOURCE = read(PROPOSAL)
CANONICAL_SOURCE = read(CANONICAL)


def _read_bytes(path):
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except OSError:
        return None


CAPTURE_NAME = os.path.basename(CAPTURE)
CAPTURE_BYTES = _read_bytes(CAPTURE)


def _run(text, assets=(), theme=None):
    """Run THE DOCUMENTED COMMAND over a source; return verdict, words, page.

    Not `import build` -- the thing being proved is the command a human and an
    agent are told to run. A proof that reached past it into the library would
    be green about a compiler nobody invokes.

    A DECK THAT POINTS AT A FILE TRAVELS WITH IT (#214). The compiler resolves
    an `<img src=…>` against the directory the SOURCE was read from, so a
    planted copy in a temp directory needs the picture written beside it --
    which is exactly the shape a real caller's own project has.
    """
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    with tempfile.TemporaryDirectory(prefix="panlabs-audit-proof-") as tmp:
        src = os.path.join(tmp, "planted.deck.html")
        out = os.path.join(tmp, "out.html")
        with open(src, "w", encoding="utf-8") as fh:
            fh.write(text)
        for name, payload in assets:
            with open(os.path.join(tmp, name), "wb") as fh:
                fh.write(payload)
        argv = [sys.executable, BUILD, src, out]
        if theme:
            argv += ["--theme", theme]
        done = subprocess.run(
            argv, capture_output=True, text=True, env=env, cwd=SKILL,
        )
        page = None
        if os.path.exists(out):
            with open(out, encoding="utf-8") as fh:
                page = fh.read()
        # THE STORYBOARD IS READ INSIDE THE TEMP DIRECTORY OR NOT AT ALL (#217).
        # `build.py` writes it beside the page, and the directory goes away with
        # this `with`; a caller that wanted to open it afterwards would be asking
        # for a file the proof has already deleted.
        board = None
        beside = os.path.splitext(out)[0] + ".storyboard.md"
        if os.path.exists(beside):
            with open(beside, encoding="utf-8") as fh:
                board = fh.read()
        return (done.returncode == 0, (done.stdout + done.stderr).strip(),
                page, board)


def build(text, assets=(), theme=None):
    ok, said, _, _ = _run(text, assets, theme)
    return ok, said


def block(title, real, cases, width, theme=None, assets=()):
    """One fixture's worth of cases, sharing one green control.

    THE CONTROL IS BUILT ONCE PER BLOCK, not once per case, and the reason is
    measured: every successful build hands the page to `gate/render.cjs`, which
    launches a Chromium (#209) -- so a block of six cases used to pay six
    browser launches to re-derive a result that cannot differ between them.
    `check-render.proof.cjs` states the same rule in its own header. What the
    assertion needs is that the unplanted source is green, and one run answers
    that for every case that shares the source.

    `theme=` BUILDS THE WHOLE BLOCK IN A THEME THE SOURCE DOES NOT DECLARE
    (#216). `theme-repertoire` is the first ruler whose verdict depends on
    which identity the deck is wearing -- `base` paints with the machine's own
    faces and promises no repertoire, `panlabs` ships two cut faces and
    promises 159 characters -- so a block that could only build in the header's
    own theme could not reach it at all.

    `assets=` WRITES THE FILES THE DECK POINTS AT BESIDE THE PLANTED COPY
    (#219). Until the corpus became two decks, every block here planted into a
    source that was pure text, and the one deck naming a picture had a block
    shape of its own. The canonical deck names one AND carries every group and
    every chart form, so the blocks that plant into it are ordinary blocks that
    happen to need the picture on disk -- and without it the GREEN CONTROL goes
    red on `figure-asset`, which is a whole block failing over a file nobody
    planted. `figure_block` below stays separate, because its own cases plant
    into the BYTES.
    """
    settled = []

    def control(_key):
        if not settled:
            settled.append(build(real, assets, theme=theme))
        return settled[0]

    return Proof(
        title=title,
        label=lambda key: key,
        invoke=lambda key, payload: build(payload, assets, theme=theme),
        planted=lambda payload: payload != real,
        control=control,
        width=width,
    ).run(cases)


# ── the figure deck, whose payload is a source AND the files beside it (#214) ──
# THE PLANT IS NOT ALWAYS IN THE TEXT. Two of the cases below leave the deck
# untouched and change the BYTES of the picture it points at -- a file over the
# ceiling, a file that is not the format its own name promised -- and a
# `planted` assertion comparing only the source would report "the plant changed
# nothing" for exactly the two defects that live on disk. Carrying both halves
# as one payload is what keeps all four of ADR 0001's assertions real.

GOOD_ASSETS = ((CAPTURE_NAME, CAPTURE_BYTES),)
REAL_FIGURE = (CANONICAL_SOURCE, GOOD_ASSETS)


def in_source(plant):
    """A plant that changes the deck's words and leaves the files alone."""
    return lambda: (plant(), GOOD_ASSETS)


def in_file(payload):
    """A plant that leaves the deck's words alone and changes the file itself."""
    return lambda: (CANONICAL_SOURCE, ((CAPTURE_NAME, payload),))


def figure_block(title, cases, width):
    settled = []

    def control(_key):
        if not settled:
            settled.append(build(*REAL_FIGURE))
        return settled[0]

    return Proof(
        title=title,
        label=lambda key: key,
        invoke=lambda key, payload: build(payload[0], payload[1]),
        planted=lambda payload: payload != REAL_FIGURE,
        control=control,
        width=width,
    ).run(cases)


# ── #217's needles: the art direction, and the arc it promises ───────────────
# THE HEADER'S SECOND HALF, EXACTLY AS THE PROPOSAL DECK WRITES IT. Every case
# that plants into the header plants into this block, so it is spelled out once
# and held to the file by `swap`'s own drift check rather than rebuilt from
# parts.
DIRECTION = """  <direction>
    <p class="cover">cover-headline</p>
    <p class="signature">a hairline em pé, entre dois lados, repetida em todo slide que divide o palco</p>
    <p class="register">primeira pessoa do plural, presente, uma oração por frase</p>
    <p class="moments">sober</p>
    <p class="difference">o exemplo canônico abre por um número e assina com a hairline deitada na base do palco; este abre pela manchete e assina com a hairline em pé, no meio dele</p>
    <p class="content-1">a fila do que foi pedido, que anda toda semana</p>
    <p class="content-2">a fila do que está gasto, que só anda quando quebra</p>
    <p class="renounced-1">chart</p>
    <p class="renounced-2">table</p>
    <p class="renounced-3">timeline</p>
  </direction>"""


def the_header_last():
    """The art direction moved from the top of the deck to the bottom of it.

    IT IS THE ONE PLANT THAT CANNOT BE A SUBSTITUTION. Every other case here
    changes what the header SAYS; this one changes only where it is, and a
    `swap` has no way to express that -- so the block is cut from the front and
    put back at the end, which is exactly the mistake an author makes by writing
    the slides first and the direction afterwards.
    """
    if PROPOSAL_SOURCE is None:
        raise Drifted("the fixture is not readable")
    if DIRECTION + "\n\n" not in PROPOSAL_SOURCE:
        raise Drifted("the proposal deck no longer opens on the direction block")
    return (PROPOSAL_SOURCE
            .replace(DIRECTION + "\n\n", "", 1)
            .replace("\n</deck>", "\n" + DIRECTION + "\n\n</deck>", 1))


# The proposal deck's only moment, and the same thing said by a pattern that is
# not one. #207 counts a moment as a drawn figure, a chart or a full-bleed
# statement, so a thesis title saying what the drawing showed takes the deck to
# ZERO -- which no scale admits, and which is the floor's whole point.
#
# THE PROPOSAL DECK HOLDS EXACTLY ONE MOMENT, AND THAT IS WHY THIS CASE CAN
# EXIST (#219). A deck with two of them cannot be brought to none by a single
# plant, and a plant that changed two slides at once would be proving that two
# defects together go red.
PROPOSAL_MOMENT = """  <section pattern="figure-caption" arc="tension">
    <p class="title">Uma fila anda; a outra para no primeiro dia</p>
    <p class="caption">As duas filas da semana, desenhadas — a de cima entrega, a de baixo espera quebrar</p>
    <svg viewBox="0 0 1200 400">
      <text x="14" y="58" font-size="32" text-anchor="start" dominant-baseline="central" fill="var(--content-1)">o que foi pedido</text>
      <rect x="14" y="96" width="1154" height="12" rx="6" fill="var(--content-1)"/>
      <circle cx="1168" cy="102" r="18" fill="var(--content-1)"/>

      <text x="14" y="248" font-size="32" text-anchor="start" dominant-baseline="central" fill="var(--content-2)">o que está gasto</text>
      <rect x="14" y="286" width="222" height="12" rx="6" fill="var(--content-2)"/>
      <circle cx="250" cy="292" r="18" fill="none" stroke="var(--content-2)" stroke-width="4"/>
      <line x1="276" y1="292" x2="1168" y2="292" stroke="var(--hairline-strong)" stroke-width="4" stroke-dasharray="14 12"/>
      <text x="1168" y="352" font-size="30" text-anchor="end" dominant-baseline="central" fill="var(--ink-muted)">até quebrar</text>
    </svg>
    <notes>Este é o único momento do deck, e a escala declarada no cabeçalho diz «sober» — um ou dois é o que cabe nela.<br/>É também o único slide que gasta as duas cores de conteúdo, e o cabeçalho diz o que cada uma significa.</notes>
  </section>"""

PROPOSAL_NO_MOMENT = """  <section pattern="thesis-title" arc="tension">
    <p class="title">Uma fila anda; a outra para no primeiro dia</p>
    <p class="sentence">As duas filas da semana, e a que nunca começa é a que cobra depois.</p>
  </section>"""

# The proposal deck's closing, minus its notes. Planting a SECOND copy of it
# before the divider is what makes a deck that asks for something and then keeps
# talking -- the one shape of broken closing that a deck with a perfectly good
# last slide can still have.
PROPOSAL_CLOSING = """  <section pattern="closing-call" arc="call">
    <p class="thesis">Uma hora reservada custa menos que o dia que ela evita.</p>
    <p class="call">Aprovem a terça de manhã, a partir da próxima semana.</p>
    <p class="meta">Revisão em três meses</p>
  </section>"""


# The whole of the sixth slide of the proposal deck, as its source writes it.
# The repeated-pattern ruler is the one check that cannot be planted by
# changing a slide: it needs a SECOND slide of the same pattern next to the
# first, and duplicating a section that is valid on its own is what makes the
# repetition the only thing red.
DIVIDER = """  <section pattern="section-divider" arc="evidence">
    <p class="index">02</p>
    <p class="title">O que a hora compra</p>
  </section>"""

# Thirty words where the pattern budgets twelve -- the ticket's own number
# (#210), counted the way the ruler counts: a whitespace token with a letter
# or a digit in it.
THIRTY_WORDS = (
    "Uma suíte verde, rodada de ponta a ponta na máquina de quem escreveu o "
    "deck, não prova nada sobre o que a última fileira da sala ainda lê no "
    "telão."
)

# Every group and table `canonical.deck.html` carries, exactly as its source
# writes them -- the needles the cases below plant against and the ground
# the "row dropped" / "item dropped" cases below cut into. #212's own
# acceptance criteria name three of these numbers verbatim: seven lines in a
# table, one item in the metrics, two marks in the timeline.
METRICS_UL = """    <ul>
      <li><p class="value">9</p><p class="label">equipes</p></li>
      <li><p class="value">1310</p><p class="label">entregas</p></li>
      <li><p class="value">3,4×</p><p class="label">frequência</p></li>
    </ul>"""

METRICS_UL_ONE = """    <ul>
      <li><p class="value">9</p><p class="label">equipes</p></li>
    </ul>"""

TIMELINE_OL = """    <ol>
      <li><p class="label">Piloto</p><p class="date">Fev/26</p></li>
      <li><p class="label">Cinco equipes</p><p class="date">Jun/26</p></li>
      <li now><p class="label">Nove equipes</p><p class="date">Dez/26</p></li>
      <li><p class="label">Toda a casa</p><p class="date">Set/27</p></li>
    </ol>"""

TIMELINE_OL_TWO = """    <ol>
      <li><p class="label">Piloto</p><p class="date">Fev/26</p></li>
      <li><p class="label">Cinco equipes</p><p class="date">Jun/26</p></li>
    </ol>"""

TIMELINE_OL_TWO_NOW = """    <ol>
      <li now><p class="label">Piloto</p><p class="date">Fev/26</p></li>
      <li now><p class="label">Cinco equipes</p><p class="date">Jun/26</p></li>
      <li><p class="label">Nove equipes</p><p class="date">Dez/26</p></li>
      <li><p class="label">Toda a casa</p><p class="date">Set/27</p></li>
    </ol>"""

TABLE_BODY = """        <tr><td>Cartografia</td><td>9 h</td><td>3 h</td></tr>
        <tr><td>Correnteza</td><td>14 h</td><td>5 h</td></tr>
        <tr><td>Âncora</td><td>21 h</td><td>9 h</td></tr>
        <tr><td>Farol</td><td>6 h</td><td>2 h</td></tr>"""

# Six data rows plus the header is seven lines of a table -- one over #212's
# own ceiling ("tabela de sete linhas ... reprovam").
TABLE_BODY_SIX = "\n".join(
    f'        <tr><td>Squad {n}</td><td>{n} min</td><td>{n - 1} min</td></tr>'
    for n in range(1, 7)
)

# #213'S OWN NEEDLES. The canonical deck's first chart is a `bars-h` of five
# points, its third a `line` of four, and its last a `share` of three -- which
# is what lets the cases below plant a count against the FORM's bounds rather
# than the group's. `bars-h` allows six and the group allows twelve, so a
# seventh bar is refused by the form alone: that difference is the whole reason
# a form carries a pair of numbers of its own.
BARS_UL = """    <ul>
      <li><p class="label">Cartografia</p><p class="value">3</p></li>
      <li><p class="label">Correnteza</p><p class="value">5</p></li>
      <li><p class="label">Bússola</p><p class="value">4</p></li>
      <li mark><p class="label">Âncora</p><p class="value">9</p></li>
      <li><p class="label">Farol</p><p class="value">2</p></li>
    </ul>"""

BARS_UL_SEVEN = "    <ul>\n" + "\n".join(
    f'      <li><p class="label">Squad {n}</p><p class="value">{n}</p></li>'
    for n in range(1, 8)
) + "\n    </ul>"

LINE_UL = """    <ul>
      <li><p class="label">1º tri</p><p class="value">48</p></li>
      <li><p class="label">2º tri</p><p class="value">31</p></li>
      <li><p class="label">3º tri</p><p class="value">19</p></li>
      <li mark><p class="label">4º tri</p><p class="value">8</p></li>
    </ul>"""

LINE_UL_TWO = """    <ul>
      <li><p class="label">1º tri</p><p class="value">48</p></li>
      <li><p class="label">2º tri</p><p class="value">31</p></li>
    </ul>"""

# Every value written and legal, and they add up to 95 -- the one defect is
# arithmetic, which is exactly the class #94 measured a hand getting wrong.
SHARE_UL = """    <ul>
      <li><p class="label">Manutenção</p><p class="value">50</p></li>
      <li><p class="label">Novas equipes</p><p class="value">30</p></li>
      <li><p class="label">Plataforma</p><p class="value">20</p></li>
    </ul>"""

SHARE_UL_SHORT = SHARE_UL.replace(
    '<p class="value">30</p>', '<p class="value">25</p>')

SHARE_UL_MARKED = SHARE_UL.replace(
    '<li><p class="label">Manutenção</p>', '<li mark><p class="label">Manutenção</p>')

# The whole first chart slide of the canonical deck, so a second copy of it can
# be put next to the first -- the only way to plant a repetition, same as the
# divider above.
BARS_SLIDE = """  <section pattern="chart" type="bars-h" arc="evidence">
    <p class="title">Cinco equipes cortaram a espera pela metade</p>
    <p class="unit">horas entre o merge e a produção, mediana</p>
    <p class="source">painel do Estaleiro · dez/2026</p>
""" + BARS_UL + """
    <notes>A Âncora está marcada porque é a que ainda não caiu: é dela que o plano do próximo ano trata.</notes>
  </section>"""

# #214'S OWN NEEDLES, all from the canonical deck's one drawing. The dot on the
# bracket is the one shape a whole element can be swapped for without touching
# anything the other cases plant into, so the three cases that need to REPLACE
# an element share it.
DOT = '<circle cx="296" cy="294" r="10" fill="var(--content-1)"/>'
ARROWHEAD = '<polygon points="316,111 336,122 316,133" fill="var(--accent)"/>'
FIRST_BOX = ('<rect x="14" y="46" width="242" height="152" rx="16" fill="none" '
             'stroke="var(--hairline-strong)" stroke-width="4"/>')
CYCLE_BOX = 'viewBox="0 0 1200 400"'
CAPTURE_SRC = 'src="capture.png"'

# One byte over the ceiling `Figure.max_bytes` declares in compiler/catalog.py,
# and it opens with a real PNG signature so that SIZE is the only thing wrong
# with it. If that ceiling ever moves, this case stops planting a defect and
# fails as "stayed GREEN" -- the proof catching its own rot, which is the
# outcome worth having over a plant that silently measures nothing.
OVER_CEILING = b"\x89PNG\r\n\x1a\n" + b"\0" * (2 * 1024 * 1024 + 1)

# A real GIF, under a name that promises a PNG: every other check passes and
# the browser decodes nothing, which is the blank rectangle by another road.
WRONG_FORMAT = b"GIF89a" + b"\0" * 64

# #215'S OWN NEEDLE. The cover slide's note, exactly as the proposal deck
# writes it -- the one string every notes case below plants against. It is a
# whole `<notes>` element and not a phrase inside one, because three of the
# four cases (empty, doubled, attributed) are about the ELEMENT and there is
# nothing smaller to cut for them.
PROPOSAL_NOTE = (
    "<notes>Abra dizendo que o pedido é <strong>uma hora</strong>, e que o "
    "resto do deck é a conta dessa hora.<br/>A palavra «oficina» é deliberada: "
    "não é reunião, não é cerimônia, é gente consertando coisa.</notes>"
)

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
    if PROPOSAL_SOURCE is None:
        print(f"  FAIL {'setup':<22} no example to plant in")
        return 1

    planted = PROPOSAL_SOURCE.replace("O reparo que ninguém agenda",
                                       "O {{TITLE}} que ninguém agenda", 1)
    ok, said, page, _ = _run(planted)
    kept = bool(page) and "O {{TITLE}} que ninguém agenda" in page
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
    if PROPOSAL_SOURCE is None:
        print(f"  FAIL {'setup':<22} no example to plant in")
        return 1

    planted = PROPOSAL_SOURCE.replace(
        "Três coisas cabem numa hora",
        "A visão geral do time falhou em três semanas", 1)
    ok, said, page, _ = _run(planted)
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
    if PROPOSAL_SOURCE is None:
        print(f"  FAIL {'setup':<22} no example to plant in")
        return 1

    planted = PROPOSAL_SOURCE.replace(
        "<p class=\"title\">O que a hora compra</p>",
        "<p class=\"title\">Contexto</p>", 1)
    ok, said, page, _ = _run(planted)
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
    ok, said, page, _ = _run(CANONICAL_SOURCE, GOOD_ASSETS)
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


DRAWN = re.compile(r'<svg class="figure".*?</svg>', re.S)
IMPORTED = re.compile(r'<img class="figure"[^>]*>')
PAINT = re.compile(r'\b(?:fill|stroke)="([^"]*)"')
THEME_TOKEN = re.compile(r"^var\(--[a-z0-9-]+\)$")


def the_figure_wears_only_the_theme():
    """A built figure carries tokens and no colour, and the picture is inline.

    #214 ASKS FOR BOTH BY NAME -- "pintado só com as variáveis do tema" and
    "imagem por caminho é embutida" -- and the cases above prove the compiler
    knows how to refuse the opposite. This is the other half: that the deck
    this skill actually SHIPS is painted that way and really did turn its path
    into bytes on the page. A red here is not a broken check, it is a corpus
    that stopped being an example of the thing it demonstrates.
    """
    ok, said, page, _ = _run(CANONICAL_SOURCE, GOOD_ASSETS)
    # HOW MANY DRAWINGS THE DECK HAS IS THE DECK'S BUSINESS, so the expected
    # count is read off the source rather than written here: a case that had to
    # be edited every time an example gained a figure is a case somebody
    # eventually edits by lowering the number.
    expected = (CANONICAL_SOURCE or "").count("<svg viewBox=")
    drawings = DRAWN.findall(page or "")
    stray = [v for d in drawings for v in PAINT.findall(d)
             if v != "none" and not THEME_TOKEN.match(v)]
    pictures = IMPORTED.findall(page or "")
    inline = bool(pictures) and all('src="data:image/png;base64,' in p for p in pictures)
    kept = (expected > 0 and len(drawings) == expected and not stray and inline
            and CAPTURE_SRC not in (page or ""))

    good = ok and kept
    marks = f"[{'+' if ok else '-'}{'+' if kept else '-'}]"
    print(f"  {'ok  ' if good else 'FAIL'} {'figure wears tokens':<22} {marks} "
          f"{len(drawings)} drawn in tokens, {len(pictures)} imported inline")
    if not good:
        if not ok:
            print(f"       <- refused: {said}")
        elif stray:
            print(f"       <- a colour reached the drawing: {stray[0]}")
        elif not inline:
            print("       <- the <img> did not become a data: URI")
        else:
            print(f"       <- expected {expected} drawings on the page, found {len(drawings)}")
    return 0 if good else 1


# One sentence out of the proposal deck's first note, and the `<section>` a
# built slide is written as. What the case below asks is where the first one
# ended up relative to the second.
NOTE_PHRASE = "é gente consertando coisa"
SLIDE = re.compile(r'<section class="slide.*?</section>', re.S)


def the_notes_never_reach_the_stage():
    """The note is on the page, in the panel, and inside no slide at all.

    #207 ASKS FOR THIS IN ONE SENTENCE ("para o detalhe ficar comigo e não na
    tela da plateia"), and it is the one promise in this ticket that a green
    audit says nothing about: a note emitted into the `<section>` and hidden
    by a rule would pass every ruler in the file and be one stylesheet
    mistake -- or one `Ctrl+A` in a browser -- away from the projector. The
    assertion is therefore about PLACE and not about paint. The motion
    profile is checked in the same breath because it travels the same way: a
    field of the header that has to reach the built page to mean anything.
    """
    ok, said, page, _ = _run(PROPOSAL_SOURCE)
    page = page or ""
    in_panel = '<div class="note" data-note-for="1"' in page and NOTE_PHRASE in page
    on_stage = any(NOTE_PHRASE in slide for slide in SLIDE.findall(page))
    wearing = 'data-motion="editorial"' in page
    good = ok and in_panel and not on_stage and wearing
    marks = f"[{'+' if ok else '-'}{'+' if in_panel and not on_stage and wearing else '-'}]"
    print(f"  {'ok  ' if good else 'FAIL'} {'notes off the stage':<22} {marks} "
          "the note reaches the panel, and no <section> on the page carries it")
    if not good:
        if not ok:
            print(f"       <- refused: {said}")
        elif on_stage:
            print("       <- the note is inside a <section class=\"slide\">")
        elif not in_panel:
            print("       <- no <div class=\"note\"> on the page carries the note")
        else:
            print("       <- the page never says data-motion=\"editorial\"")
    return 0 if good else 1


def the_theme_may_not_invent_a_token():
    """A theme declaring a name `base` never did, and the build refuses it.

    #207 asks that creating a theme cost "uma folha de tokens ... com toda a
    estrutura herdada de `base`", and the refusal is what makes that true
    rather than customary: a token only one theme sets is a token no pattern
    paints with, and the sheet that set it would be green forever while its
    one colour went nowhere. It is not an audit ruler -- there is no deck to
    read -- so it plants a THEME rather than a source, into a copy of the
    tree, and runs the documented command against the copy.
    """
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    with tempfile.TemporaryDirectory(prefix="panlabs-theme-token-") as tmp:
        shutil.copytree(os.path.join(SKILL, "compiler"), os.path.join(tmp, "compiler"))
        shutil.copytree(os.path.join(SKILL, "themes", "base"),
                        os.path.join(tmp, "themes", "base"))
        os.makedirs(os.path.join(tmp, "themes", "stranger"))
        with open(os.path.join(tmp, "themes", "stranger", "tokens.css"), "w",
                  encoding="utf-8") as fh:
            fh.write(":root {\n  --accent: #123456;\n  --brand-blue: #1D6ABC;\n}\n")
        src = os.path.join(tmp, "planted.deck.html")
        with open(src, "w", encoding="utf-8") as fh:
            fh.write(PROPOSAL_SOURCE)
        done = subprocess.run(
            [sys.executable, os.path.join(tmp, "compiler", "build.py"), src,
             os.path.join(tmp, "out.html"), "--theme", "stranger"],
            capture_output=True, text=True, env=env, cwd=tmp,
        )
        said = (done.stdout + done.stderr).strip()

    red = done.returncode != 0
    says = "declare --brand-blue in themes/base/tokens.css" in said
    good = red and says
    marks = f"[{'+' if red else '-'}{'+' if says else '-'}]"
    print("a theme is a sheet of overrides (#216):  [red message]")
    print(f"  {'ok  ' if good else 'FAIL'} {'a token base lacks':<24} {marks} "
          "a theme declaring a name no other theme could paint with")
    if good:
        print(f"       red: {said}")
    else:
        print(f"       <- {said or 'said nothing at all'}")
    return 0 if good else 1


def the_unfaced_theme_promises_nothing():
    """The same arrow, built in `base`, and the build is green.

    `theme-repertoire` charges a repertoire the theme DECLARED, and `base`
    declares none: it paints with `system-ui` and its neighbours, whose
    coverage is a fact about the machine the deck is opened on. A ruler that
    fired here would be refusing a deck for a promise nobody made -- which is
    the way a check is wrong by firing rather than by staying quiet.
    """
    planted = PROPOSAL_SOURCE.replace("sem culpa.", "sem culpa →", 1)
    changed = planted != PROPOSAL_SOURCE
    ok, said = build(planted, theme="base")
    good = ok and changed
    marks = f"[{'+' if changed else '-'}{'+' if ok else '-'}]"
    print(f"  {'ok  ' if good else 'FAIL'} {'base charges nothing':<22} {marks} "
          "the same arrow, in the theme that ships no faces")
    if not good:
        print(f"       <- {'the plant changed nothing' if not changed else said}")
    return 0 if good else 1


# The two figure slides of the canonical deck, in the order the storyboard
# numbers them: the imported picture first, the drawing later.
PICTURE_ROW = "| 2 |"
DRAWING_ROW = "| 16 |"


def the_photograph_is_not_a_moment():
    """The canonical deck has two figure slides, and only the drawn one is a peak.

    THE PLANT CANNOT PROVE THIS ONE, WHICH IS WHY IT IS HERE. #207 counts "figura
    desenhada" as a moment and says nothing about a photograph, so the ruler
    settles the difference by reading the tag -- and a ruler that stopped reading
    it would count one moment more than the header declares, and refuse a deck
    whose art direction is exactly right. That failure has no needle: it is a red
    that should never happen, and the only way to hold it is to demand the green.

    IT IS ALSO WHERE THE STORYBOARD AND THE RULER ARE HELD TOGETHER. The page
    beside the deck marks the peaks the ruler counted, from the same list, so the
    assertion is made ROW BY ROW rather than on a total: the picture's row must
    not carry a peak and the drawing's must. A count would pass just as happily
    with the two the wrong way round.
    """
    ok, said, _, board = _run(CANONICAL_SOURCE, GOOD_ASSETS)
    figures = (CANONICAL_SOURCE or "").count('<section pattern="figure-caption"')
    rows = {r.split("|")[1].strip(): r for r in (board or "").splitlines()
            if r.startswith("| ")}
    picture = rows.get(PICTURE_ROW.strip("| "), "")
    drawing = rows.get(DRAWING_ROW.strip("| "), "")
    told = ("figure-caption" in picture and "figure-caption" in drawing
            and "· momento" not in picture and "· momento" in drawing)
    good = ok and figures == 2 and told
    marks = f"[{'+' if ok else '-'}{'+' if figures == 2 and told else '-'}]"
    print(f"  {'ok  ' if good else 'FAIL'} {'a picture is not a peak':<23} {marks} "
          f"{figures} figure slides, and only the drawn one counts as a moment")
    if not good:
        if not ok:
            print(f"       <- refused: {said}")
        elif figures != 2:
            print(f"       <- the fixture has {figures} figure slides, not 2")
        else:
            print(f"       <- the storyboard says {picture.strip()!r} and "
                  f"{drawing.strip()!r}")
    return 0 if good else 1


def main():
    missing = [
        os.path.relpath(path, SKILL)
        for path, text in (
            (PROPOSAL, PROPOSAL_SOURCE),
            (CANONICAL, CANONICAL_SOURCE),
            (CAPTURE, CAPTURE_BYTES),
        )
        if text is None
    ]
    if missing:
        return Proof("the compiler's checks", lambda k: k, None, None, None).refuse(
            f"put a source back under {', '.join(missing)} — with no real example "
            "there is no control, and a proof with no control measures its own "
            "author"
        )

    failed = block("the vocabulary ruler", PROPOSAL_SOURCE, [
        (
            "foreign class",
            "a class the catalog never declared",
            swap(PROPOSAL_SOURCE, 'class="question"', 'class="highlight"'),
            'drop the class "highlight"',
        ),
        (
            "unknown pattern",
            "a pattern the catalog never declared",
            swap(PROPOSAL_SOURCE, 'pattern="pivot-question"',
                 'pattern="mega-cover"'),
            'replace the pattern "mega-cover"',
        ),
        (
            "missing slot",
            "the pattern's required slot taken away",
            cut(PROPOSAL_SOURCE, r'<p class="question">.*?</p>', "the question slot"),
            'add the missing <p class="question">',
        ),
        (
            "smuggled geometry",
            "a size typed into the source as an attribute",
            swap(PROPOSAL_SOURCE, "<strong>uma hora</strong>",
                 '<strong style="font-size:9px">uma hora</strong>'),
            "drop style= from the <strong>",
        ),
    ], width=22)

    print()
    failed += block("the doctrine rulers", PROPOSAL_SOURCE, [
        (
            "budget over",
            "thirty words where the pattern budgets twelve",
            swap(PROPOSAL_SOURCE,
                 "Quando consertamos, pela última vez, algo pequeno?",
                 THIRTY_WORDS),
            "cut the slide to 12 words",
        ),
    ], width=22)

    print()
    failed += block("the doctrine rulers, over a deck", PROPOSAL_SOURCE, [
        (
            "category title",
            "the biggest type on the stage naming a folder",
            swap(PROPOSAL_SOURCE, "Três coisas cabem numa hora", "Próximos passos"),
            'rewrite "Próximos passos" as a claim',
        ),
        (
            "pattern twice in a row",
            "a second divider right after the first",
            swap(PROPOSAL_SOURCE, DIVIDER, DIVIDER + "\n\n" + DIVIDER),
            "give this slide another pattern",
        ),
    ], width=22)

    print()
    failed += block("the group and table rulers", CANONICAL_SOURCE, [
        (
            "table over the ceiling",
            "a header plus six data rows -- seven lines, one over the ceiling",
            swap(CANONICAL_SOURCE, TABLE_BODY, TABLE_BODY_SIX),
            "drop 1 <tr>",
        ),
        (
            "table with no header",
            "the <thead> taken away",
            cut(CANONICAL_SOURCE, r"\s*<thead>.*?</thead>", "the table's header"),
            "give the <table> exactly one <thead>",
        ),
        (
            "metrics under the floor",
            "one metric where the pattern needs two to four",
            swap(CANONICAL_SOURCE, METRICS_UL, METRICS_UL_ONE),
            "add 1 more <li>",
        ),
        (
            "timeline under the floor",
            "two marks where the pattern needs three to six",
            swap(CANONICAL_SOURCE, TIMELINE_OL, TIMELINE_OL_TWO),
            "add 1 more <li>",
        ),
        (
            "two moments at once",
            "two marks both claiming to be the present moment",
            swap(CANONICAL_SOURCE, TIMELINE_OL, TIMELINE_OL_TWO_NOW),
            "keep `now` on at most one",
        ),
    ], width=24, assets=GOOD_ASSETS)

    print()
    failed += block("the compiler's refusals", PROPOSAL_SOURCE, [
        (
            "no deck",
            "the element the whole source hangs from, gone",
            cut(PROPOSAL_SOURCE, r"<deck\b[^>]*>", "its opening <deck> tag"),
            "wrap the whole source in a <deck",
        ),
        (
            "header field gone",
            "one of the fields the header has to say",
            swap(PROPOSAL_SOURCE, 'occasion="Planejamento do trimestre"', ""),
            "give the <deck> an occasion=",
        ),
        (
            "attribute with no value",
            "a header field written but never answered",
            swap(PROPOSAL_SOURCE, 'title="Uma hora por semana para a oficina"', "title"),
            "give the <deck> a title=",
        ),
        # THE NEEDLE MOVED WHEN THE SECOND THEME LANDED (#216). This case used
        # to name `panlabs`, which was the obvious stranger while `base` was
        # the only theme on disk and is now one of the two real ones. It names
        # `corporate` instead, which #207 puts out of scope by name -- a theme
        # that is deliberately absent is the one kind of stranger that stays a
        # stranger.
        (
            "theme not carried",
            "a theme the skill does not have on disk",
            swap(PROPOSAL_SOURCE, 'theme="base"', 'theme="corporate"'),
            "build with a theme this skill carries",
        ),
    ], width=22)

    print()
    failed += block("the closed inline vocabulary (#211)", PROPOSAL_SOURCE, [
        (
            "foreign tag",
            "<em>, which no longer belongs to the closed set",
            swap(PROPOSAL_SOURCE, "<mark>mesma semana</mark>",
                 "<em>mesma semana</em>"),
            "drop the <em>",
        ),
        (
            "break not permitted",
            "a forced break inside a pattern that never declared allow_break",
            swap(PROPOSAL_SOURCE, "A gente nunca tem", "A gente<br/>nunca tem"),
            "does not permit a forced break",
        ),
        (
            "break not self-closed",
            "<br> left open, swallowing the text that follows it",
            swap(PROPOSAL_SOURCE, "manhã,<br/>na ordem", "manhã,<br>x</br>na ordem"),
            "self-close the <br/>",
        ),
    ], width=22)

    print()
    failed += block("the list ceiling (#211)", PROPOSAL_SOURCE, [
        (
            "sixth item",
            "a sixth icon+text pair, past the five the register declares",
            swap(
                PROPOSAL_SOURCE,
                '<p class="item-5-text" step>O que sobra volta para a fila, sem culpa.</p>',
                '<p class="item-5-text" step>O que sobra volta para a fila, sem culpa.</p>\n'
                '    <p class="item-6-icon">star</p>\n'
                '    <p class="item-6-text">Um sexto item que o catálogo nunca declarou.</p>',
            ),
            'drop the class "item-6-icon"',
        ),
    ], width=22)

    print()
    failed += block("the icon-known ruler (#211)", PROPOSAL_SOURCE, [
        (
            "unknown icon",
            "a name the vendored Lucide set never shipped",
            swap(PROPOSAL_SOURCE, ">calendar-check<", ">calendar-checkmark<"),
            'replace the icon "calendar-checkmark"',
        ),
    ], width=22)

    print()
    failed += block("the icon-paired ruler (#211)", PROPOSAL_SOURCE, [
        (
            "icon without its text",
            "an item's icon left in, its text taken away",
            cut(PROPOSAL_SOURCE,
                r'\s*<p class="item-3-text" step>[^<]*</p>\n', "item-3-text"),
            'add the missing <p class="item-3-text">',
        ),
        (
            "text without its icon",
            "an item's text left in, its icon taken away",
            cut(PROPOSAL_SOURCE,
                r'\s*<p class="item-3-icon" step>[^<]*</p>\n', "item-3-icon"),
            'add the missing <p class="item-3-icon">',
        ),
    ], width=22)

    print()
    failed += block("the chart's dialect (#213)", CANONICAL_SOURCE, [
        (
            "form not declared",
            "a chart drawn in a shape the register never carried",
            swap(CANONICAL_SOURCE, 'type="bars-h"', 'type="donut"'),
            'replace the type "donut"',
        ),
        (
            "no form at all",
            "a chart that never says what it is drawn as",
            swap(CANONICAL_SOURCE, '<section pattern="chart" type="bars-h"',
                 '<section pattern="chart"'),
            "give the <section> a type=",
        ),
        (
            "over the form's ceiling",
            "seven bars where bars-h takes six, and the group would take twelve",
            swap(CANONICAL_SOURCE, BARS_UL, BARS_UL_SEVEN),
            "drop 1 <li>",
        ),
        (
            "under the form's floor",
            "two points where a line needs three",
            swap(CANONICAL_SOURCE, LINE_UL, LINE_UL_TWO),
            "add 1 more <li>",
        ),
        (
            "same form twice over",
            "a second bars-h right after the first",
            swap(CANONICAL_SOURCE, BARS_SLIDE, BARS_SLIDE + "\n\n" + BARS_SLIDE),
            "give this slide another type",
        ),
        (
            "emphasis on drawn text",
            "a bold inside a label that reaches the page as a drawing",
            swap(CANONICAL_SOURCE, '<p class="label">Cartografia</p>',
                 '<p class="label"><strong>Cartografia</strong></p>'),
            "drop the <strong>",
        ),
    ], width=24, assets=GOOD_ASSETS)

    print()
    failed += block("the chart's numbers (#213)", CANONICAL_SOURCE, [
        (
            "value is not a number",
            "the unit typed into the value, where the number belongs alone",
            swap(CANONICAL_SOURCE, '<p class="value">3</p>', '<p class="value">3 h</p>'),
            'write the value of "Cartografia" as digits',
        ),
        (
            "value below the axis",
            "a negative where no form draws a mark",
            swap(CANONICAL_SOURCE, '<p class="value">3</p>', '<p class="value">-3</p>'),
            'write the value of "Cartografia" as a positive number',
        ),
        (
            "label with no value",
            "a point named and never measured",
            cut(CANONICAL_SOURCE, r'<p class="value">3</p>', "the first bar's value"),
            'add the missing <p class="value">',
        ),
        (
            "value field left empty",
            "the field written, named, and never answered",
            swap(CANONICAL_SOURCE, '<p class="value">3</p>', '<p class="value"></p>'),
            'write something in the <p class="value">',
        ),
        (
            "label field left empty",
            "a mark with a number and no name",
            swap(CANONICAL_SOURCE, '<p class="label">Cartografia</p>', '<p class="label"></p>'),
            'write something in the <p class="label">',
        ),
        (
            "share short of a hundred",
            "three slices adding up to ninety-five",
            swap(CANONICAL_SOURCE, SHARE_UL, SHARE_UL_SHORT),
            "make the values add up to 100",
        ),
        (
            "a marked slice",
            "the accent spent on one slice of a bar that is already all colour",
            swap(CANONICAL_SOURCE, SHARE_UL, SHARE_UL_MARKED),
            "drop `mark` from the <li>",
        ),
        (
            "label with no room",
            "a name three times the width the column gives it",
            swap(CANONICAL_SOURCE, '<p class="label">Jan</p>',
                 '<p class="label">Infraestrutura de dados</p>'),
            'shorten the label "Infraestrutura de dados"',
        ),
    ], width=24, assets=GOOD_ASSETS)

    print()
    failed += block("the dated legend (#213)", CANONICAL_SOURCE, [
        (
            "source with no date",
            "where the number came from, and never when",
            swap(CANONICAL_SOURCE, "painel do Estaleiro · dez/2026",
                 "painel do Estaleiro"),
            "add the year the data is from",
        ),
        (
            "no source at all",
            "a chart citing nothing",
            cut(CANONICAL_SOURCE, r'\s*<p class="source">painel do Estaleiro[^<]*</p>',
                "the first chart's source"),
            'add the missing <p class="source">',
        ),
        (
            "source left empty",
            "the legend written, named, and saying nothing",
            swap(CANONICAL_SOURCE, '<p class="source">painel do Estaleiro · dez/2026</p>',
                 '<p class="source"></p>'),
            'write something in the <p class="source">',
        ),
    ], width=24, assets=GOOD_ASSETS)

    print()
    failed += figure_block("the figure's paint (#214)", [
        (
            "a hex in a fill",
            "the accent written as the hexadecimal it happens to be today",
            in_source(swap(CANONICAL_SOURCE, ARROWHEAD,
                           ARROWHEAD.replace('fill="var(--accent)"', 'fill="#c8c8c8"'))),
            "repaint the fill of the <polygon>",
        ),
        (
            "a colour by its name",
            "a stroke painted in a word no theme can move",
            in_source(swap(CANONICAL_SOURCE, FIRST_BOX,
                           FIRST_BOX.replace('stroke="var(--hairline-strong)"',
                                             'stroke="white"'))),
            "repaint the stroke of the <rect>",
        ),
        (
            "a token nobody declares",
            "a variable that looks like a token and is not one",
            in_source(swap(CANONICAL_SOURCE, DOT,
                           DOT.replace('fill="var(--content-1)"', 'fill="var(--brand-blue)"'))),
            "repaint the fill of the <circle>",
        ),
    ], width=24)

    print()
    failed += figure_block("the figure's closed vocabulary (#214)", [
        (
            "a script in the drawing",
            "the one element that would make a slide run code",
            in_source(swap(CANONICAL_SOURCE, DOT, '<script>fetch("https://x")</script>')),
            "drop the <script>",
        ),
        (
            "a picture off the network",
            "an <image> fetching a file the deck does not carry",
            in_source(swap(CANONICAL_SOURCE, DOT,
                           '<image href="https://example.com/logo.png" x="0" y="0" '
                           'width="10" height="10"/>')),
            "drop the <image>",
        ),
        (
            "a link on a shape",
            "the reference wearing an attribute instead of a tag",
            in_source(swap(CANONICAL_SOURCE, DOT,
                           DOT.replace("/>", ' href="https://example.com/x"/>'))),
            "drop href= from the <circle>",
        ),
        (
            "smuggled geometry",
            "a colour typed past the paint ruler, inside a style=",
            in_source(swap(CANONICAL_SOURCE, FIRST_BOX,
                           FIRST_BOX.replace("/>", ' style="fill:red"/>'))),
            "drop style= from the <rect>",
        ),
        (
            "no viewBox",
            "a drawing with no size of its own",
            in_source(swap(CANONICAL_SOURCE, CYCLE_BOX, "")),
            "give the <svg> a viewBox=",
        ),
    ], width=24)

    print()
    failed += figure_block("the figure's own file (#214)", [
        (
            "an attribute nobody declared",
            "an alt= the compiler writes itself, typed by hand",
            in_source(swap(CANONICAL_SOURCE, CAPTURE_SRC,
                           CAPTURE_SRC + ' alt="uma captura"')),
            "drop alt= from the <img>",
        ),
        (
            "an image written open",
            "the <img> unclosed, swallowing the slide after it",
            in_source(swap(CANONICAL_SOURCE, f"<img {CAPTURE_SRC}/>",
                           f"<img {CAPTURE_SRC}>")),
            "self-close the <img/>",
        ),
        (
            "two figures on one slide",
            "a drawing put next to the picture, both claiming the slot",
            in_source(swap(CANONICAL_SOURCE, f"<img {CAPTURE_SRC}/>",
                           '<svg viewBox="0 0 10 10"><rect x="1" y="1" '
                           'width="8" height="8" fill="var(--ink)"/></svg>\n    '
                           f"<img {CAPTURE_SRC}/>")),
            "keep one figure",
        ),
        (
            "a path that finds nothing",
            "the src= pointing where no file is",
            in_source(swap(CANONICAL_SOURCE, CAPTURE_SRC, 'src="ausente.png"')),
            "put the image at",
        ),
        (
            "a URL instead of a path",
            "a picture the page would have to fetch",
            in_source(swap(CANONICAL_SOURCE, CAPTURE_SRC,
                           'src="https://example.com/capture.png"')),
            "write src= as a path to a file on disk",
        ),
        (
            "a format nobody embeds",
            "an extension outside the five the compiler carries",
            in_source(swap(CANONICAL_SOURCE, CAPTURE_SRC, 'src="capture.tiff"')),
            'save "capture.tiff" as one of',
        ),
        (
            "over the byte ceiling",
            "one byte more than a figure is allowed to weigh",
            in_file(OVER_CEILING),
            'shrink "capture.png" to under 2.0 MB',
        ),
        (
            "bytes the name lied about",
            "a GIF saved under a name promising a PNG",
            in_file(WRONG_FORMAT),
            'save "capture.png" as a real .png',
        ),
    ], width=24)

    print()
    failed += block("the speaker notes (#215)", PROPOSAL_SOURCE, [
        (
            "foreign tag in a note",
            "<em>, which is no more welcome off the stage than on it",
            swap(PROPOSAL_SOURCE, "<strong>uma hora</strong>", "<em>uma hora</em>"),
            "drop the <em>",
        ),
        (
            "note left empty",
            "the tag written, and the detail it was for never kept",
            swap(PROPOSAL_SOURCE, PROPOSAL_NOTE, "<notes></notes>"),
            "write something in the <notes>",
        ),
        (
            "two notes on one slide",
            "a second set of notes the compiler would drop in silence",
            swap(PROPOSAL_SOURCE, PROPOSAL_NOTE,
                 PROPOSAL_NOTE + "\n    " + PROPOSAL_NOTE),
            "keep one <notes>",
        ),
        (
            "attribute on a note",
            "an attribute on the one tag that carries none",
            swap(PROPOSAL_SOURCE, "<notes>Abra dizendo",
                 '<notes for="quem apresenta">Abra dizendo'),
            "drop for= from the <notes>",
        ),
    ], width=24)

    print()
    failed += block("fragments (#215)", PROPOSAL_SOURCE, [
        (
            "step with a number in it",
            "a reveal order typed into the attribute, beside the one the "
            "register already keeps",
            swap(PROPOSAL_SOURCE, '<p class="sentence" step>',
                 '<p class="sentence" step="2">'),
            "write `step` bare",
        ),
        (
            "half a pair marked",
            "an item's text arriving one beat after its own icon",
            swap(PROPOSAL_SOURCE, '<p class="item-3-icon" step>',
                 '<p class="item-3-icon">'),
            'mark <p class="item-3-icon"> with `step` too',
        ),
    ], width=24)

    print()
    # A GROUP'S ITEM IS NOT A FRAGMENT, and the red comes from the rule #212
    # already wrote rather than from one #215 added: `<li>` carries the group's
    # own flag or nothing. The case is here to hold that boundary, because a
    # series revealed a row at a time is the obvious next thing somebody tries.
    failed += block("a series arrives whole (#215)", CANONICAL_SOURCE, [
        (
            "step on a group item",
            "a metric marked to arrive on its own beat",
            swap(CANONICAL_SOURCE, '<li><p class="value">9</p>',
                 '<li step><p class="value">9</p>'),
            "drop step= from the <li>",
        ),
    ], width=24, assets=GOOD_ASSETS)

    print()
    failed += block("the header's motion profile (#215)", PROPOSAL_SOURCE, [
        (
            "motion gone",
            "the art direction's first field missing from the header",
            swap(PROPOSAL_SOURCE, '\n      motion="editorial"', ""),
            "give the <deck> a motion=",
        ),
        (
            "profile nobody declared",
            "a fourth profile, which no rule on the stage answers",
            swap(PROPOSAL_SOURCE, 'motion="editorial"', 'motion="dramatic"'),
            "write motion= as one of",
        ),
    ], width=24)

    print()
    failed += block("the theme-repertoire ruler (#216)", PROPOSAL_SOURCE, [
        (
            "a character no face has",
            "an arrow the docs' Inter was cut without",
            swap(PROPOSAL_SOURCE, "sem culpa.", "sem culpa →"),
            'rewrite "→" (U+2192)',
        ),
        (
            "a tick nobody carries",
            "a check mark neither face ever had",
            swap(PROPOSAL_SOURCE, ">Proposta<", ">Proposta ✓<"),
            'rewrite "✓" (U+2713)',
        ),
    ], width=24, theme="panlabs")

    print()
    failed += block("a note is painted too (#216)", PROPOSAL_SOURCE, [
        (
            "a character in a note",
            "a glyph in the panel only the presenter opens",
            swap(PROPOSAL_SOURCE, "<notes>", "<notes>⌫ "),
            'rewrite "⌫" (U+232B)',
        ),
    ], width=24, theme="panlabs")

    print()
    failed += block("the art direction's own dialect (#217)", PROPOSAL_SOURCE, [
        (
            "no art direction",
            "a deck whose form nobody chose",
            swap(PROPOSAL_SOURCE, DIRECTION + "\n\n", ""),
            "add a <direction> as the first child",
        ),
        (
            "a choice gone",
            "the signature taken out of the header",
            cut(PROPOSAL_SOURCE, r'\s*<p class="signature">.*?</p>', "the signature"),
            'add the missing <p class="signature">',
        ),
        (
            "a choice nobody declared",
            "a name the register never heard of, in the header",
            swap(PROPOSAL_SOURCE, 'class="signature"', 'class="palette"'),
            'drop the class "palette"',
        ),
        (
            "an attribute on the block",
            "geometry wearing the clothes of a header",
            swap(PROPOSAL_SOURCE, "<direction>", '<direction theme="panlabs">'),
            "drop theme= from the <direction>",
        ),
        (
            "a cover the catalog has not",
            "the deck opening on a pattern nobody wrote",
            swap(PROPOSAL_SOURCE, '<p class="cover">cover-headline</p>',
                 '<p class="cover">mega-cover</p>'),
            'replace "mega-cover"',
        ),
        (
            "a scale nobody declared",
            "a fourth scale of moments, which no ruler can hold a count to",
            swap(PROPOSAL_SOURCE, '<p class="moments">sober</p>',
                 '<p class="moments">calm</p>'),
            'replace "calm"',
        ),
        (
            "the header written last",
            "the art direction after the slides it directs",
            the_header_last,
            "move the <direction> to the top",
        ),
        (
            "one renunciation twice",
            "three renunciations that give up two shapes",
            swap(PROPOSAL_SOURCE, '<p class="renounced-2">table</p>',
                 '<p class="renounced-2">chart</p>'),
            'renounce something other than "chart"',
        ),
        (
            "renouncing its own cover",
            "a deck that gave up the pattern it opens on",
            swap(PROPOSAL_SOURCE, '<p class="renounced-1">chart</p>',
                 '<p class="renounced-1">cover-headline</p>'),
            'stop renouncing "cover-headline"',
        ),
        (
            "renouncing the closing",
            "the one contradiction no source could answer: the doctrine "
            "requires the shape the header gave up",
            swap(PROPOSAL_SOURCE, '<p class="renounced-1">chart</p>',
                 '<p class="renounced-1">closing-call</p>'),
            'stop renouncing "closing-call"',
        ),
    ], width=26)

    print()
    failed += block("the function in the arc (#217)", PROPOSAL_SOURCE, [
        (
            "no function at all",
            "a slide that never says what it is there for",
            swap(PROPOSAL_SOURCE,
                 '<section pattern="pivot-question" arc="tension">',
                 '<section pattern="pivot-question">'),
            "give the <section> an arc=",
        ),
        (
            "a function nobody declared",
            "a seventh act, which no arc in the register has",
            swap(PROPOSAL_SOURCE, 'arc="tension"', 'arc="epilogue"'),
            'replace the arc "epilogue"',
        ),
    ], width=26)

    print()
    failed += block("the scale of moments (#217)", PROPOSAL_SOURCE, [
        (
            "a deck with no moment",
            "the one peak rewritten as a pattern that is not one",
            swap(PROPOSAL_SOURCE, PROPOSAL_MOMENT, PROPOSAL_NO_MOMENT),
            "no scale admits none",
        ),
    ], width=26)

    print()
    failed += block("a scale the deck outgrew (#217)", CANONICAL_SOURCE, [
        (
            "sober, with six moments",
            "the ticket's own case: six charts under the smallest scale",
            swap(CANONICAL_SOURCE, '<p class="moments">high</p>',
                 '<p class="moments">sober</p>'),
            "bring the deck to 1 to 2 moments",
        ),
        (
            "high, without the stage",
            "six peaks on a profile the scale is not lent to",
            swap(CANONICAL_SOURCE, 'motion="cinematic"', 'motion="editorial"'),
            'write motion="cinematic" on the <deck>',
        ),
    ], width=26, assets=GOOD_ASSETS)

    print()
    failed += block("a chart spends colour too (#217)", CANONICAL_SOURCE, [
        (
            "a chart, and no semantics",
            "six charts drawn in two borrowed colours the header never explains",
            cut(CANONICAL_SOURCE, r'\s*<p class="content-1">.*?</p>',
                "the meaning of --content-1"),
            "say what --content-1 means in this deck",
        ),
    ], width=26, assets=GOOD_ASSETS)

    print()
    failed += block("the renounced pattern in use (#217)", PROPOSAL_SOURCE, [
        (
            "a shape given up and used",
            "a renunciation the deck walks back four slides later",
            swap(PROPOSAL_SOURCE, '<p class="renounced-3">timeline</p>',
                 '<p class="renounced-3">pull-quote</p>'),
            'stop renouncing "pull-quote"',
        ),
    ], width=26)

    print()
    failed += block("the closing that asks (#217)", PROPOSAL_SOURCE, [
        (
            "no closing at all",
            "a deck that stops instead of closing",
            cut(PROPOSAL_SOURCE, r'\s*<section pattern="closing-call".*?</section>',
                "the closing"),
            'end the deck on a "closing-call" slide',
        ),
        (
            "a closing that asks nothing",
            "the last slide doing some other act of the arc",
            swap(PROPOSAL_SOURCE, '<section pattern="closing-call" arc="call">',
                 '<section pattern="closing-call" arc="plan">'),
            'write arc="call" on the closing',
        ),
        (
            "a closing in the middle",
            "a deck that asks for something and then keeps talking",
            swap(PROPOSAL_SOURCE, DIVIDER, PROPOSAL_CLOSING + "\n\n" + DIVIDER),
            "move this closing to the end of the deck",
        ),
    ], width=26)

    print()
    # THE ONE BLOCK THAT HAS TO RUN OVER THE DECK WITH NO CHART IN IT (#219).
    # `_colour_semantics` charges a colour two ways -- a drawing that paints one
    # by hand, and a chart that spends both without anybody typing one -- and it
    # names the FIRST slide that spends each. In a deck carrying six charts and
    # a drawing the charts always come first, so the drawing's half of the ruler
    # is never the half that answers, and a plant here would be measuring the
    # chart. The proposal deck renounces the chart and paints both borrowed
    # colours by hand on one slide, which is the only ground on which the
    # drawing's branch is the one under test.
    failed += block("the colours the direction lends (#217)", PROPOSAL_SOURCE, [
        (
            "a colour with no meaning",
            "a figure painting with a colour the header never declared",
            cut(PROPOSAL_SOURCE, r'\s*<p class="content-2">.*?</p>',
                "the meaning of --content-2"),
            "say what --content-2 means in this deck",
        ),
        (
            "the other colour, undeclared",
            "the drawing left painting with a colour nobody borrowed",
            cut(PROPOSAL_SOURCE, r'\s*<p class="content-1">.*?</p>',
                "the meaning of --content-1"),
            "say what --content-1 means in this deck",
        ),
        (
            "a scale the deck is under",
            "one drawn figure declared as three to five",
            swap(PROPOSAL_SOURCE, '<p class="moments">sober</p>',
                 '<p class="moments">standard</p>'),
            "bring the deck to 3 to 5 moments",
        ),
    ], width=26)

    print()
    failed += the_theme_may_not_invent_a_token()

    print()
    print("and the ones that demand green:  [built kept]")
    failed += the_page_is_not_a_template()
    failed += the_category_is_the_whole_title()
    failed += the_divider_may_name_the_arc()
    failed += the_chart_svg_carries_no_colour()
    failed += the_figure_wears_only_the_theme()
    failed += the_notes_never_reach_the_stage()
    failed += the_unfaced_theme_promises_nothing()
    failed += the_photograph_is_not_a_moment()
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
