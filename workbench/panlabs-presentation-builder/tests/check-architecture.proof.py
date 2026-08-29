#!/usr/bin/env python3
"""THE PROOF. Plant one defect per red and demand it -- four assertions each.

    python3 check-architecture.proof.py                 # builds examples/*.json
    python3 check-architecture.proof.py --corpus DIR    # the .html the suite wrote

A family only ever seen green is documentation, not a check. That is this
house's rule, and the reason every family under `scripts/checks/` ships with
a `.proof.sh` beside it. The standard the map fixed for this gate is FOUR
assertions, and all four are here, per case:

  planted   the mutated input really differs from the real one. Without this
            a drifted fixture plants NOTHING and the case still passes the
            other three by accident -- the exact way a proof rots silently.
  red       the family goes red on it.
  message   the red NAMES ITS OWN FIX. This is what ADR 0001 obliges, and
            `exit 1` names nothing: a red that does not say what to do is a
            red people learn to ignore. The phrase asserted is always the
            IMPERATIVE, never the diagnosis -- "registered but unstyled" says
            what is wrong, "drop the block from register.py" says what to do.
  green     the same family, with nothing planted, is green AGAINST THE REAL
            CORPUS. A proof with no real control measures the author of the
            check, not the check.

THE UNIT IS THE RED, NOT THE FAMILY. Six families print twelve distinct
reds between them, and a branch nobody has ever seen fire is exactly the
thing this file exists to refuse -- so there is a case per red, not per
family. `register-skeleton` alone has two opposite ones (a block with no
rule, a rule with no block) and covering only the first would leave half of
the set equality unproven while the coverage line claimed the family was
covered.

NOTHING HERE KNOWS THE VOCABULARY EITHER, and that is deliberate. Every
needle is DERIVED at run time -- the block name from `REGISTER`, the root
class from that block's own `css` field, the markers from the skeleton, the
misspelled class from the fills themselves, the orphan class from whatever
prefix no root claims. Renaming, adding or deleting a block does not cost a
line here any more than it costs one in the gate. A proof that hardcodes
`quote` rots on the very rename the gate was built to survive, and then the
gate is being guarded by something staler than itself.
"""
import importlib.util
import pathlib
import re
import sys

# Nothing this suite runs may leave bytecode in the tree it measures.
sys.dont_write_bytecode = True

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from proof_driver import Drifted, Proof                          # noqa: E402

# `check-architecture.py` has a hyphen in its name, so `import` cannot reach
# it. Loading it by path is the honest way to say "the proof runs the same
# code the suite runs" -- a second copy of the families here would be a second
# place they are written, which is the very defect this gate exists to refuse.
_spec = importlib.util.spec_from_file_location(
    "check_architecture", HERE / "check-architecture.py")
gate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gate)

build, REGISTER = gate.build, gate.REGISTER

SK = gate.skeleton_text()
DOC_TEXT = gate.DOC.read_text(encoding="utf-8")
CORPUS = None            # set in main(), because --corpus changes it


def _first_block():
    return next(iter(REGISTER))


def _generated():
    """The doc split around its generated block: (head, body, tail)."""
    head, rest = DOC_TEXT.split(gate.vocab.BEGIN, 1)
    body, tail = rest.split(gate.vocab.END, 1)
    return head, body, tail


def _declared():
    got = re.findall(r"<!--P:([A-Z]+)-->", SK)
    if not got:
        raise Drifted("the skeleton declares no marker")
    return got


def _hurt_output(segs, fills):
    return dict(corpus_html=[(CORPUS[0][0], gate.rebuild(segs, fills))])


# --------------------------------------------------------------------------
# 1 - doc-current, both reds
# --------------------------------------------------------------------------
def plant_doc_stale():
    """Rename one block inside the doc's GENERATED block.

    Mutating inside the block, and not with a plain `replace` over the whole
    file, is what makes this case actually test family 1: a rename in the
    hand-written prose above the block is invisible to it, and the case would
    stay green while claiming to have planted something.
    """
    name = _first_block()
    head, body, tail = _generated()
    needle = f"| `{name}` |"
    if needle not in body:
        raise Drifted(f"the generated block has no row for `{name}`")
    body = body.replace(needle, f"| `{name}-renamed` |", 1)
    return dict(doc_text=head + gate.vocab.BEGIN + body + gate.vocab.END + tail)


def plant_doc_block_gone():
    """Delete the generated block's opening marker.

    The failure of somebody editing the doc by hand and losing the fence: the
    prose is still there, still readable, and no longer generated by anything.
    """
    return dict(doc_text=DOC_TEXT.replace(gate.vocab.BEGIN, "", 1))


