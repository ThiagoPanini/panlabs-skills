#!/usr/bin/env python3
"""THE PROOF. Plant one defect per red and demand it -- four assertions each.

    python3 check-static.proof.py                 # builds examples/*.json
    python3 check-static.proof.py --corpus DIR    # the .html the suite wrote

The standard is ADR 0001's, restated by `proof_driver.py` and already spent
once in `check-architecture.proof.py`: planted / red / message / green,
per red, not per family. Nine families print more than nine distinct reds
between them, and a branch nobody has ever forced to fire is exactly the
thing this file exists to refuse.

TWO FAMILIES (`connector-lands`, `donut-closes`) NEVER FIRE against the real
corpus -- `check-static.py`'s own module docstring says why: this engine's
`chart` draws bars, and no block in `register.py` draws an organogram or a
donut. Their real-corpus GREEN is still asserted here (`gate.BY_NAME[fam]`
reports "NOT MEASURED" rather than silently passing over nothing), and their
RED is planted by inserting synthetic SVG -- a path with `marker-end` and a
distant rect, a circle with an incomplete `stroke-dasharray` -- directly
into a copy of a real document. Nothing about the mechanism these two
families read cares which block produced the SVG; the proof does not either.
"""
import importlib.util
import pathlib
import re
import sys

sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from proof_driver import Drifted, Proof                          # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "check_static", HERE / "check-static.py")
gate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gate)

CORPUS = None            # set in main(), because --corpus changes it


def _hurt(html, i=0):
    """The one shape every plant below returns: the real corpus, with entry
    `i`'s bytes replaced."""
    label = CORPUS[i][0]
    out = list(CORPUS)
    out[i] = (label, html)
    return dict(corpus_html=out)


def _real():
    return CORPUS[0][1]


# --------------------------------------------------------------------------
# 1 - no-network
# --------------------------------------------------------------------------
def plant_stray_link():
    """A protocol-relative `<link>` in <head> -- no scheme, still a host."""
    html = _real()
    if "<head>" not in html:
        raise Drifted("no <head> to plant a stray <link> into")
    return _hurt(html.replace(
        "<head>", '<head><link rel="icon" href="//evil.example/x.ico">', 1))


# --------------------------------------------------------------------------
# 2 - inline-payload
# --------------------------------------------------------------------------
def plant_style_dropped():
    """Delete the one opening `<style>` tag; the closing tag is left, which
    is exactly the shape of a template edited by hand and broken."""
    html = _real()
    if "<style>" not in html:
        raise Drifted("no <style> tag to drop")
    return _hurt(html.replace("<style>", "", 1))


def plant_script_src():
    """A second `<script>` that carries its body through `src=` instead of
    inline -- same-origin path, so this plants ONLY an inline-payload
    defect and not a second, unrelated no-network one."""
    html = _real()
    if "</body>" not in html:
        raise Drifted("no </body> to plant a <script src=> before")
    return _hurt(html.replace(
        "</body>", '<script src="local.js"></script></body>', 1))


# --------------------------------------------------------------------------
# 3 - font-declared
# --------------------------------------------------------------------------
def plant_font_undeclared():
    """A new `font-family` in the CSS with no matching `@font-face` at all."""
    html = _real()
    if "</style>" not in html:
        raise Drifted("no </style> to plant a rule before")
    return _hurt(html.replace(
        "</style>", ".ghost{font-family:'Ghost Font'}</style>", 1))


def plant_face_not_embedded():
    """A `font-family` WITH an `@font-face`, but its `src:` is not `data:`."""
    html = _real()
    if "</style>" not in html:
        raise Drifted("no </style> to plant a rule before")
    rule = ("@font-face{font-family:'Local Ghost';src:local('Ghost')}"
            ".ghost2{font-family:'Local Ghost'}")
    return _hurt(html.replace("</style>", rule + "</style>", 1))


# --------------------------------------------------------------------------
# 4 - font-integrity
# --------------------------------------------------------------------------
_B64 = re.compile(r"base64,([A-Za-z0-9+/=]{100,})")


