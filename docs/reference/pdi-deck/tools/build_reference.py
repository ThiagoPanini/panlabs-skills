#!/usr/bin/env python3
"""Derive the durable reference corpus of the PDI deck from the source .pptx.

    build_reference.py <extracted-ooxml-dir> <exported-png-dir> <out-dir>

The three arguments are the two ephemeral inputs and the tracked output:

  <extracted-ooxml-dir>  the unzipped .pptx -- the directory holding `ppt/`
  <exported-png-dir>     Slide1.PNG .. Slide108.PNG, as `export_slides.ps1` writes them
  <out-dir>              the corpus root; everything under it is regenerated

NOTHING HERE IS TRANSCRIBED. Every number in `tokens.json` is derived from the
OOXML on this run. A token copied out of a ticket is a second copy of a
measurement, and the copy is the one that goes stale without anyone noticing.
The script needs no input but the two directories above -- the typeface
inheritance chain is resolved here, not read from a file some past session left
behind.

TWO REDACTIONS, and they are why this corpus can live in a public repo.

  1. Every photographic region is painted over with a hatched block. The deck's
     photographs are of identifiable people; the corpus needs the panel's
     position and size, not its content. Premise 3 of the map puts photography
     outside v1 entirely, so a flat block is a *more* faithful reference for what
     v1 will build than the photograph is. The block is drawn visibly as a
     redaction so no later reader takes it for a design element of the deck.

  2. A slide whose TEXT carries an employment-internal fact does not enter the
     corpus at all -- a raster cannot be redacted at the run level. Those slides
     still contribute their skeleton to `slides.json` and their runs to
     `runs.json`, neither of which holds a letter of text.

Both lists are declared below, in the open, so a later session can widen or
narrow them by editing one place and re-running.
"""

import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

AUTHORIAL = range(1, 50)  # the boundary, re-derived by `boundary()` on every run

# A photograph, told from an icon by the fraction of the slide width it covers.
# The gap is wide and the run reports it: the deck's photos never fall below
# 0.15, its icons and vendor logos never rise above 0.08.
PHOTO_MIN_W = 0.15

# Slides held out of the corpus because their TEXT carries an employment-internal
# fact -- promotion and bonus history, internal initiative and system names, an
# internal org unit, an org chart of named colleagues. Held out, not lost: they
# regenerate locally the moment someone narrows this dict and re-runs.
WITHHELD = {
    6: "histórico de promoções e bonificações",
    7: "histórico de promoções e bonificações",
    8: "histórico de promoções e bonificações",
    9: "escada de promoções com códigos internos de posição",
    25: "nomes de iniciativas internas",
    26: "nomes de iniciativas internas",
    27: "nomes de iniciativas internas",
    28: "nomes de iniciativas internas",
    29: "nomes de iniciativas internas",
    30: "nomes de iniciativas internas",
    33: "KR citando unidade organizacional interna",
    49: "organograma com nome, foto e cargo de terceiros",
}

EMU_W, EMU_H = 9144000, 5143500  # slide box, straight out of presentation.xml
PT_H = 405.0  # slide height in points -- the invariant ruler is % of this
EMU_PT = 12700
RENDER_W, RENDER_H = 1600, 900  # the export resolution -- 16:9 exact, no resample

TITLE_PH = {"title", "ctrTitle"}
BODY_PH = {"body", "subTitle"}


