# Write the hand out as a font. python build.py [outdir]
# Sweeps the nib along every glyph, lets the ink settle, fits curves, spaces the results,
# and saves OTF + WOFF2 + the skeleton the page writes with.
import json, os, sys
from shapely.geometry import box, Polygon, MultiPolygon
from shapely.geometry.polygon import orient
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

import nib as N
from fit import fit_ring
from glyphs import GLYPHS, KERN, STYLE, COMPOSITES

SPACE = {'lc': {'S': 56, 'R': 30, 'D': 8}, 'uc': {'S': 68, 'R': 40, 'D': 10}}


def polys(geom):
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [p for p in getattr(geom, 'geoms', []) if isinstance(p, Polygon)]


def soften(geom, spread=6, wear=3):
    """Ink spreads into sharp inside corners and wears off sharp outside ones."""
    g = geom.buffer(spread, quad_segs=8).buffer(-spread, quad_segs=8)
    return g.buffer(-wear, quad_segs=8).buffer(wear, quad_segs=8)


def outline(geom):
    """Cubic segments for every ring, counterclockwise outside (PostScript)."""
    rings = []
    for p in polys(geom):
        p = orient(p.simplify(0.05, preserve_topology=True), sign=1.0)
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)[:-1]
            if len(pts) > 3:
                rings.append(fit_ring(pts))
    return rings


def spaced(gd, geom):
    """Where the glyph sits and how wide it is. Letters in `sides` measure from the middle band, numbers from the box."""
    frame = gd['frame']
    top = N.XH if frame == 'lc' else N.CAP
    bx0, _, bx1, _ = geom.bounds
    y0, y1 = gd.get('band', (top * 0.25, top * 0.75))
    band = geom.intersection(box(bx0 - 1, y0, bx1 + 1, y1))
    cx0, _, cx1, _ = band.bounds if not band.is_empty else geom.bounds
    sl, sr = gd['sides']
    if not isinstance(sl, str): cx0 = bx0
    if not isinstance(sr, str): cx1 = bx1
    sp = SPACE[frame]
    val = lambda s: sp[s[0]] + int(s[1:] or 0) if isinstance(s, str) else s     # 'S', 'R', or 'S+16'
    left, right = val(sl), val(sr)
    dx = round(left - cx0)
    return dx, gd.get('adv') or round(cx1 + dx + right)


def charstring(rings, dx, adv):
    pen = T2CharStringPen(adv, None)
    for segs in rings:
        r = lambda p: (round(p[0] + dx), round(p[1]))
        pen.moveTo(r(segs[0][0]))
        for s in segs:
            pen.curveTo(r(s[1]), r(s[2]), r(s[3]))
        pen.closePath()
    return pen.getCharString()


