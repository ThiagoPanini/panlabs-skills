#!/usr/bin/env python3
"""Extract the deck's topographic-contour texture from the layouts, as SVG.

    extract_texture.py <extracted-ooxml-dir> <out-dir>

WHAT THE TEXTURE ACTUALLY IS, measured in issue #92 and re-derived here on every
run: not an image, not a tile, and not a byte of media. It is a <p:grpSp> of
custGeom shapes filled with EXACTLY the background colour (#141415) and carrying
no stroke -- so the only thing visible is their `outerShdw`, the same shadow
token the rest of the deck uses, at 61-80% alpha. The transform chain runs path
space -> shape EMU -> group child space -> slide EMU -> px, and every link of it
has to be walked or the motif lands in the wrong place at the wrong scale.

CSS cannot do this, and the reason is structural rather than a matter of tuning:
`repeating-radial-gradient` draws concentric ellipses, and this is a field of
branching parallel contours. #92 swept it and got a correlation of -0,001.

The script sweeps every layout, extracts every contour group it finds, and
de-duplicates by path signature -- so it reports how many DISTINCT motifs the
deck has rather than trusting a number written down somewhere.
"""

import hashlib
import os
import sys
import xml.etree.ElementTree as ET

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"

SLIDE_W_EMU, SLIDE_H_EMU = 9144000, 5143500
VIEW_W, VIEW_H = 1600.0, 900.0
EMU_PT = 12700.0
PT_PX = VIEW_W / 720.0  # the slide box is 720 pt wide


def _xfrm(node):
    off, ext = node.find(f"{A}off"), node.find(f"{A}ext")
    ch_off, ch_ext = node.find(f"{A}chOff"), node.find(f"{A}chExt")
    return dict(
        x=int(off.get("x")), y=int(off.get("y")),
        cx=int(ext.get("cx")), cy=int(ext.get("cy")),
        chx=int(ch_off.get("x")) if ch_off is not None else 0,
        chy=int(ch_off.get("y")) if ch_off is not None else 0,
        chcx=int(ch_ext.get("cx")) if ch_ext is not None else 0,
        chcy=int(ch_ext.get("cy")) if ch_ext is not None else 0,
        flip_h=node.get("flipH") == "1", flip_v=node.get("flipV") == "1",
    )


def contour_groups(layout_path):
    """Every <p:grpSp> in this layout whose shapes are shadow-only custGeom."""
    root = ET.parse(layout_path).getroot()
    out = []
    for grp in root.iter(f"{P}grpSp"):
        gpr = grp.find(f"{P}grpSpPr")
        gx = gpr.find(f"{A}xfrm") if gpr is not None else None
        if gx is None:
            continue
        shapes = [sp for sp in grp.iter(f"{P}sp")
                  if (spPr := sp.find(f"{P}spPr")) is not None
                  and spPr.find(f"{A}custGeom") is not None
                  and spPr.find(f"{A}effectLst/{A}outerShdw") is not None]
        if shapes:
            out.append((_xfrm(gx), shapes))
    return out


def raw_signature(group):
    """Identity of a motif, taken in PATH space -- before any transform.

    The converted paths carry the placement's own scale, offset and mirror, so
    hashing those makes one motif look like as many motifs as it has placements.
    The deck's three motifs appear at 3,93x-4,50x and one of them mirrored; only
    the untransformed coordinates collapse them.
    """
    _, shapes = group
    acc = []
    for sp in shapes:
        for pth in sp.find(f"{P}spPr").findall(f"{A}custGeom/{A}pathLst/{A}path"):
            for cmd in pth:
                for pt in cmd.findall(f"{A}pt"):
                    acc.append(f"{pt.get('x')},{pt.get('y')}")
    return hashlib.sha1(";".join(sorted(acc)).encode()).hexdigest()[:12]