class Deck:
    """One unzipped .pptx, with the relationship graph resolved once."""

    def __init__(self, base):
        self.base = base
        self._cache = {}
        self.sl2lay, self.lay2mas = {}, {}
        for i in range(1, self.count() + 1):
            self.sl2lay[i] = self._rel_target(f"ppt/slides/_rels/slide{i}.xml.rels",
                                              "/slideLayout")
        for lay in set(self.sl2lay.values()):
            self.lay2mas[lay] = self._rel_target(
                f"ppt/slideLayouts/_rels/{lay}.rels", "/slideMaster")
        self.theme = {m: self._theme_of(m) for m in set(self.lay2mas.values()) if m}

    # ── plumbing ──
    def count(self):
        d = f"{self.base}/ppt/slides"
        return sum(1 for f in os.listdir(d) if re.fullmatch(r"slide\d+\.xml", f))

    def load(self, rel):
        if rel not in self._cache:
            self._cache[rel] = ET.parse(os.path.join(self.base, rel)).getroot()
        return self._cache[rel]

    def _rel_target(self, rels_path, type_suffix):
        for e in ET.parse(os.path.join(self.base, rels_path)).getroot():
            if e.get("Type", "").endswith(type_suffix):
                return os.path.basename(e.get("Target"))
        return None

    def slide(self, i):
        return self.load(f"ppt/slides/slide{i}.xml")

    def slide_rels(self, i):
        return {e.get("Id"): e.get("Target")
                for e in ET.parse(
                    f"{self.base}/ppt/slides/_rels/slide{i}.xml.rels").getroot()}

    def _theme_of(self, master):
        tf = self._rel_target(f"ppt/slideMasters/_rels/{master}.rels", "/theme")
        root = self.load(f"ppt/theme/{tf}")
        fs = root.find(f".//{A}fontScheme")
        clr = {}
        for ch in root.find(f".//{A}clrScheme"):
            name = ch.tag[len(A):]
            v = ch.find(f"{A}srgbClr")
            clr[name] = (v.get("val") if v is not None
                         else ch.find(f"{A}sysClr").get("lastClr", "")).upper()
        return dict(file=tf, clr=clr,
                    major=fs.find(f"{A}majorFont/{A}latin").get("typeface"),
                    minor=fs.find(f"{A}minorFont/{A}latin").get("typeface"))

    # ── geometry ──
    def picture_rects(self, i):
        """Every <p:pic> backed by a raster, as a fraction of the slide box."""
        rels = self.slide_rels(i)
        out = []
        for pic in self.slide(i).iter(f"{P}pic"):
            blip = pic.find(f".//{A}blip")
            if blip is None:
                continue
            target = rels.get(blip.get(f"{R}embed"), "")
            if not target.lower().endswith(
                    (".jpg", ".jpeg", ".png", ".jfif", ".bmp", ".tif", ".tiff")):
                continue
            xfrm = pic.find(f".//{A}xfrm")
            off = xfrm.find(f"{A}off") if xfrm is not None else None
            ext = xfrm.find(f"{A}ext") if xfrm is not None else None
            if off is None or ext is None:
                continue
            out.append(dict(x=int(off.get("x")) / EMU_W, y=int(off.get("y")) / EMU_H,
                            w=int(ext.get("cx")) / EMU_W, h=int(ext.get("cy")) / EMU_H))
        return out

    def photo_rects(self, i):
        return [r for r in self.picture_rects(i) if r["w"] >= PHOTO_MIN_W]

    def photo_boxes_px(self, i, w=RENDER_W, h=RENDER_H):
        """The redaction rectangles in pixels, half-open, at render resolution.

        The renderer and `slides.json` MUST get this from the same call. Deriving
        it twice -- once from the float, once from the float rounded for the JSON
        -- puts the two a pixel apart at the boundary, and the checker then reads
        that gap as a leak in the corpus instead of a bug in itself.
        """
        return [(int(r["x"] * w), int(r["y"] * h),
                 int((r["x"] + r["w"]) * w), int((r["y"] + r["h"]) * h))
                for r in self.photo_rects(i)]

    def text(self, i):
        return " ".join(e.text or "" for e in self.slide(i).iter(f"{A}t"))

    # ── the typeface inheritance chain, resolved run by run ──
    @staticmethod
    def _ph_key(sp):
        ph = sp.find(f"{P}nvSpPr/{P}nvPr/{P}ph")
        return None if ph is None else (ph.get("type", "body"), ph.get("idx"))

    @staticmethod
    def _lvl_defrpr(sp, lvl):
        ls = sp.find(f"{P}txBody/{A}lstStyle")
        return None if ls is None else ls.find(f"{A}lvl{lvl + 1}pPr/{A}defRPr")

    @classmethod
    def _find_ph(cls, root, key):
        ty, idx = key
        cands = [(cls._ph_key(sp), sp) for sp in root.iter(f"{P}sp")]
        cands = [(k, sp) for k, sp in cands if k]
        for k, sp in cands:
            if idx is not None and k[1] == idx:
                return sp
        for k, sp in cands:
            if k[0] == ty or (ty in TITLE_PH and k[0] in TITLE_PH) \
                    or (ty in BODY_PH and k[0] in BODY_PH):
                return sp
        return None

    def _master_style(self, mroot, ty, lvl):
        tag = ("titleStyle" if ty in TITLE_PH
               else "bodyStyle" if ty in BODY_PH else "otherStyle")
        ts = mroot.find(f"{P}txStyles/{P}{tag}")
        return None if ts is None else ts.find(f"{A}lvl{lvl + 1}pPr/{A}defRPr")

    def _props(self, e, master):
        if e is None:
            return {}
        d = {}
        if e.get("sz"):
            d["sz"] = int(e.get("sz"))
        if e.get("b") is not None:
            d["b"] = e.get("b") == "1"
        lat = e.find(f"{A}latin")
        if lat is not None and lat.get("typeface"):
            d["tf"] = lat.get("typeface")
        sf = e.find(f"{A}solidFill")
        if sf is not None:
            c = sf.find(f"{A}srgbClr")
            if c is not None:
                d["col"] = (c.get("val") or "").upper()
            else:
                sc = sf.find(f"{A}schemeClr")
                if sc is not None:
                    v = sc.get("val")
                    alias = {"tx1": "dk1", "tx2": "dk2", "bg1": "lt1", "bg2": "lt2"}
                    d["col"] = self.theme[master]["clr"].get(alias.get(v, v), "?" + str(v))
                    d["colref"] = v
        return d

    def runs(self):
        """One record per run that carries text -- and never the text itself."""
        out = []
        pres = self.load("ppt/presentation.xml")
        dts = pres.find(f"{P}defaultTextStyle")
        for i in range(1, self.count() + 1):
            lay = self.sl2lay[i]
            mas = self.lay2mas.get(lay)
            if not mas:
                continue
            lroot = self.load(f"ppt/slideLayouts/{lay}")
            mroot = self.load(f"ppt/slideMasters/{mas}")
            th = self.theme[mas]
            for sp in self.slide(i).iter(f"{P}sp"):
                tb = sp.find(f"{P}txBody")
                if tb is None:
                    continue
                key = self._ph_key(sp)
                lsp = self._find_ph(lroot, key) if key else None
                msp = self._find_ph(mroot, key) if key else None
                for para in tb.findall(f"{A}p"):
                    ppr = para.find(f"{A}pPr")
                    lvl = int(ppr.get("lvl", "0")) if ppr is not None and ppr.get("lvl") else 0
                    chain = [self._props(
                        dts.find(f"{A}lvl{lvl + 1}pPr/{A}defRPr") if dts is not None else None, mas)]
                    if key:
                        chain.append(self._props(self._master_style(mroot, key[0], lvl), mas))
                    if msp is not None:
                        chain.append(self._props(self._lvl_defrpr(msp, lvl), mas))
                    if lsp is not None:
                        chain.append(self._props(self._lvl_defrpr(lsp, lvl), mas))
                    chain.append(self._props(self._lvl_defrpr(sp, lvl), mas))
                    if ppr is not None:
                        chain.append(self._props(ppr.find(f"{A}defRPr"), mas))
                    for r in para.findall(f"{A}r"):
                        txt = "".join(x.text or "" for x in r.iter(f"{A}t"))
                        if not txt.strip():
                            continue
                        eff = {}
                        for c in chain:
                            eff.update(c)
                        eff.update(self._props(r.find(f"{A}rPr"), mas))
                        tf = eff.get("tf")
                        tf = th["major"] if tf == "+mj-lt" else th["minor"] if tf == "+mn-lt" else tf
                        out.append(dict(slide=i, layout=lay, ph=key[0] if key else None,
                                        lvl=lvl, sz=eff.get("sz"), b=eff.get("b", False),
                                        tf=tf, col=eff.get("col"), colref=eff.get("colref"),
                                        nchar=len(txt)))
        return out