# --------------------------------------------------------------------------
# 2 - register-skeleton, both directions of the set equality
# --------------------------------------------------------------------------
def plant_block_unstyled():
    """Take one registered block's rules out of the skeleton's CSS."""
    name = _first_block()
    root = "." + REGISTER[name]["css"]
    if root not in SK:
        raise Drifted(f"the skeleton has no `{root}` rule to remove")
    return dict(skeleton=SK.replace(root, ".gone-" + root[1:]))


def plant_rule_unregistered():
    """Give the skeleton a `.b-*` rule that no block in the register claims.

    The opposite direction, and it needs its own case: a rule left behind by
    a deleted block styles nothing, is invisible in every render, and grows
    the frozen skeleton forever. The class is DERIVED as the shortest `b-`
    name no registered root is a prefix of, so it stays an orphan no matter
    what the register comes to hold.
    """
    roots = {s["css"] for s in REGISTER.values()}
    cls = "b-z"
    while any(cls.startswith(r) for r in roots):
        cls += "z"
    return dict(skeleton=SK.replace(
        "</style>", "." + cls + "{display:block}</style>", 1))


# --------------------------------------------------------------------------
# 3 - emitted-classes
# --------------------------------------------------------------------------
def plant_class_misspelled():
    """Misspell, in place, one class the builder emits into a fill.

    Surgical on purpose: the token is rewritten at the exact offset the match
    found it, so nothing else in the output moves and no other family is
    disturbed by the plant. `gate.styled` is asked which classes are already
    styled rather than a second regex here -- a proof that re-implements the
    predicate it is proving can agree with a bug and call it green.
    """
    label, html = CORPUS[0]
    css = gate._style(SK)
    segs, fills = gate.split(SK, html)
    for i, f in enumerate(fills):
        for m in gate._CLASS.finditer(f):
            g = next(k for k in range(1, 4) if m.group(k) is not None)
            value, at = m.group(g), m.start(g)
            off = 0
            for tok in value.split():
                start = value.index(tok, off)
                off = start + len(tok)
                if not gate.styled(css, tok):
                    continue            # already unstyled: a hook, not a defect
                hurt = fills[:]
                hurt[i] = (f[:at + start] + "mis" + tok
                           + f[at + start + len(tok):])
                return _hurt_output(segs, hurt)
    raise Drifted("no styled class is emitted into any fill")


# --------------------------------------------------------------------------
# 4 - skeleton-verbatim
# --------------------------------------------------------------------------
def plant_engine_edited():
    """Change ONE byte inside a copied engine segment of the output."""
    label, html = CORPUS[0]
    segs, fills = gate.split(SK, html)
    k = max(range(len(segs)), key=lambda i: len(segs[i]))
    s = segs[k]
    if len(s) < 2:
        raise Drifted("no engine segment long enough to edit")
    i = len(s) // 2
    hurt = segs[:]
    hurt[k] = s[:i] + ("x" if s[i] != "x" else "y") + s[i + 1:]
    out = gate.rebuild(hurt, fills)
    if s in out:
        raise Drifted("the edited segment still appears verbatim")
    return dict(corpus_html=[(label, out)])


# --------------------------------------------------------------------------
# 5 - no-generated-css, all three reds
# --------------------------------------------------------------------------
def plant_second_style():
    """Give the output a second <style>, written into a fill."""
    label, html = CORPUS[0]
    segs, fills = gate.split(SK, html)
    for i, f in enumerate(fills):
        if f:
            hurt = fills[:]
            hurt[i] = "<style>.planted{color:red}</style>" + f
            return _hurt_output(segs, hurt)
    raise Drifted("the builder filled nothing at all")


def plant_style_retuned():
    """Retune the engine's OWN CSS in the output, leaving one <style>.

    Family 4 catches this too -- an edited engine segment is an engine that
    was not copied -- and the overlap is inherent: the style block lives
    inside a segment, so there is no way to change it that family 4 cannot
    see. The case is still worth having, because it is family 5's message
    that names the right fix for a retuned rule.
    """
    label, html = CORPUS[0]
    body = gate._style(SK)
    segs, fills = gate.split(SK, html)
    k = next((i for i, s in enumerate(segs) if body in s), None)
    if k is None or len(body) < 2:
        raise Drifted("no engine segment carries the whole <style> body")
    i = segs[k].index(body) + len(body) // 2
    s = segs[k]
    hurt = segs[:]
    hurt[k] = s[:i] + ("x" if s[i] != "x" else "y") + s[i + 1:]
    return _hurt_output(hurt, fills)


