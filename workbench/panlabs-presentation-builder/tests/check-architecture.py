#!/usr/bin/env python3
"""THE ARCHITECTURE GATE. Six families, and none of them knows the vocabulary.

    python3 check-architecture.py                 # builds examples/*.json in memory
    python3 check-architecture.py --corpus DIR    # reads the .html the suite wrote

That last clause of the first line is the whole answer to #97 item 3, and it
is the reason this file does not age. A check that carries a list of block
names is a THIRD place the vocabulary is written, and it rots on the first
rename exactly like the prose did. Every family below reads BOTH sides
mechanically and compares them:

  1  doc-current        regenerate the doc's block from the register; demand
                        byte-identity with what is on disk
  2  register-skeleton  REGISTER's root classes  ==  the `.b-*` rules in the
                        skeleton's CSS, as sets, in both directions
  3  emitted-classes    every class that crosses the seam has a rule on the
                        other side of it
  4  skeleton-verbatim  everything outside the markers is copied byte for
                        byte, and the model's share is measured
  5  no-generated-css   one <style>, and it is the skeleton's, byte for byte
  6  markers            what the skeleton declares  ==  what the builder fills

Rename a block, add one, delete one, retune a class: not one line here needs
an edit. The only way to break this gate is to break an extractor, and an
extractor that is wrong makes the generated doc visibly wrong on the very
next run.

WHY THE FAILURE MODE IS WORTH A GATE AT ALL. slideless was read in the code:
469 KB of prose could not follow 164 KB of template, and the documentation
diverged from the engine in padding, in variable name and in history route --
with one of its own references admitting it deleted two of its own sections
for contradicting the template. The defense is not discipline. A block's name
is a fact in ONE place, the builder renders from it, the prose is GENERATED
from it, and this file regenerates and demands byte-identity.

THE SUITE DOES NOT LIVE INSIDE THE SKILL (#44): it is read and run by whoever
MAINTAINS the skill, never by whoever EXECUTES it, and the installed tree
should not carry its weight. Every path below points INTO
skills/panlabs-presentation-builder/ -- the only direction a reference from
here is allowed to travel.
"""
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
SKILL = (HERE / "../../../skills/panlabs-presentation-builder").resolve()
ENGINE = SKILL / "engine"
DOC = SKILL / "VOCABULARY.md"
EXAMPLES = SKILL / "examples"

# The engine is the subject, so it is imported, not re-implemented. `build`,
# `vocab` and `register` import each other by bare name, which is how they
# resolve when run from `engine/` -- so `engine/` goes on the path and they
# resolve here exactly as they do there.
#
# ⚠️ AND THE SUITE WRITES NOTHING INTO THE TREE IT MEASURES. Importing them
# would otherwise leave `engine/__pycache__/` inside the skill that gets
# installed -- ignored by git, and still a ruler that touches its own
# subject, which is the one thing a ruler must not do.
sys.dont_write_bytecode = True
sys.path.insert(0, str(ENGINE))

import build                                                    # noqa: E402
import vocab                                                    # noqa: E402
from register import REGISTER, HOOKS                             # noqa: E402


# --------------------------------------------------------------------------
# the two extractors every family shares
# --------------------------------------------------------------------------
def _style(html):
    """The one <style> block's body, or "" when there is none."""
    m = re.search(r"<style>(.*?)</style>", html, re.S)
    return m.group(1) if m else ""


def split(skeleton, out):
    """Split `out` into (skeleton segments, fills), or raise.

    This is family 4's engine, and the ONE thing it asserts is the one thing
    that can be false: that every segment reappears, in order, byte for byte.

    That segments + fills reconstruct `out` is not asserted, because it
    cannot fail -- each fill is literally the slice of `out` between the end
    of the previous segment and the start of the next, so the reconstruction
    is an identity by construction. An earlier draft asserted it anyway; 500
    mutations never made it fire, and a branch nobody has ever seen fire is
    exactly what the proof beside this file exists to refuse. Stating it here
    in prose costs nothing and claims nothing false.

    `fills` is one longer than `segs` and aligned as f0 s0 f1 s1 ... fn sn "",
    so a caller that wants to plant one defect can rebuild the output with a
    single piece changed and nothing else moved.
    """
    segs = re.split(r"<!--P:[A-Z]+-->", skeleton)
    fills, pos = [], 0
    for i, s in enumerate(segs):
        j = out.find(s, pos)
        if j < 0:
            raise AssertionError(
                f"skeleton segment {i} ({s[:48]!r}...) is not in the output "
                f"verbatim -- the engine was regenerated, not copied. "
                f"build.py must copy skeleton.html and fill only the markers")
        fills.append(out[pos:j])
        pos = j + len(s)
    fills.append(out[pos:])
    return segs, fills