def plant_font_truncated():
    """Drop the last 40 base64 characters (30 bytes, a multiple of 4 so the
    remainder still decodes) from the FIRST embedded font. The WOFF2 header
    -- untouched, at the front of the payload -- still declares the
    ORIGINAL length, which no longer matches what is left to decode: #93's
    exact shape, a payload that shortens without saying so."""
    html = _real()
    m = _B64.search(html)
    if not m:
        raise Drifted("no embedded base64 font found")
    b64 = m.group(1)
    if len(b64) < 200:
        raise Drifted("the first font is too small to truncate meaningfully")
    truncated = b64[:-40]
    return _hurt(html[:m.start(1)] + truncated + html[m.end(1):])


# --------------------------------------------------------------------------
# 5 - palette-chroma
# --------------------------------------------------------------------------
def plant_chromatic_hex():
    """A chromatic hex with no `class="mark"` anywhere near it -- not one of
    the measured tokens, and not exempt."""
    html = _real()
    if "</style>" not in html:
        raise Drifted("no </style> to plant a rule before")
    return _hurt(html.replace("</style>", ".ghost3{color:#3776AB}</style>", 1))


def plant_hyphenated_lookalike():
    """`class="icon-mark"` is a hyphenated, unrelated class, not the token
    `mark` -- `\\bmark\\b` matches inside it anyway (`-` is a regex word
    boundary, not an HTML token separator), which is exactly the false
    exemption a substring test would grant. This must still redden."""
    html = _real()
    if "<body" not in html:
        raise Drifted("no <body to plant a lookalike tag after")
    tag = '<span class="icon-mark" style="color:#3776AB">x</span>'
    return _hurt(re.sub(r"(<body[^>]*>)", r"\1" + tag, html, count=1))


# --------------------------------------------------------------------------
# 6 - beats-present
# --------------------------------------------------------------------------
def plant_beats_misspelled():
    """Every `class=beat` misspelled at once -- the file still has content,
    it simply is not marked up as a beat anymore."""
    html = _real()
    if "class=beat" not in html:
        raise Drifted("no class=beat found to misspell")
    return _hurt(html.replace("class=beat", "class=beet"))


# --------------------------------------------------------------------------
# 7 - connector-lands
# --------------------------------------------------------------------------
def plant_connector_off_target():
    """A synthetic connector whose arrowhead lands nowhere near the one
    shape on the (synthetic) canvas."""
    html = _real()
    if "<body" not in html:
        raise Drifted("no <body to plant synthetic SVG after")
    svg = ('<svg><rect x="0" y="0" width="20" height="20"/>'
           '<path marker-end="url(#a)" d="M500 500 L900 900"/></svg>')
    return _hurt(re.sub(r"(<body[^>]*>)", r"\1" + svg, html, count=1))


# --------------------------------------------------------------------------
# 8 - donut-closes
# --------------------------------------------------------------------------
def plant_donut_incomplete():
    """A synthetic donut whose one arc is far short of the circumference it
    claims to be a slice of."""
    html = _real()
    if "<body" not in html:
        raise Drifted("no <body to plant synthetic SVG after")
    svg = '<svg><circle cx="50" cy="50" r="40" stroke-dasharray="50"/></svg>'
    return _hurt(re.sub(r"(<body[^>]*>)", r"\1" + svg, html, count=1))


# --------------------------------------------------------------------------
# 9 - chart-coherence
# --------------------------------------------------------------------------
_VAL = re.compile(r'(<text class="val"[^>]*>)([\d.]+)(</text>)')


def plant_chart_label_lies():
    """The FIRST bar's printed value changed; its drawn height is not
    touched -- the same shape as #93's donut-total defect, moved to a bar
    because this engine draws bars."""
    html = _real()
    m = _VAL.search(html)
    if not m:
        raise Drifted("no chart bar value found to relabel")
    lied = str(float(m.group(2)) * 11 + 3)
    return _hurt(html[:m.start()] + m.group(1) + lied + m.group(3) + html[m.end():])