def extract(group):
    g, shapes = group
    if not g["chcx"] or not g["chcy"]:
        return [], None, None
    sx, sy = g["cx"] / g["chcx"], g["cy"] / g["chcy"]

    def to_px(ex, ey):
        X = g["x"] + (ex - g["chx"]) * sx
        Y = g["y"] + (ey - g["chy"]) * sy
        if g["flip_h"]:
            X = g["x"] + g["cx"] - (X - g["x"])
        if g["flip_v"]:
            Y = g["y"] + g["cy"] - (Y - g["y"])
        return X / SLIDE_W_EMU * VIEW_W, Y / SLIDE_H_EMU * VIEW_H

    paths, shadow = [], None
    for sp in shapes:
        spPr = sp.find(f"{P}spPr")
        sh = _xfrm(spPr.find(f"{A}xfrm"))
        if shadow is None:
            sd = spPr.find(f"{A}effectLst/{A}outerShdw")
            al = sd.find(f"{A}srgbClr/{A}alpha")
            shadow = dict(blur_px=int(sd.get("blurRad")) / EMU_PT * PT_PX,
                          dist_px=int(sd.get("dist")) / EMU_PT * PT_PX,
                          dir_deg=int(sd.get("dir")) / 60000,
                          alpha=(int(al.get("val")) / 100000) if al is not None else 1.0)
        for pth in spPr.findall(f"{A}custGeom/{A}pathLst/{A}path"):
            pw = int(pth.get("w") or 1) or 1
            ph = int(pth.get("h") or 1) or 1

            def conv(pt, sh=sh, pw=pw, ph=ph):
                ex = sh["x"] + int(pt.get("x")) * sh["cx"] / pw
                ey = sh["y"] + int(pt.get("y")) * sh["cy"] / ph
                if sh["flip_h"]:
                    ex = sh["x"] + sh["cx"] - (ex - sh["x"])
                if sh["flip_v"]:
                    ey = sh["y"] + sh["cy"] - (ey - sh["y"])
                return to_px(ex, ey)

            d = []
            for cmd in pth:
                tag = cmd.tag[len(A):]
                pts = [conv(p) for p in cmd.findall(f"{A}pt")]
                if tag == "moveTo":
                    d.append("M%.2f %.2f" % pts[0])
                elif tag == "lnTo":
                    d.append("L%.2f %.2f" % pts[0])
                elif tag == "cubicBezTo":
                    d.append("C%.2f %.2f %.2f %.2f %.2f %.2f" % (*pts[0], *pts[1], *pts[2]))
                elif tag == "close":
                    d.append("Z")
            if d:
                paths.append("".join(d))
    return paths, shadow, (sx + sy) / 2


def svg(paths, shadow, bg="#141415"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{VIEW_W:.0f}" height="{VIEW_H:.0f}" '
        f'viewBox="0 0 {VIEW_W:.0f} {VIEW_H:.0f}" preserveAspectRatio="none">'
        f"<!-- Derivado por tools/extract_texture.py. As formas são preenchidas com a cor do "
        f"fundo e sem traço: só a sombra aparece. -->"
        f'<defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%" '
        f'color-interpolation-filters="sRGB">'
        f'<feDropShadow dx="0" dy="{shadow["dist_px"]:.2f}" '
        f'stdDeviation="{shadow["blur_px"] / 3:.2f}" flood-color="#000" '
        f'flood-opacity="{shadow["alpha"]:.2f}"/></filter></defs>'
        f'<g fill="{bg}" filter="url(#s)">'
        + "".join(f'<path d="{d}"/>' for d in paths)
        + "</g></svg>"
    )


def main():
    if len(sys.argv) != 3:
        print("uso: extract_texture.py <ooxml-extraido> <out-dir>", file=sys.stderr)
        return 2
    base, out_dir = (os.path.abspath(p) for p in sys.argv[1:3])
    lay_dir = os.path.join(base, "ppt", "slideLayouts")
    os.makedirs(out_dir, exist_ok=True)

    seen, motifs = {}, []
    n_groups = 0
    for name in sorted(os.listdir(lay_dir),
                       key=lambda s: int("".join(c for c in s if c.isdigit()) or 0)):
        if not name.endswith(".xml"):
            continue
        for gi, group in enumerate(contour_groups(os.path.join(lay_dir, name))):
            paths, shadow, scale = extract(group)
            if not paths:
                continue
            n_groups += 1
            sig = raw_signature(group)
            if sig in seen:
                seen[sig]["placements"].append(dict(layout=name, group=gi,
                                                    scale=round(scale, 3),
                                                    alpha=round(shadow["alpha"], 2)))
                continue
            rec = dict(sig=sig, n_paths=len(paths), first=name,
                       placements=[dict(layout=name, group=gi, scale=round(scale, 3),
                                        alpha=round(shadow["alpha"], 2))],
                       paths=paths, shadow=shadow)
            seen[sig] = rec
            motifs.append(rec)

    print(f"{n_groups} colocações da textura em {len(motifs)} motivos distintos")
    total = 0
    for k, m in enumerate(motifs):
        path = os.path.join(out_dir, f"texture-{chr(ord('a') + k)}.svg")
        open(path, "w").write(svg(m["paths"], m["shadow"]))
        size = os.path.getsize(path)
        total += size
        print(f"  {os.path.basename(path)}: {m['n_paths']:>3} traços, "
              f"{len(m['placements'])} colocações, {size / 1024:.1f} KB "
              f"(primeiro em {m['first']}, alpha {m['shadow']['alpha']:.2f})")
    print(f"  total {total / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