def rebuild(segs, fills):
    """The inverse of `split`, and the proof's way of planting one defect."""
    return "".join(a + b for a, b in zip(fills, segs + [""]))


def arguments():
    """Every argument the skill ships, and there must be at least one."""
    got = sorted(EXAMPLES.glob("*.json"))
    if not got:
        raise AssertionError(
            f"no argument under {EXAMPLES} -- add one, or the families below "
            f"pass every loop without entering it")
    return got


def corpus(from_dir=None):
    """The real corpus, as [(label, html)] -- never a fixture.

    A gate proved against something written to be gated measures its own
    author. The default is to build every argument under `examples/` in
    memory; the suite passes the directory it just built, so the families
    read the bytes the documented command actually wrote.

    ⚠️ `from_dir is not None`, and an empty string is REFUSED rather than
    treated as absent. `if from_dir:` here was a real false green: the suite
    passes `--corpus "$OUTPUT_DIR"`, and `mktemp` failing leaves that empty
    without `set -u` noticing, at which point the gate quietly rebuilds in
    memory and prints the SAME green text -- while the promise the whole
    layer rests on, that it measures the bytes layer 1 wrote, has stopped
    being true and nothing says so.
    """
    want = arguments()
    if from_dir is not None:
        if not str(from_dir).strip():
            raise AssertionError(
                "--corpus was given an empty path. Pass the directory the "
                "suite built into, or drop the flag to build in memory")
        d = pathlib.Path(from_dir)
        got = sorted(d.glob("*.html"))
        if not got:
            raise AssertionError(
                f"no built .html under {d} -- build the corpus before the "
                f"families read it")
        # THE WHOLE CORPUS, or none of it. A build that died halfway leaves
        # the survivors on disk, and a gate that measures only those prints
        # green over a corpus smaller than the one that exists -- an
        # optimistic verdict, which is the shape of a green nobody can trust.
        if len(got) != len(want):
            raise AssertionError(
                f"{len(got)} built .html under {d} for {len(want)} argument(s) "
                f"in examples/ -- the corpus is partial, so this layer would "
                f"be green over less than exists. Build them all first")
        return [(p.stem, p.read_text(encoding="utf-8")) for p in got]
    out = []
    for p in want:
        arg = json.loads(p.read_text(encoding="utf-8"))
        build.validate(arg)
        out.append((p.stem, build.render(arg)))
    return out


def read_corpus_flag(argv):
    """`--corpus DIR` off a command line, or None. Never an IndexError."""
    if "--corpus" not in argv:
        return None
    i = argv.index("--corpus")
    if i + 1 >= len(argv):
        raise AssertionError(
            "--corpus needs a directory after it. Pass the one the suite "
            "built into, or drop the flag to build in memory")
    return argv[i + 1]


def skeleton_text():
    return (ENGINE / "skeleton.html").read_text(encoding="utf-8")


# Every family takes the same two overridable inputs, so resolving them is
# written once. The `is not None` matters for the same reason it does in
# `corpus`: an empty override is a defect somebody planted, not an absence.
def _sk(skeleton):
    return skeleton if skeleton is not None else skeleton_text()


def _body(corpus_html):
    return corpus_html if corpus_html is not None else corpus()


# Both quoting styles, because the check must not depend on which one the
# builder happens to emit today: `class=beat`, `class="fg on"`, `class='x'`.
_CLASS = re.compile(r"""class=(?:"([^"]*)"|'([^']*)'|([^\s>]*))""")


def emitted_classes(fill):
    """Every `class=` value in one fill, whatever quoting it wears."""
    return [next(g for g in m.groups() if g is not None)
            for m in _CLASS.finditer(fill)]


def styled(css, cls):
    """True when the CSS carries a rule for `cls`.

    The boundary is a LOOKAHEAD, not a consumed character. Consuming one
    means a rule that happens to be the last bytes of the stylesheet matches
    nothing, and the family goes red against a class the skeleton does style
    -- a false red that appears and disappears with unrelated CSS edits,
    which is the fastest way to teach people to ignore a gate.
    """
    return bool(re.search(rf"\.{re.escape(cls)}(?![\w-])", css))


