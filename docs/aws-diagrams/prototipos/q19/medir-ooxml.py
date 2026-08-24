import re, sys, os, glob, json
import xml.etree.ElementTree as ET

A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
EMU = 914400.0

def q(ns, t): return '{%s}%s' % (ns, t)

def get_xfrm(spPr_or_grpSpPr):
    if spPr_or_grpSpPr is None: return None
    x = spPr_or_grpSpPr.find(q(A,'xfrm'))
    if x is None: return None
    off = x.find(q(A,'off')); ext = x.find(q(A,'ext'))
    if off is None or ext is None: return None
    d = {'x': int(off.get('x')), 'y': int(off.get('y')),
         'cx': int(ext.get('cx')), 'cy': int(ext.get('cy')),
         'rot': int(x.get('rot') or 0)}
    cOff = x.find(q(A,'chOff')); cExt = x.find(q(A,'chExt'))
    if cOff is not None and cExt is not None:
        d['chx'] = int(cOff.get('x')); d['chy'] = int(cOff.get('y'))
        d['chcx'] = int(cExt.get('cx')); d['chcy'] = int(cExt.get('cy'))
    return d

def text_of(sp):
    tb = sp.find(q(P,'txBody'))
    if tb is None: return ''
    return ''.join(t.text or '' for t in tb.iter(q(A,'t'))).strip()

def name_of(sp):
    nv = sp.find(q(P,'nvSpPr'))
    if nv is None: nv = sp.find(q(P,'nvGrpSpPr'))
    if nv is None: nv = sp.find(q(P,'nvPicPr'))
    if nv is None: return ''
    c = nv.find(q(P,'cNvPr'))
    return (c.get('name') if c is not None else '') or ''

def line_props(sp):
    """extract stroke color + dash from spPr"""
    spPr = sp.find(q(P,'spPr'))
    if spPr is None: return (None, None)
    ln = spPr.find(q(A,'ln'))
    if ln is None: return (None, None)
    col = None
    sc = ln.find(q(A,'solidFill'))
    if sc is not None:
        srgb = sc.find(q(A,'srgbClr'))
        if srgb is not None: col = srgb.get('val')
    dash = None
    pd = ln.find(q(A,'prstDash'))
    if pd is not None: dash = pd.get('val')
    return (col, dash)

def walk(node, xform_stack, out, slide):
    """xform_stack: list of (scale_x, scale_y, tx, ty) mapping child coords -> slide coords"""
    for child in node:
        tag = child.tag
        if tag == q(P,'grpSp'):
            gp = child.find(q(P,'grpSpPr'))
            g = get_xfrm(gp)
            new_stack = list(xform_stack)
            if g and 'chx' in g and g.get('chcx') and g.get('chcy'):
                sx = g['cx']/g['chcx']; sy = g['cy']/g['chcy']
                tx = g['x'] - g['chx']*sx; ty = g['y'] - g['chy']*sy
                new_stack.append((sx, sy, tx, ty))
            walk(child, new_stack, out, slide)
        elif tag in (q(P,'sp'), q(P,'pic'), q(P,'graphicFrame'), q(P,'cxnSp')):
            spPr = child.find(q(P,'spPr'))
            if spPr is None: spPr = child.find(q(P,'xfrm'))
            xf = get_xfrm(spPr) if spPr is not None and spPr.tag==q(P,'spPr') else None
            if xf is None:
                # graphicFrame has xfrm directly
                gx = child.find(q(P,'xfrm'))
                if gx is not None:
                    off = gx.find(q(A,'off')); ext = gx.find(q(A,'ext'))
                    if off is not None and ext is not None:
                        xf = {'x':int(off.get('x')),'y':int(off.get('y')),
                              'cx':int(ext.get('cx')),'cy':int(ext.get('cy')),'rot':0}
            if xf is None: continue
            x,y,cx,cy = xf['x'], xf['y'], xf['cx'], xf['cy']
            for (sx,sy,tx,ty) in xform_stack:
                x = x*sx + tx; y = y*sy + ty; cx = cx*sx; cy = cy*sy
            col, dash = line_props(child) if tag==q(P,'sp') else (None,None)
            out.append({
                'slide': slide,
                'name': name_of(child),
                'text': text_of(child) if tag==q(P,'sp') else '',
                'x1': x/EMU, 'y1': y/EMU, 'x2': (x+cx)/EMU, 'y2': (y+cy)/EMU,
                'w': cx/EMU, 'h': cy/EMU,
                'stroke': col, 'dash': dash, 'rot': xf.get('rot',0),
            })
        elif tag == q(P,'grpSpPr') or tag == q(P,'nvGrpSpPr'):
            continue

def parse_slide(path):
    slide = int(re.search(r'slide(\d+)\.xml', path).group(1))
    tree = ET.parse(path)
    root = tree.getroot()
    spTree = root.find(q(P,'cSld')).find(q(P,'spTree'))
    out = []
    walk(spTree, [], out, slide)
    return out

if __name__ == '__main__':
    base = sys.argv[1]
    allshapes = []
    for p in sorted(glob.glob(os.path.join(base,'ppt/slides/slide*.xml')),
                    key=lambda s: int(re.search(r'slide(\d+)\.xml',s).group(1))):
        allshapes.extend(parse_slide(p))
    json.dump(allshapes, open(sys.argv[2],'w'))
    print('shapes:', len(allshapes), 'slides:', len(set(s['slide'] for s in allshapes)))