# (family, what is planted, the plant, the imperative/fact the red must carry)
CASES = [
    ("no-network", "adds a protocol-relative <link> to <head>",
     plant_stray_link, "cannot name a host"),

    ("inline-payload", "drops the opening <style> tag",
     plant_style_dropped, "no <style> block"),
    ("inline-payload", "adds a <script src=> alongside the inline one",
     plant_script_src, "no engine body is inline"),

    ("font-declared", "names a font-family with no @font-face at all",
     plant_font_undeclared, "no @font-face in this file"),
    ("font-declared", "gives a font-family an @font-face with no data: src",
     plant_face_not_embedded, "is not embedded"),

    ("font-integrity", "truncates the first embedded font's base64 by 30 bytes",
     plant_font_truncated, "truncated or padded"),

    ("palette-chroma", "adds a chromatic hex with no class=mark near it",
     plant_chromatic_hex, "is not one of the"),
    ("palette-chroma", "adds a chromatic hex under class=icon-mark",
     plant_hyphenated_lookalike, "is not one of the"),

    ("beats-present", "misspells every class=beat in the file",
     plant_beats_misspelled, "was never filled"),

    ("connector-lands", "plants a connector whose arrowhead lands on nothing",
     plant_connector_off_target, "points at nothing"),

    ("donut-closes", "plants a donut whose one arc falls short of the circle",
     plant_donut_incomplete, "do not close the circle"),

    ("chart-coherence", "changes a bar's printed value, not its height",
     plant_chart_label_lies, "the drawing is right and the number is lying"),
]


PROOF = Proof(
    title="static.proof",
    label=lambda family: family,
    invoke=lambda family, over: gate.BY_NAME[family](**over),
    planted=lambda over: over["corpus_html"] != CORPUS,
    control=lambda family: gate.BY_NAME[family](corpus_html=CORPUS),
)


def _exempt_case(title, marked_fragment, needle_present, needle_absent):
    """One "planting must NOT turn it red" case. `proof_driver.Proof` is
    built for the opposite polarity (plant -> demand red), so this is the
    one shape in this file it cannot drive: a bare chromatic hex (must be
    named) beside the SAME hex wearing the exemption under test (must not
    be)."""
    html = _real()
    if "</style>" not in html or "<body" not in html:
        print(f"  FAIL {title:<20} no </style> or <body> to plant into")
        return 1
    hurt = html.replace("</style>", ".ghost4{color:#844FBA}</style>", 1)
    hurt = re.sub(r"(<body[^>]*>)", r"\1" + marked_fragment, hurt, count=1)
    ok, msg = gate.check_palette_chroma(corpus_html=[(CORPUS[0][0], hurt)])
    good = (not ok) and (needle_present in msg.lower()) and (needle_absent not in msg.lower())
    print(f"  {'ok  ' if good else 'FAIL'} {title:<20} "
          f"a bare hex is named, the exempt one beside it is not")
    if not good:
        print(f"       <- {msg}")
    return 0 if good else 1


def _mark_exemption_cases():
    """The slot skeleton.html declares does not fit the plant/red mould
    above. Three shapes:

    - the tag itself carries the exemption;
    - a CHILD of a marked container does, because #93's OWN finding was
      exactly this: "the logos on the rail, fill=rgb(132, 79, 186)" is a
      colour on a CHILD element, never on the tag `class="mark"` sits on --
      a same-tag-only exemption would still redden the case #93 found;
    - `mark` as the SECOND token of `class=`, because the first draft's
      exemption regex could not cross the space to reach it (see
      `_has_mark_class`'s own docstring).
    """
    bad = 0
    bad += _exempt_case(
        "mark-exemption(tag)",
        '<span class="mark" style="color:#3776AB">x</span>',
        "844fba", "3776ab")
    bad += _exempt_case(
        "mark-exemption(child)",
        '<svg class="mark"><path fill="#3776AB"/></svg>',
        "844fba", "3776ab")
    bad += _exempt_case(
        "mark-exemption(2nd tok)",
        '<span class="icon mark" style="color:#3776AB">x</span>',
        "844fba", "3776ab")
    return bad


def main(argv):
    global CORPUS
    try:
        CORPUS = gate.corpus(gate.read_corpus_flag(argv))
    except (AssertionError, OSError) as e:
        return PROOF.refuse(str(e))

    bad = PROOF.run(CASES)
    bad += _mark_exemption_cases()

    uncovered = sorted({n for n, _ in gate.FAMILIES} - {c[0] for c in CASES})
    if uncovered:
        print(f"  FAIL coverage            no defect planted for: "
              f"{', '.join(uncovered)}. Add a case to CASES for each")
        bad += 1
    else:
        print(f"  ok   coverage            {len(CASES)} planted defects over "
              f"all {len(gate.FAMILIES)} families, against "
              f"{len(CORPUS)} real argument(s)")
    return bad


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1:]) else 0)