# ── the boundary of the material ──────────────────────────────────────────────

SLIDESGO = re.compile(
    r"Mercury|Venus|Saturn|Jupiter|Neptune|Mars\b|slidesgo|freepik|flaticon|lorem", re.I)


def boundary(deck):
    """Re-derive the 1-49 / 50-84 / 85-108 split instead of trusting it."""
    marked = {i: bool(SLIDESGO.search(deck.text(i))) for i in range(1, deck.count() + 1)}
    bands = {}
    for name, lo, hi in (("autorais", 1, 49), ("slidesgo-escuro", 50, 84),
                         ("slidesgo-meta", 85, 108)):
        rng = range(lo, hi + 1)
        bands[name] = dict(de=lo, ate=hi, com_marca=sum(1 for i in rng if marked[i]),
                           de_um_total_de=len(rng))
    widths = sorted(r["w"] for i in AUTHORIAL for r in deck.picture_rects(i))
    below = [w for w in widths if w < PHOTO_MIN_W]
    above = [w for w in widths if w >= PHOTO_MIN_W]
    return dict(faixas=bands,
                primeiro_slide_com_marca_slidesgo=next((i for i in marked if marked[i]), None),
                vao_foto_icone=dict(limiar=PHOTO_MIN_W,
                                    icone_mais_largo=round(max(below), 4) if below else None,
                                    foto_mais_estreita=round(min(above), 4) if above else None))