# --------------------------------------------------------------------------
# 1 - the prose is generated, so drift cannot happen without a red
# --------------------------------------------------------------------------
def check_doc_current(doc_text=None, **_):
    """Regenerate VOCABULARY.md's block from the register and diff it.

    Not "the prose points at the template": pointing only works if the
    pointer's target is the template, and the template is 96 KB of CSS and
    JS. Nobody reads that to learn twelve names, so somebody writes a summary
    -- and the summary is the thing that drifts.
    """
    text = doc_text if doc_text is not None else DOC.read_text(encoding="utf-8")
    if vocab.BEGIN not in text or vocab.END not in text:
        return False, (f"{DOC.name}: the generated block is missing -- run "
                       f"`python3 engine/vocab.py --write`")
    body = text.split(vocab.BEGIN, 1)[1].split(vocab.END, 1)[0]
    have = vocab.BEGIN + body + vocab.END
    want = vocab.render()
    if have != want:
        return False, (f"{DOC.name} is stale -- run `python3 engine/vocab.py "
                       f"--write`. ({len(have)} B on disk, {len(want)} B "
                       f"generated from register.py)")
    return True, f"{DOC.name}: generated block is current ({len(want)} B)"


# --------------------------------------------------------------------------
# 2 - the register and the skeleton name the same set of blocks
# --------------------------------------------------------------------------
def check_register_skeleton(skeleton=None, **_):
    """Set equality, in BOTH directions, between register and skeleton CSS.

    A class BELONGS to a block when it extends that block's declared root
    (`b-tbn` is the table's note, `b-numc` the number's caption). The roots
    come from the register's `css` field, never from a guess -- the gate's
    first run guessed by prefix and got two of the eight wrong.
    """
    css = _style(_sk(skeleton))
    in_css = set(re.findall(r"\.(b-[a-z]+)", css))
    roots = {spec["css"]: name for name, spec in REGISTER.items()}
    missing = sorted(n for r, n in roots.items() if r not in in_css)
    if missing:
        return False, (f"registered but unstyled: {', '.join(missing)} -- "
                       f"the skeleton has no rule for them. Add the rule to "
                       f"skeleton.html, or drop the block from register.py")
    orphan = sorted(c for c in in_css
                    if not any(c.startswith(r) for r in roots))
    if orphan:
        return False, (f"styled but unregistered: "
                       f"{', '.join('.' + o for o in orphan)} -- add the "
                       f"block to register.py, or delete the rule from "
                       f"skeleton.html")
    return True, (f"register ({len(REGISTER)}) and skeleton CSS name the same "
                  f"set of blocks")


# --------------------------------------------------------------------------
# 3 - every class crossing the seam has a rule on the other side
# --------------------------------------------------------------------------
def check_emitted_classes(skeleton=None, corpus_html=None, **_):
    """This is what makes markers SAFER than structure-inside-markers.

    A marker's absence is loud (family 6); a class name emitted into a marker
    is silent -- write `beat` as `beet` and the page renders unstyled with no
    error anywhere. Here it is loud too.
    """
    sk = _sk(skeleton)
    css = _style(sk)
    body = _body(corpus_html)
    seen = set()
    for label, html in body:
        _, fills = split(sk, html)
        used = set()
        for f in fills:
            for c in emitted_classes(f):
                used.update(c.split())
        unstyled = sorted(c for c in used - set(HOOKS) if not styled(css, c))
        if unstyled:
            return False, (f"emitted but unstyled in {label}: "
                           f"{', '.join(unstyled)} -- the builder names a "
                           f"class the skeleton does not have. Fix the "
                           f"spelling in build.py, add the rule to "
                           f"skeleton.html, or declare it in register.py's "
                           f"HOOKS")
        seen |= used
    # The UNION over the corpus, not the largest single document: "54
    # distinct" reading as a per-file maximum would understate the seam the
    # moment a second argument emits a class the first never does.
    return True, (f"every emitted class has a rule in the skeleton "
                  f"({len(seen)} distinct, over {len(body)} argument(s))")


# --------------------------------------------------------------------------
# 4 - the engine is COPIED, and this makes that a machine fact
# --------------------------------------------------------------------------
def check_skeleton_verbatim(skeleton=None, corpus_html=None, **_):
    """The doctrine of #97 in one assertion, plus the number it predicts.

    The skeleton does not drift because it is not regenerated -- it is
    copied. The percentage is printed and not asserted against a threshold:
    it is the measurement the premise is about, and a ceiling on it would be
    a second, weaker rule sitting on top of an exact one.
    """
    sk = _sk(skeleton)
    body = _body(corpus_html)
    worst = None
    for label, html in body:
        try:
            segs, fills = split(sk, html)
        except AssertionError as e:
            return False, f"{label}: {e}"
        kept = sum(len(s.encode()) for s in segs)
        wrote = sum(len(f.encode()) for f in fills)
        share = wrote / (kept + wrote) * 100
        if worst is None or share > worst[3]:
            worst = (label, kept, wrote, share)
    label, kept, wrote, share = worst
    return True, (f"{kept:,} B of engine copied verbatim - {wrote:,} B "
                  f"written from the argument ({share:.2f}%, worst of "
                  f"{len(body)} in {label})")


