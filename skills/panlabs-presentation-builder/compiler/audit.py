"""The audit: every ruler that reads the source, and the report they write.

A RULER MEASURES A DEFECT, NOT A TASTE. Whether the deck is any good is what
the contact sheet and a pair of eyes are for; what belongs here is the class
of mistake the eye does not catch -- a class that is not in the catalog, a
slot that is missing, a budget that is over.

EVERY RED NAMES ITS OWN FIX, IN THE IMPERATIVE. "unknown class" is a
diagnosis and leaves the reader to guess; "drop the class …" is the repair.
The proof beside this file asserts the fix, not the diagnosis, which is what
stops the message from being rewritten into a shrug.

The report is printed by the build command on every run, green or red, so
that "what is wrong with this deck" is answerable without opening a browser.
"""

from dataclasses import dataclass

from catalog import INLINE_TAGS, PATTERNS, SLOT_TAG, pattern_names, slots_of


@dataclass(frozen=True)
class Ruler:
    name: str
    headline: str


@dataclass
class Verdict:
    ruler: Ruler
    fixes: list

    @property
    def ok(self):
        return not self.fixes


VOCABULARY = Ruler(
    "vocabulary",
    "every pattern, class and tag in the source is one the catalog declares",
)


def _slot_list(pattern):
    slots = slots_of(pattern)
    count = "one slot" if len(slots) == 1 else f"{len(slots)} slots"
    return f'the pattern "{pattern}" declares {count}: ' + ", ".join(slots)


def _emphasis(node, at, slot):
    """Everything below a slot: emphasis the dialect knows, and no attributes."""
    fixes = []
    for child in node.children:
        if isinstance(child, str):
            continue
        if child.tag not in INLINE_TAGS:
            fixes.append(
                f'{at}, slot "{slot}": drop the <{child.tag}> — the emphasis '
                "the dialect knows is " + " and ".join(f"<{t}>" for t in INLINE_TAGS)
            )
            continue
        for key in sorted(child.attrs):
            fixes.append(
                f'{at}, slot "{slot}": drop {key}= from the <{child.tag}> — '
                "geometry does not cross this seam"
            )
        fixes.extend(_emphasis(child, at, slot))
    return fixes


def _slot(el, at, pattern, seen):
    fixes = []
    if el.tag != SLOT_TAG:
        return [
            f"{at}: write the slot as <{SLOT_TAG}>, not <{el.tag}> — every "
            "text slot in this dialect is a paragraph"
        ]

    for key in sorted(k for k in el.attrs if k != "class"):
        fixes.append(
            f"{at}: drop {key}= from the <{SLOT_TAG}> — a slot carries "
            "class= and nothing else"
        )

    classes = el.attrs.get("class", "").split()
    if not classes:
        return fixes + [
            f"{at}: name the <{SLOT_TAG}> with a class — " + _slot_list(pattern)
        ]
    if len(classes) > 1:
        fixes.append(
            f"{at}: keep one class on the <{SLOT_TAG}> — a slot has one name, "
            f'and "{" ".join(classes)}" is {len(classes)}'
        )

    for name in classes:
        if name in slots_of(pattern):
            seen.append(name)
        else:
            fixes.append(f'{at}: drop the class "{name}" — ' + _slot_list(pattern))

    fixes.extend(_emphasis(el, at, classes[0]))
    return fixes


def _slide(node, n):
    fixes = []
    at = f"slide {n} (line {node.line})"

    for key in sorted(k for k in node.attrs if k != "pattern"):
        fixes.append(
            f"{at}: drop {key}= from the <section> — a section carries "
            "pattern= and nothing else"
        )

    known = ", ".join(pattern_names())
    pattern = node.attrs.get("pattern")
    if not pattern:
        return fixes + [f"{at}: give the <section> a pattern= from the catalog: {known}"]
    if pattern not in PATTERNS:
        return fixes + [
            f'{at}: replace the pattern "{pattern}" with one the catalog '
            f"declares: {known}"
        ]

    seen = []
    for child in node.children:
        if isinstance(child, str):
            if child.strip():
                fixes.append(
                    f"{at}: wrap the loose text in a slot — " + _slot_list(pattern)
                )
            continue
        fixes.extend(_slot(child, at, pattern, seen))

    for want in PATTERNS[pattern].required:
        if want not in seen:
            fixes.append(
                f'{at}: add the missing <{SLOT_TAG} class="{want}"> — the '
                f'pattern "{pattern}" is not itself without it'
            )
    for name in sorted(set(s for s in seen if seen.count(s) > 1)):
        fixes.append(
            f'{at}: keep one <{SLOT_TAG} class="{name}"> — the pattern '
            f'"{pattern}" declares the slot once'
        )
    return fixes


def _vocabulary(deck):
    fixes = []
    n = 0
    for node in deck.slides:
        if node.tag != "section":
            fixes.append(
                f"line {node.line}: drop the <{node.tag}> — a deck holds "
                "<section> and nothing else"
            )
            continue
        n += 1
        fixes.extend(_slide(node, n))
    return fixes


RULERS = ((VOCABULARY, _vocabulary),)


def audit(deck):
    """Every ruler over one deck, in a stable order."""
    return [Verdict(ruler, measure(deck)) for ruler, measure in RULERS]


def report(deck, theme, verdicts):
    """The audit, as the build command prints it."""
    slides = sum(1 for s in deck.slides if s.tag == "section")
    plural = "slide" if slides == 1 else "slides"
    lines = [f'── audit · "{deck.title}" · theme {theme} · {slides} {plural}']
    for v in verdicts:
        lines.append(f"   {'✓' if v.ok else '✗'} {v.ruler.name} · {v.ruler.headline}")
        for fix in v.fixes:
            lines.append(f"       | {fix}")

    reds = sum(1 for v in verdicts if not v.ok)
    total = f"{len(verdicts)} ruler" + ("" if len(verdicts) == 1 else "s")
    lines.append(
        f"   {total}, {reds} red — nothing was written" if reds
        else f"   {total}, green"
    )
    return "\n".join(lines)