# ── tokens, every one of them derived ─────────────────────────────────────────

def hex_by_breadth(deck):
    breadth = defaultdict(set)
    for i in AUTHORIAL:
        for el in deck.slide(i).iter(f"{A}srgbClr"):
            v = (el.get("val") or "").upper()
            if v:
                breadth[v].add(i)
    return sorted(breadth.items(), key=lambda kv: -len(kv[1]))


def stroke_and_shadow(deck):
    widths, shadows = Counter(), Counter()
    for i in AUTHORIAL:
        root = deck.slide(i)
        for ln in root.iter(f"{A}ln"):
            if ln.get("w"):
                widths[int(ln.get("w"))] += 1
        for sh in root.iter(f"{A}outerShdw"):
            alpha = sh.find(f".//{A}alpha")
            shadows[(sh.get("blurRad"), sh.get("dist"), sh.get("dir"),
                     alpha.get("val") if alpha is not None else None)] += 1
    return (
        {f"{int(w) / EMU_PT:g}pt": dict(emu=int(w), formas=n) for w, n in widths.most_common(6)},
        [dict(blur_pt=round(int(k[0]) / EMU_PT, 2) if k[0] else None,
              dist_pt=round(int(k[1]) / EMU_PT, 2) if k[1] else None,
              dir_deg=round(int(k[2]) / 60000, 1) if k[2] else None,
              alpha_pct=round(int(k[3]) / 1000, 1) if k[3] else None,
              formas=n) for k, n in shadows.most_common(4)],
    )


def top_level_shapes(deck, i):
    """Direct children of the shape tree, and nothing below them.

    A shape nested inside a <p:grpSp> carries coordinates in the GROUP's child
    space, not the slide's -- reading those as slide fractions is what turns the
    real 7,874% margin into a histogram of noise.
    """
    tree = deck.slide(i).find(f"{P}cSld/{P}spTree")
    return [] if tree is None else [
        c for c in tree if c.tag in (f"{P}sp", f"{P}pic", f"{P}graphicFrame",
                                     f"{P}grpSp", f"{P}cxnSp")]


