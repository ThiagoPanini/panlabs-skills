#!/usr/bin/env python3
"""Verifies, shape by shape, that the rendered PNG shows the icon — not an empty box.

    python3 verify-render.py tests/sample.png tests/sample.manifest.json

"Empty box" has a mechanical definition, not a visual one:

  * Service Icon  — the square is `fillColor` and the glyph is painted in `strokeColor`
    (#ffffff) with a 10% inset. If `resIcon` points to a stencil that doesn't
    exist, mxGraph paints only the square. So: within the central 80% there must
    be white pixels. Zero white = empty box.

  * Plain Resource Icon — there's no square; the glyph is `fillColor` over the
    page background. A missing stencil draws nothing. So: there must be pixels
    of the fill color in the region.

  * Group — the border in `strokeColor`, and the `grIcon` (25px) in the top-left
    corner, or centered in `groupCenter`. The label starts after
    spacingLeft=30, so the icon window doesn't reach it.

The diagram-coordinate -> pixel mapping comes from the two magenta markers,
not from guessing the exporter's margin and scale.
"""
import json
import sys
from collections import Counter

from PIL import Image

TOL = 14            # per-channel tolerance, for the exporter's antialiasing
MIN_GLYPH = 20       # minimum pixels to call it a "drawn glyph"
MIN_EDGE = 20
SOLID_CEILING = 0.90  # above this the box is filled, not drawn


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def close_to(px, target, tol=TOL):
    return all(abs(px[i] - target[i]) <= tol for i in range(3))


def count(img, box, color, tol=TOL):
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, img.width), min(y1, img.height)
    if x1 <= x0 or y1 <= y0:
        return 0, 0
    b = img.crop((x0, y0, x1, y1)).convert('RGB').tobytes()
    n = sum(1 for i in range(0, len(b), 3)
            if close_to((b[i], b[i + 1], b[i + 2]), color, tol))
    return n, len(b) // 3


def calibrate(img, calib):
    target = hex2rgb(calib['color'])
    rgb = img.convert('RGB')
    points = [(x, y) for y in range(img.height) for x in range(img.width)
              if close_to(rgb.getpixel((x, y)), target, 6)]
    if not points:
        sys.exit('FAIL: no magenta calibration marker found in the PNG')

    mid_x = (min(p[0] for p in points) + max(p[0] for p in points)) / 2
    mid_y = (min(p[1] for p in points) + max(p[1] for p in points)) / 2
    a = [p for p in points if p[0] <= mid_x and p[1] <= mid_y]
    b = [p for p in points if p[0] > mid_x and p[1] > mid_y]
    if not a or not b:
        sys.exit('FAIL: calibration markers do not form two distinct corners')

    ax, ay = min(p[0] for p in a), min(p[1] for p in a)
    bx, by = min(p[0] for p in b), min(p[1] for p in b)
    dx = calib['b']['x'] - calib['a']['x']
    dy = calib['b']['y'] - calib['a']['y']
    sx, sy = (bx - ax) / dx, (by - ay) / dy
    ox, oy = ax - calib['a']['x'] * sx, ay - calib['a']['y'] * sy
    return ox, oy, sx, sy


def main():
    png, manifest_path = sys.argv[1], sys.argv[2]
    img = Image.open(png)
    m = json.load(open(manifest_path))

    ox, oy, sx, sy = calibrate(img, m['calibration'])
    print(f'{png}  {img.width}x{img.height}px')
    print(f'calibration: scale {sx:.3f}x{sy:.3f}, origin ({ox:.1f},{oy:.1f})')
    print()

    def box(x, y, w, h, inset=0.0):
        return (ox + (x + w * inset) * sx, oy + (y + h * inset) * sy,
                ox + (x + w * (1 - inset)) * sx, oy + (y + h * (1 - inset)) * sy)

    failures, ok = [], 0

    def judge(name, passed, detail):
        nonlocal ok
        if passed:
            ok += 1
            print(f'  ok    {name:34s} {detail}')
        else:
            failures.append(f'  FAIL  {name:34s} {detail}')
            print(f'  FAIL  {name:34s} {detail}')

    def check_icon(label, c, fill, glyph, kind):
        # glyph drawn with a 10% inset -> look at the central 80%
        n_glyph, _ = count(img, box(c['x'], c['y'], c['w'], c['h'], 0.16),
                            hex2rgb(glyph))
        n_fill, total = count(img, box(c['x'], c['y'], c['w'], c['h']), hex2rgb(fill))
        if kind == 'svc':
            judge(label, n_glyph >= MIN_GLYPH and n_fill >= MIN_GLYPH,
                   f'glyph {n_glyph}px / square {n_fill}px')
        else:
            # A `shape=mxgraph.aws4.<nonexistent>` draws NOTHING: mxGraph
            # falls back to the default rectangle, which comes out filled edge
            # to edge with fillColor. Counting just "has a pixel of the color"
            # would approve exactly the case we want to catch — hence the
            # density ceiling.
            density = n_fill / total if total else 0
            judge(label, n_fill >= MIN_GLYPH and density < SOLID_CEILING,
                   f'glyph {n_fill}px ({density:.0%} of the box, color {fill})'
                   + ('  <- solid block, not a glyph' if density >= SOLID_CEILING else ''))

    print('— loose icons —')
    for c in m['cells']:
        if c['kind'] in ('svc', 'res'):
            check_icon(f"{c['requested']} [{c['via']}]", c, c['fill'], c['glyph'], c['kind'])

    print()
    print('— groups —')
    for c in m['cells']:
        if c['kind'] != 'group':
            continue
        label = c['requested']

        if c['edge']:
            # outer ring: 4 bands 4px thick along the perimeter
            b = hex2rgb(c['edge'])
            n = 0
            for cx in (box(c['x'], c['y'], c['w'], 4),
                       box(c['x'], c['y'] + c['h'] - 4, c['w'], 4),
                       box(c['x'], c['y'], 4, c['h']),
                       box(c['x'] + c['w'] - 4, c['y'], 4, c['h'])):
                n += count(img, cx, b)[0]
            judge(f'{label} · edge', n >= MIN_EDGE, f'{n}px of {c["edge"]}')

        if c['grIcon'] and c['edge']:
            # grIcon window: 25px, top-left corner (or centered in
            # groupCenter), 3px off the edge and before spacingLeft=30
            if c['shapeClass'] == 'groupCenter':
                gx = c['x'] + c['w'] / 2 - 12
            else:
                gx = c['x'] + 3
            n, _ = count(img, box(gx, c['y'] + 3, 22, 21), hex2rgb(c['edge']))
            judge(f'{label} · grIcon', n >= MIN_GLYPH,
                   f'{n}px of {c["edge"]} in {c["grIcon"]}')

        f = c['child']
        check_icon(f'{label} · nested child', f, f['fill'], f['glyph'], 'svc')

    print()
    if failures:
        print(f'{len(failures)} failure(s) out of {ok + len(failures)} checks.')
        sys.exit(1)
    print(f'all {ok} pixel checks passed — no shape came out as an empty box.')


if __name__ == '__main__':
    main()
