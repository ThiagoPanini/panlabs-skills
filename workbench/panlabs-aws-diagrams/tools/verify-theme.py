#!/usr/bin/env python3
"""Checks AT THE PIXEL that the theme reached the render — not just the style string.

    python3 tools/verify-theme.py <dir>/themes/a-light.png light
    python3 tools/verify-theme.py --all <dir>/themes

The lesson that forces this tool is #17's: 24 static checks were green when the
PNG revealed SageMaker coming out with the wrong icon. A correct style string is
not a correct render.

Each theme becomes a list of colour assertions, and each assertion is either
PRESENT (the colour must appear, above a pixel floor) or ABSENT (the colour must
not appear anywhere). The absences are the most informative: they are the proof
that a #13 decision did in fact override the catalog.
"""
import sys
from pathlib import Path

from PIL import Image

# Two tolerances, and the asymmetry is the point.
#
# PRESENCE accepts ±10 per channel, because the requested colour reaches the PNG
# surrounded by antialias and the core may vary a little.
#
# ABSENCE demands ±3, plus an area floor. At ±10 the check reported #232F3E as
# "present" in the dark render — 13,909 px. Locating the pixels, they were ~80
# SPARSE points spread from x=30 to x=2584: the antialias fringe of white text on
# a dark background passes through there on the way. A colour that really is in
# the drawing forms a REGION; antialias forms dust. The area floor is what
# separates the two.
PRESENT_TOL = 10
ABSENT_TOL = 3
PRESENT_FLOOR = 40      # minimum pixels to call a colour "present"
ABSENT_FLOOR = 400      # below this it is antialias dust, not a region


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def count(img, target, tol=PRESENT_TOL):
    a = hex2rgb(target)
    n = 0
    for (c, px) in img.getcolors(maxcolors=1 << 24) or []:
        if all(abs(px[i] - a[i]) <= tol for i in range(3)):
            n += c
    return n


def dominant(img):
    colors = img.getcolors(maxcolors=1 << 24) or []
    c, px = max(colors, key=lambda t: t[0])
    return '#%02X%02X%02X' % px[:3], c / (img.width * img.height)


# The assertions that do not depend on the theme — they are #13 decisions against
# the catalog.
UNIVERSAL = [
    ('absent', '#AAB7B8', 'gray VPC label: the catalog delivers it, the theme overrides it (2.06:1 on white)'),
    ('absent', '#248814', 'dark green Public subnet label: same'),
    # Do NOT assert here that draw.io's FIXED tint (#E6F6F7) is absent. The
    # assertion would be UNDECIDABLE, and for a reason that is precisely the
    # finding: the value derived in the light theme is #E6F6F6 — a single step of
    # blue away. No pixel tolerance separates the two, because they are the same
    # colour. An assertion that cannot fail is worth no more than a check that
    # cannot fail. Where it DOES decide is in the dark theme, and that is where it
    # lives.
]

PER_THEME = {
    'light':       [('present', '#E6F6F6', 'tint derived from Private subnet — 10% of #00A4A6 over white'),
                    ('present', '#F2F6E8', "tint derived from Public subnet — 10% of #7AA116, identical to draw.io's"),
                    ('present', '#FFFFFF', 'page background'),
                    ('present', '#232F3E', 'strong ink / AWS Cloud border'),
                    ('present', '#ED7100', 'the Lambda square — category colour untouched'),
                    ('present', '#8C4FFF', 'VPC border — normative colour untouched')],
    'dark':        [('present', '#1C1C1C', 'page background, neutral and darker (the #13 turn)'),
                    ('present', '#192A2A', 'tint derived in the dark: the SAME rule, another background'),
                    ('present', '#FFFFFF', 'strong ink / AWS Cloud inverted, as in the dark deck'),
                    ('absent',  '#161E2D', 'the previous night blue: replaced, must not remain'),
                    ('absent',  '#E6F6F7', "draw.io's FIXED tint: here the derivation DECIDES, and it goes"),
                    ('present', '#ED7100', 'category colour does NOT change between decks'),
                    ('present', '#8C4FFF', 'VPC border does NOT change between decks'),
                    ('absent',  '#232F3E', 'squid ink: 1.23:1 on the dark background — must be entirely gone')],
    'corporate':   [('present', '#FFFFFF', 'background — the ruler allows no off-white'),
                    ('present', '#545B64', "arrow in the ink of draw.io's AWS templates"),
                    ('present', '#ED7100', 'category colour untouched')],
    'trap':        [('present', '#F2F3F5', 'the off-white the gate rejects'),
                    ('present', '#AAB7B8', 'the pale ink the gate rejects')],
    # logical view: pre-services, so the AWS palette barely shows — what shows is
    # the house box, and it is the only visual proof that the `block.*` tokens
    # reach the render
    'logical':     [('present', '#FFFFFF', 'background and block fill'),
                    ('present', '#232F3E', "block border in the theme's strong ink"),
                    ('absent',  '#8C4FFF', 'no category colour: there is no named service')],
    # the unspeakable: proof that the raw patch landed, and that the colour legend
    # is gone. `#8C4FFF` is left out on purpose: the patch swaps `strokeColor` (the
    # VPC border) and not `fillColor`, so the purple remains legitimate on the API
    # Gateway square — same colour, another role. That is exactly what
    # colour-as-legend loses.
    'unspeakable': [('present', '#1B6AC9', 'the house blue injected by hand into ALL THREE boundaries'),
                    ('absent',  '#00A4A6', 'teal of Region and Private subnet: erased'),
                    ('absent',  '#7AA116', 'green of Public subnet: erased')],
}

# these two exist to violate the universals; we do not apply them here
WITHOUT_UNIVERSAL = {'trap', 'unspeakable'}


def verify(png, theme):
    img = Image.open(png).convert('RGB')
    assertions = list(PER_THEME.get(theme, []))
    if theme not in WITHOUT_UNIVERSAL:
        assertions += UNIVERSAL
    dom, frac = dominant(img)
    print(f'\n{png.name}  ({img.width}×{img.height}, dominant {dom} at {frac:.0%})')
    failed = 0
    for mode, color, because in assertions:
        present = mode == 'present'
        n = count(img, color, PRESENT_TOL if present else ABSENT_TOL)
        ok = (n >= PRESENT_FLOOR) if present else (n < ABSENT_FLOOR)
        if not ok:
            failed = 1
        print(f'  {"✓" if ok else "✗"} {mode:8} {color}  {n:>8} px   {because}')
    return failed


def main():
    if '--all' in sys.argv:
        idx = sys.argv.index('--all')
        if len(sys.argv) <= idx + 1:
            sys.exit('usage: verify-theme.py --all <themes-dir>')
        themes_dir = Path(sys.argv[idx + 1])
        mapping = {'a-light': 'light', 'b-dark': 'dark',
                   'c-corporate': 'corporate', 'd-trap': 'trap',
                   'e-unspeakable': 'unspeakable', 'g-logical-view': 'logical'}
        failed = 0
        for name, theme in mapping.items():
            png = themes_dir / f'{name}.png'
            if not png.exists():
                print(f'\n{png.name} does not exist — render skipped (assumption 8)')
                continue
            failed |= verify(png, theme)
        print('\nPIXEL VERIFICATION RED' if failed else '\npixel verification green')
        sys.exit(failed)

    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sys.exit(verify(Path(sys.argv[1]), sys.argv[2]))


if __name__ == '__main__':
    main()