def shape_rect(sp):
    """The shape's own <a:xfrm>, nearest first.

    `find()` returns an Element, and an Element with no children is FALSY -- so
    `a or b` here silently picks the wrong one. Every test is `is not None`.
    """
    for q in (f"{P}spPr/{A}xfrm", f"{P}grpSpPr/{A}xfrm", f"{P}xfrm", f".//{A}xfrm"):
        xfrm = sp.find(q)
        if xfrm is None:
            continue
        off, ext = xfrm.find(f"{A}off"), xfrm.find(f"{A}ext")
        if off is not None and ext is not None:
            return (int(off.get("x")), int(off.get("y")),
                    int(ext.get("cx")), int(ext.get("cy")))
    return None


def grid(deck):
    """The margins the deck actually snaps to, over top-level shapes only."""
    starts, ends = Counter(), Counter()
    for i in AUTHORIAL:
        for sp in top_level_shapes(deck, i):
            r = shape_rect(sp)
            if not r:
                continue
            x, cx = r[0], r[2]
            starts[round(x / EMU_W * 100, 3)] += 1
            ends[round((x + cx) / EMU_W * 100, 3)] += 1
    return dict(borda_esquerda=[dict(pct=p, formas=n) for p, n in starts.most_common(5)],
                borda_direita=[dict(pct=p, formas=n) for p, n in ends.most_common(5)])


def build_tokens(deck, runs):
    by_tf, by_size = Counter(), Counter()
    for r in runs:
        if r["slide"] in AUTHORIAL and r.get("nchar"):
            by_tf[r.get("tf") or "(herdado/nenhum)"] += r["nchar"]
            if r.get("sz"):
                by_size[r["sz"]] += r["nchar"]
    total = sum(by_tf.values()) or 1
    strokes, shadows = stroke_and_shadow(deck)
    return {
        "_": "Derivado do OOXML por tools/build_reference.py. Não editar à mão — "
             "rode o script de novo.",
        "caixa_do_slide": dict(emu_w=EMU_W, emu_h=EMU_H, pt_w=720.0, pt_h=PT_H, proporcao="16:9",
                               nota="metade linear do 16:9 padrão do PowerPoint (960x540 pt); "
                                    "todo valor em pt deste deck pede ×1,333 para equivaler"),
        "hex_por_alcance": [dict(hex="#" + h, slides=len(s)) for h, s in hex_by_breadth(deck)[:20]],
        "fontes": {tf: dict(chars=n, pct=round(100 * n / total, 1)) for tf, n in by_tf.most_common()},
        "escala": {f"{sz / 100:g}pt": dict(pt=sz / 100,
                                           pct_da_altura=round(sz / 100 / PT_H * 100, 2), chars=n)
                   for sz, n in sorted(by_size.items(), key=lambda kv: -kv[0])},
        "grade": grid(deck),
        "traco": strokes,
        "sombra": shadows,
    }


# Premise 5 of the map fixes these four as the surface, and only these. Naming
# them is not this script's judgement -- it is the premise's, and the run FAILS
# if the census does not carry one, because then the premise no longer describes
# the deck. Every other hex ships unnamed on purpose: the accent SYSTEM is the
# one thing about this identity that is still open (#100 measured the five, found
# four of five fail contrast or separation, and recommended replacing them -- and
# that recommendation is waiting on the owner's eye). A semantic name here would
# quietly settle a decision this corpus has no standing to settle.
SURFACE = {"141415": "surface", "F3F3F3": "ink", "2C2C2F": "card", "FFFFFF": "ink-pure"}