def plant_fill_closes_style():
    """Let a fill carry a stray `</style>`.

    The quiet one: it does not add a second `<style>`, so the count stays at
    1, and the skeleton's own style block still matches byte for byte -- but
    everything the browser reads after it leaves the stylesheet. Only the
    third branch of family 5 sees it.
    """
    label, html = CORPUS[0]
    segs, fills = gate.split(SK, html)
    for i, f in enumerate(fills):
        if f:
            hurt = fills[:]
            hurt[i] = "</style>" + f
            return _hurt_output(segs, hurt)
    raise Drifted("the builder filled nothing at all")


# --------------------------------------------------------------------------
# 6 - markers, all three reds
# --------------------------------------------------------------------------
def plant_marker_twice():
    """Declare one marker twice in the skeleton."""
    tok = f"<!--P:{_declared()[0]}-->"
    return dict(skeleton=SK.replace(tok, tok + tok, 1))


def plant_marker_dropped():
    """Delete a marker the builder still fills.

    One direction of family 6's set equality: a builder that fills a hole the
    skeleton no longer has leaves no trace anywhere in the output.
    """
    tok = f"<!--P:{_declared()[-1]}-->"
    return dict(skeleton=SK.replace(tok, "", 1))


def plant_marker_unfilled():
    """Take a hole out of `build.FILLS` and leave the marker declared.

    The other direction, and it fails LOUDLY in the output -- an unfilled
    marker ships as an HTML comment -- which is precisely why it must fail
    here first.
    """
    if len(build.FILLS) < 2:
        raise Drifted("the builder fills fewer than two holes")
    return dict(fills=tuple(build.FILLS)[:-1])


# (family, what is planted, the plant, the imperative the red must carry)
CASES = [
    ("doc-current", "renames a block inside the generated block",
     plant_doc_stale, "vocab.py --write"),
    ("doc-current", "deletes the generated block's opening fence",
     plant_doc_block_gone, "vocab.py --write"),

    ("register-skeleton", "takes a registered block's rules out of the CSS",
     plant_block_unstyled, "drop the block from register.py"),
    ("register-skeleton", "leaves a `.b-*` rule no block claims",
     plant_rule_unregistered, "add the block to register.py"),

    ("emitted-classes", "misspells a class the builder emits",
     plant_class_misspelled, "Fix the spelling in build.py"),

    ("skeleton-verbatim", "edits one byte of the copied engine",
     plant_engine_edited, "must copy skeleton.html"),

    ("no-generated-css", "writes a second <style> into a fill",
     plant_second_style, "put the rule in skeleton.html"),
    ("no-generated-css", "retunes the engine's own CSS in the output",
     plant_style_retuned, "put the rule in skeleton.html"),
    ("no-generated-css", "lets a fill carry a stray </style>",
     plant_fill_closes_style, "put the rule in skeleton.html"),

    ("markers", "declares a marker twice in the skeleton",
     plant_marker_twice, "delete the duplicate"),
    ("markers", "drops a marker the builder still fills",
     plant_marker_dropped, "drop it from build.FILLS"),
    ("markers", "stops filling a marker the skeleton still declares",
     plant_marker_unfilled, "delete the marker"),
]




def _real(key):
    """What the override replaces, so `planted` can be asserted generically."""
    return dict(doc_text=DOC_TEXT, skeleton=SK, corpus_html=CORPUS,
                fills=tuple(build.FILLS))[key]


PROOF = Proof(
    title="architecture.proof",
    label=lambda family: family,
    invoke=lambda family, over: gate.BY_NAME[family](**over),
    planted=lambda over: all(over[k] != _real(k) for k in over),
    control=lambda family: gate.BY_NAME[family](corpus_html=CORPUS),
)


def main(argv):
    global CORPUS
    try:
        CORPUS = gate.corpus(gate.read_corpus_flag(argv))
    except (AssertionError, OSError) as e:
        # The corpus is read outside every case, so its failure is the one
        # that would otherwise reach the terminal as a traceback rather than
        # as a red naming its fix. The message raised already names one.
        return PROOF.refuse(str(e))

    bad = PROOF.run(CASES)
    uncovered = sorted({n for n, _ in gate.FAMILIES} - {c[0] for c in CASES})
    if uncovered:
        # A family with no planted defect is a family only ever seen green,
        # which is the thing this file exists to make impossible. It is a red
        # here, not a note: the gate grows by families, and the one that
        # arrives without a proof is exactly the one that will not fire.
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