def build(nib, outdir, style='Regular'):
    order, cmap, cs, hmtx, skel, shapes = ['.notdef', 'space'], {32: 'space', 160: 'space'}, {}, {}, {}, {}
    comps = {}
    pen = T2CharStringPen(400, None)
    for pts in (((50, 0), (350, 0), (350, 660), (50, 660)), ((100, 50), (100, 610), (300, 610), (300, 50))):
        pen.moveTo(pts[0]); [pen.lineTo(p) for p in pts[1:]]; pen.closePath()
    cs['.notdef'], hmtx['.notdef'] = pen.getCharString(), (400, 50)
    cs['space'], hmtx['space'] = T2CharStringPen(STYLE['space'], None).getCharString(), (STYLE['space'], 0)
    for name, gd in GLYPHS.items():
        geom = soften(N.ink(gd['strokes'], nib, gd['frame']))
        dx, adv = spaced(gd, geom)
        rings = outline(geom)
        top = N.XH if gd['frame'] == 'lc' else N.CAP
        band = geom.intersection(box(-2000, top * 0.1, 3000, top * 0.9))
        bx = band.bounds if not band.is_empty else geom.bounds
        shapes[name] = (rings, dx, adv, (bx[0] + bx[2]) / 2, gd['frame'], geom.bounds)
        cs[name] = charstring(rings, dx, adv)
        hmtx[name] = (adv, round(geom.bounds[0] + dx))
        order.append(name)
        for ch in gd['char']:
            cmap[ord(ch)] = name
        skel[name] = dict(c=gd['char'], f=gd['frame'], dx=dx, adv=adv, s=[
            dict(d=d, **o) for d, o in ((st, {}) if isinstance(st, str) else st for st in gd['strokes'])])
    # accented letters: a base glyph and a mark glyph, drawn together
    for name, (char, base, mark) in COMPOSITES.items():
        if base not in shapes or mark not in shapes:
            continue
        brings, bdx, badv, bcx, bframe, bb = shapes[base]
        mrings, _, _, mcx, _, mb = shapes[mark]
        mdx = round(bcx + bdx - mcx)
        mdy = 0 if mark == 'cedillacomb' or bframe == 'lc' else N.CAP - N.XH
        if mark == 'caronvert':      # beside the ascender, not over the bowl
            right = bb[2] + bdx if base == 'd' else bdx + 70 + 46
            mdx = round(right + 4 - mb[0]) if base == 'd' else round(right + 14 - mb[0])
            badv = max(badv, round(mb[2] + mdx + 20))
        comps[name] = [char, base, mark, mdx, mdy, badv]
        pen = T2CharStringPen(badv, None)
        for rings, sx, sy in ((brings, bdx, 0), (mrings, mdx, mdy)):
            for segs in rings:
                r = lambda p: (round(p[0] + sx), round(p[1] + sy))
                pen.moveTo(r(segs[0][0]))
                for s in segs:
                    pen.curveTo(r(s[1]), r(s[2]), r(s[3]))
                pen.closePath()
        cs[name], hmtx[name] = pen.getCharString(), (badv, hmtx[base][1])
        order.append(name)
        cmap[ord(char)] = name

    family = STYLE['family']
    ps = f'{family}-{style}'
    fb = FontBuilder(1000, isTTF=False)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupCFF(ps, {'FullName': f'{family} {style}', 'FamilyName': family, 'Weight': style}, cs, {})
    fb.setupHorizontalMetrics(hmtx)
    fb.setupHorizontalHeader(ascent=900, descent=-260)
    fb.setupNameTable({'familyName': family, 'styleName': style, 'uniqueFontIdentifier': ps,
                       'fullName': f'{family} {style}', 'psName': ps, 'version': 'Version 1.000',
                       'designer': 'Claude', 'description': STYLE['description']})
    fb.setupOS2(sTypoAscender=760, sTypoDescender=-240, sTypoLineGap=200, usWinAscent=900, usWinDescent=260,
                sxHeight=N.XH, sCapHeight=N.CAP, achVendID='NONE', fsType=0,
                usWeightClass=400 if style == 'Regular' else 700, fsSelection=0x40 if style == 'Regular' else 0x20)
    fb.setupPost()
    if KERN:
        fb.addOpenTypeFeatures(kern_fea(set(order)))
    os.makedirs(outdir, exist_ok=True)
    otf = os.path.join(outdir, f'{ps}.otf')
    fb.save(otf)
    f = TTFont(otf)
    f.flavor = 'woff2'
    f.save(otf[:-4] + '.woff2')
    kids = {}
    for name, (_, base, _) in COMPOSITES.items():
        kids.setdefault(base, []).append(name)
    grow = lambda names: [n for b in names.split() for n in [b] + kids.get(b, []) if n in order]
    data = dict(nib=STYLE['nib'], space=STYLE['space'], xh=N.XH, cap=N.CAP, chars=len(cmap), glyphs=skel, comps=comps,
                kern=[[grow(a), grow(b), v] for a, b, v in KERN])
    return otf, data


def kern_fea(have):
    kids = {}
    for name, (_, base, _) in COMPOSITES.items():
        kids.setdefault(base, []).append(name)
    grow = lambda names: [n for b in names.split() for n in [b] + kids.get(b, []) if n in have]
    lines, rules = [], []
    for i, (a, b, v) in enumerate(KERN):
        lines.append(f"@k{i}L = [{' '.join(grow(a))}];")
        lines.append(f"@k{i}R = [{' '.join(grow(b))}];")
        rules.append(f'  pos @k{i}L @k{i}R {v};')
    return '\n'.join(lines + ['feature kern {'] + rules + ['} kern;'])


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..')
    otf, data = build(N.Nib(**STYLE['nib']), out)
    print(otf, len(data['glyphs']) + len(data['comps']), 'glyphs', os.path.getsize(otf), 'bytes')
    with open(os.path.join(out, 'skeleton.json'), 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
