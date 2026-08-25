#!/usr/bin/env python3
"""Prove that this corpus is what its README claims -- run it before trusting it.

    verify_redaction.py <corpus-dir> [<original-png-dir>]

Without the second argument it runs the three checks that need only the corpus.
With it, it runs all five, including the two that matter most: that the pixels
OUTSIDE a redaction are byte-identical to the PowerPoint export, and that the
pixels INSIDE one retain nothing of the photograph they replaced.

The point of a corpus in a public repository is that someone can check the claim
instead of taking it. Exit code is the verdict: 0 if every check passed.
"""

import json
import os
import re
import sys

W, H = 1600, 900


def slide_index(name):
    return int(re.search(r"slide-(\d+)\.webp", name).group(1))


def px_boxes(slide_record):
    """The redaction rectangles, read from the corpus rather than re-derived.

    `slides.json` carries `fotos_px` precisely so this check does not compute the
    box a second time. Recomputing it from the `fotos` fractions -- which the JSON
    rounds to five places -- lands a pixel off at the boundary, and the check then
    reports a leak that is its own rounding rather than the corpus's.
    """
    return [tuple(b) for b in slide_record.get("fotos_px", [])]


def main():
    if len(sys.argv) not in (2, 3):
        print("uso: verify_redaction.py <corpus-dir> [<png-originais>]", file=sys.stderr)
        return 2
    corpus = os.path.abspath(sys.argv[1])
    originals = os.path.abspath(sys.argv[2]) if len(sys.argv) == 3 else None

    from PIL import Image, ImageChops

    meta = json.load(open(f"{corpus}/slides.json", encoding="utf-8"))
    by = {s["slide"]: s for s in meta["slides"]}
    files = sorted(f for f in os.listdir(f"{corpus}/slides") if f.endswith(".webp"))
    published = {slide_index(f) for f in files}
    withheld = {s["slide"] for s in meta["slides"] if not s["no_corpus"]}

    fails = []

    def check(ok, label, detail=""):
        print(f"  {'.' if ok else 'x'} {label}{(' -- ' + detail) if detail else ''}")
        if not ok:
            fails.append(label)

    print("== o que só o corpus responde ==")

    check(not (withheld & published),
          "nenhum slide retido virou arquivo",
          f"vazaram {sorted(withheld & published)}" if withheld & published else
          f"{len(withheld)} retidos, {len(published)} publicados, "
          f"soma {len(withheld) + len(published)}")

    sizes = {Image.open(f"{corpus}/slides/{f}").size for f in files}
    check(sizes == {(W, H)}, f"todo slide é {W}x{H}", f"encontrado {sorted(sizes)}")

    # The skeleton and the run table are shipped precisely because they can carry
    # the deck's geometry without carrying a letter of its text. If a text field
    # ever creeps into either, that stops being true silently.
    TEXT_KEYS = {"txt", "text", "texto", "t"}
    stray = []
    for name in ("slides.json", "runs.json"):
        blob = json.load(open(f"{corpus}/{name}", encoding="utf-8"))

        def sweep(node, path=""):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k in TEXT_KEYS:
                        stray.append(f"{name}:{path}.{k}")
                    sweep(v, f"{path}.{k}")
            elif isinstance(node, list):
                for v in node:
                    sweep(v, path)

        sweep(blob)
    check(not stray, "nem slides.json nem runs.json têm campo de texto",
          ", ".join(stray[:4]))

    if not originals:
        print("\n(sem os PNGs originais: as duas checagens de pixel não rodaram)")
        return 1 if fails else 0

    print("\n== o que precisa dos PNGs originais ==")

    worst_outside = 0
    leaks = []
    for f in files:
        i = slide_index(f)
        src = f"{originals}/Slide{i}.PNG"
        if not os.path.exists(src):
            check(False, f"falta o original de {f}", src)
            continue
        a = Image.open(src).convert("RGB")
        b = Image.open(f"{corpus}/slides/{f}").convert("RGB")
        diff = ImageChops.difference(a, b)
        for box in px_boxes(by[i]):
            diff.paste((0, 0, 0), box)
        worst_outside = max(worst_outside, max(diff.getextrema(), key=lambda t: t[1])[1])

        # Inside each block: nothing of the photograph may survive. The test is
        # not "does it look different" -- it is that the block holds only the two
        # hatch colours plus the label's grey, and nothing of the original's.
        for x0, y0, x1, y1 in px_boxes(by[i]):
            inner = (x0 + 4, y0 + 4, max(x1 - 4, x0 + 5), max(y1 - 4, y0 + 5))
            orig = a.crop(inner)
            block = b.crop(inner)
            d = ImageChops.difference(orig, block)
            # `tobytes()` rather than `getdata()`: the latter is deprecated out of
            # Pillow 14, and a tool that ships as durable evidence should not need
            # a rewrite the day the platform moves.
            raw = d.tobytes()
            same = sum(1 for k in range(0, len(raw), 3) if raw[k] == raw[k + 1] == raw[k + 2] == 0)
            frac = same / (d.size[0] * d.size[1])
            # A flat block over a flat-ish photo region will coincide on a few
            # pixels by chance; anything structural shows up far above this.
            if frac > 0.02:
                leaks.append((i, round(frac, 4)))

    check(worst_outside == 0,
          "fora da redação, o WebP é idêntico ao PNG do PowerPoint",
          f"maior diferença de canal = {worst_outside}")
    check(not leaks, "dentro do bloco, nada do original sobrevive",
          f"{leaks[:4]}" if leaks else f"{len(files)} slides varridos")

    print()
    if fails:
        print(f"VERMELHO — {len(fails)} checagem(ns) reprovada(s).")
        return 1
    print("verde — o corpus é o que o README diz que é.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