def tokens_css(tokens):
    """The subset a stylesheet can consume, as custom properties."""
    census = {e["hex"].lstrip("#").upper(): e["slides"] for e in tokens["hex_por_alcance"]}
    missing = [h for h in SURFACE if h not in census]
    if missing:
        raise SystemExit(
            f"a premissa 5 fixa {missing} como superfície e o deck não os carrega mais — "
            "a premissa parou de descrever o material, e isso é um ticket, não um token")
    out = ["/* Derivado por tools/build_reference.py. Não editar à mão. */", ":root {",
           "  /* superfície — os quatro papéis que a premissa 5 do mapa fixa */"]
    for hexv, role in SURFACE.items():
        out.append(f"  --pdi-{role}: #{hexv}; /* {census[hexv]} slides autorais */")
    out += ["",
            "  /* acento — SEM nome semântico de propósito: o sistema de acento é a decisão",
            "     que #100 reabriu e que espera o olhar do dono. Ver README. */"]
    for e in tokens["hex_por_alcance"]:
        h = e["hex"].lstrip("#").upper()
        if h in SURFACE or h in ("000000",):
            continue
        out.append(f"  --pdi-hex-{h.lower()}: {e['hex']}; /* {e['slides']} slides */")
        if len(out) > 40:
            break
    out += ["",
            "  /* escala tipográfica — a régua invariante é % da ALTURA DO SLIDE, que num",
            "     16:9 com letterbox não é a altura do viewport. Redefina --pdi-slide-h",
            "     para a altura real da caixa do slide e toda a escala acompanha. */",
            "  --pdi-slide-h: 100svh;"]
    for pt, e in list(tokens["escala"].items())[:12]:
        out.append(f"  --pdi-size-{pt.replace('.', '_')}: "
                   f"calc({e['pct_da_altura']} * var(--pdi-slide-h) / 100);"
                   f" /* {e['pt']}pt, {e['chars']} chars */")
    out += ["", "  /* grade — as bordas em que as formas encostam */"]
    for e in tokens["grade"]["borda_esquerda"][:3]:
        out.append(f"  --pdi-edge-{str(e['pct']).replace('.', '_')}: {e['pct']}%;"
                   f" /* {e['formas']} formas */")
    if tokens["traco"]:
        out += ["", f"  --pdi-stroke: {next(iter(tokens['traco']))};"]
    if tokens["sombra"]:
        s = tokens["sombra"][0]
        out.append(f"  --pdi-shadow: 0 {s['dist_pt']}pt {s['blur_pt']}pt "
                   f"rgba(0,0,0,{(s['alpha_pct'] or 0) / 100:.2f});")
    return "\n".join(out + ["}"]) + "\n"


# ── the skeleton of every authorial slide, carrying no text ───────────────────

def skeleton(deck, i):
    """Top-level boxes only -- see `top_level_shapes` for why nesting is dropped."""
    boxes = []
    for sp in top_level_shapes(deck, i):
        r = shape_rect(sp)
        if not r:
            continue
        ph = sp.find(f".//{P}ph")
        geom = sp.find(f".//{A}prstGeom")
        boxes.append(dict(
            tipo=sp.tag[len(P):],
            papel=ph.get("type") if ph is not None else None,
            geometria=geom.get("prst") if geom is not None else None,
            x=round(r[0] / EMU_W, 5), y=round(r[1] / EMU_H, 5),
            w=round(r[2] / EMU_W, 5), h=round(r[3] / EMU_H, 5),
            pt=sorted({int(e.get("sz")) / 100 for e in sp.iter(f"{A}rPr") if e.get("sz")},
                      reverse=True),
            nchar=sum(len(e.text or "") for e in sp.iter(f"{A}t")),
        ))
    return dict(slide=i, layout=deck.sl2lay[i], caixas=boxes,
                fotos=[{k: round(v, 5) for k, v in r.items()} for r in deck.photo_rects(i)],
                fotos_px=[list(b) for b in deck.photo_boxes_px(i)],
                no_corpus=i not in WITHHELD, retido_porque=WITHHELD.get(i))


# ── the redacted renders ──────────────────────────────────────────────────────