# --------------------------------------------------------------------------
# 5 - no per-presentation CSS, ever
# --------------------------------------------------------------------------
def check_no_generated_css(skeleton=None, corpus_html=None, **_):
    """One <style>, and it is the engine's. This is what makes two different
    presentations the same identity instead of two approximations of it."""
    sk = _sk(skeleton)
    body = _body(corpus_html)
    for label, html in body:
        n = len(re.findall(r"<style", html))
        if n != 1:
            return False, (f"{label}: output has {n} <style> blocks, must be "
                           f"exactly 1 -- no CSS is generated per "
                           f"presentation; put the rule in skeleton.html")
        if _style(html) != _style(sk):
            return False, (f"{label}: the output's <style> differs from the "
                           f"skeleton's -- CSS was generated for this "
                           f"presentation. Put the rule in skeleton.html")
        try:
            _, fills = split(sk, html)
        except AssertionError as e:
            return False, f"{label}: {e}"
        for f in fills:
            if "<style" in f or "</style>" in f:
                return False, (f"{label}: a fill carries a <style> block -- "
                               f"geometry does not cross this seam; put the "
                               f"rule in skeleton.html")
    return True, (f"one <style>, byte-identical to the skeleton's "
                  f"({len(body)} argument(s))")


# --------------------------------------------------------------------------
# 6 - what the skeleton declares is what the builder fills
# --------------------------------------------------------------------------
def check_markers(skeleton=None, fills=None, **_):
    """Set equality in BOTH directions, and it needs both directions.

    A marker nobody fills leaves an HTML comment in the output; a fill nobody
    declares is a hole the builder thinks it has and does not. `build.FILLS`
    is data on purpose -- an extractor that greps this file's source is the
    one extractor that rots on a refactor.
    """
    sk = _sk(skeleton)
    declared = re.findall(r"<!--P:([A-Z]+)-->", sk)
    dupes = sorted({m for m in declared if declared.count(m) > 1})
    if dupes:
        return False, (f"marker(s) declared more than once in skeleton.html: "
                       f"{', '.join(dupes)} -- a marker is one hole; delete "
                       f"the duplicate")
    filled = set(build.FILLS if fills is None else fills)
    if filled != set(declared):
        only_sk = sorted(set(declared) - filled)
        only_b = sorted(filled - set(declared))
        parts = []
        if only_sk:
            parts.append(f"declared but never filled: {', '.join(only_sk)} -- "
                         f"add it to build.FILLS or delete the marker")
        if only_b:
            parts.append(f"filled but not declared: {', '.join(only_b)} -- "
                         f"add the marker to skeleton.html or drop it from "
                         f"build.FILLS")
        return False, "; ".join(parts)
    return True, (f"{len(declared)} markers, declared and filled: "
                  f"{', '.join(declared)}")


FAMILIES = [
    ("doc-current", check_doc_current),
    ("register-skeleton", check_register_skeleton),
    ("emitted-classes", check_emitted_classes),
    ("skeleton-verbatim", check_skeleton_verbatim),
    ("no-generated-css", check_no_generated_css),
    ("markers", check_markers),
]

BY_NAME = dict(FAMILIES)


def run(quiet=False, **over):
    """Run every family. Returns the number of reds."""
    bad = 0
    for name, fn in FAMILIES:
        try:
            ok, msg = fn(**over)
        except Exception as e:                                  # noqa: BLE001
            ok, msg = False, f"{type(e).__name__}: {e}"
        bad += not ok
        if not quiet:
            print(f"  {'ok  ' if ok else 'FAIL'} {name:<19} {msg}")
    return bad


def main(argv):
    print("architecture:")
    # Reading the corpus is the one step outside a family, so it is the one
    # step whose failure would otherwise reach the terminal as a traceback.
    # A traceback is a red that names no fix, which is what ADR 0001 rules
    # out -- and every red raised in there already names one, so the handler
    # prints the message rather than dressing it in a guess of its own.
    try:
        body = corpus(read_corpus_flag(argv))
    except (AssertionError, OSError) as e:
        print(f"  FAIL corpus              {e}")
        return 1
    return run(corpus_html=body)


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1:]) else 0)