def render(deck, png_dir, out_dir):
    from PIL import Image, ImageDraw
    written = []
    for i in AUTHORIAL:
        if i in WITHHELD:
            continue
        src = os.path.join(png_dir, f"Slide{i}.PNG")
        if not os.path.exists(src):
            print(f"  ! falta {src}", file=sys.stderr)
            continue
        im = Image.open(src).convert("RGB")
        W, H = im.size
        for x0, y0, x1, y1 in deck.photo_boxes_px(i, W, H):
            bw, bh = max(x1 - x0, 1), max(y1 - y0, 1)
            # EVERY mark is made on the tile, never on the slide, and the tile is
            # then pasted whole. Drawn straight onto the slide, two of these marks
            # escape the block: a hatch line started at a negative offset begins
            # left of x0, and `rectangle(width=2)` overpaints one row PAST y1 --
            # which is how a white strip of the deck's own design under the photo
            # frame on slides 13 and 32 got painted over the first time.
            tile = Image.new("RGB", (bw, bh), (58, 58, 62))
            td = ImageDraw.Draw(tile)
            for k in range(-bh, bw, 22):
                td.line([(k, 0), (k + bh, bh)], fill=(74, 74, 79), width=1)
            td.rectangle([0, 0, bw - 1, bh - 1], outline=(120, 120, 126), width=2)
            td.text((10, 8), "FOTO REDIGIDA", fill=(176, 176, 182))
            im.paste(tile, (x0, y0))
        dst = os.path.join(out_dir, "slides", f"slide-{i:02d}.webp")
        im.save(dst, "WEBP", lossless=True, method=6)
        written.append((i, os.path.getsize(dst)))
    return written


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) != 4:
        print("uso: build_reference.py <ooxml-extraido> <png-exportados> <out-dir>",
              file=sys.stderr)
        return 2
    base, png_dir, out_dir = (os.path.abspath(p) for p in sys.argv[1:4])
    os.makedirs(os.path.join(out_dir, "slides"), exist_ok=True)

    deck = Deck(base)
    b = boundary(deck)
    print("fronteira:", json.dumps(b["faixas"], ensure_ascii=False))
    print("  primeira marca Slidesgo no slide:", b["primeiro_slide_com_marca_slidesgo"])
    print("  vão foto/ícone:", json.dumps(b["vao_foto_icone"], ensure_ascii=False))

    runs = deck.runs()
    print(f"  {len(runs)} runs com texto resolvidos "
          f"({sum(1 for r in runs if not r['tf'])} sem fonte resolvida)")

    tokens = build_tokens(deck, runs)
    tokens["fronteira"] = b
    write(os.path.join(out_dir, "tokens.json"), tokens)
    open(os.path.join(out_dir, "tokens.css"), "w").write(tokens_css(tokens))

    write(os.path.join(out_dir, "slides.json"),
          dict(_="Esqueleto dos 49 slides autorais. Nenhuma letra de texto — só caixa, "
                 "papel, geometria, corpo em pt e contagem de caracteres.",
               caixa_do_slide=tokens["caixa_do_slide"],
               slides=[skeleton(deck, i) for i in AUTHORIAL]))

    write(os.path.join(out_dir, "runs.json"),
          dict(_="Um registro por run com texto, com a cadeia de herança de fonte já "
                 "resolvida (run → pPr → lstStyle → placeholder do layout → master → "
                 "txStyles → fontScheme). Sem o texto: só o que ele mede.",
               runs=runs))

    written = render(deck, png_dir, out_dir)
    total = sum(n for _, n in written)
    print(f"\n{len(written)} slides redigidos, {total / 1e6:.2f} MB")
    print(f"{len(WITHHELD)} retidos: {sorted(WITHHELD)}")
    return 0


def write(path, obj):
    json.dump(obj, open(path, "w"), ensure_ascii=False, indent=1)
    print(f"  {os.path.basename(path)}: {os.path.getsize(path) / 1024:.0f} KB")


if __name__ == "__main__":
    sys.exit(main())
