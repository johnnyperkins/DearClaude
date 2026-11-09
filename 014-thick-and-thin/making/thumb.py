# The index card: "thick and thin" on a ruled sheet, the last stroke half written, the nib where it stopped.
# python thumb.py  (after build.py; reads ../skeleton.json, writes ../thumb.jpg)
import json, math, os
from PIL import Image, ImageDraw
import nib as N
from build import soften, polys

here = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(here, '..', 'skeleton.json')))
pen = N.Nib(**D['nib'])
W, H, SS = 1280, 720, 3                      # drawn three times larger, then shrunk, for clean edges
PAPER, INK, RULE, RULE2, RED = (244, 239, 228), (32, 27, 21), (196, 211, 226), (223, 230, 238), (178, 57, 31)
text, s = 'thick and thin', 0.205
names = [None if c == ' ' else next(n for n, g in D['glyphs'].items() if c in g['c']) for c in text]
width = sum(D['space'] if n is None else D['glyphs'][n]['adv'] for n in names)
x0, base = (W - width * s) / 2, 430
im = Image.new('RGB', (W * SS, H * SS), PAPER)
d = ImageDraw.Draw(im)
for y, c in ((0, RULE), (N.XH, RULE), (730, RULE2), (-230, RULE2)):
    yy = (base - y * s) * SS
    d.line([(0, yy), (W * SS, yy)], fill=c, width=SS)
to_px = lambda x, y, ox: ((x0 + (ox + x) * s) * SS, (base - y * s) * SS)


def fill(geom, ox):
    for p in polys(geom):
        d.polygon([to_px(x, y, ox) for x, y in p.exterior.coords], fill=INK)
        for r in p.interiors:
            d.polygon([to_px(x, y, ox) for x, y in r.coords], fill=PAPER)


x = 0
for i, n in enumerate(names):
    if n is None:
        x += D['space']; continue
    g = D['glyphs'][n]
    strokes = [(st['d'], {k: v for k, v in st.items() if k != 'd'}) for st in g['s']]
    last = i == len(names) - 1
    if last:                                  # the final arch of the n, stopped partway down its last stem
        d0, opt = strokes[-1]
        segs, a0, a1 = N.centre_segments((d0, opt), pen, g['f'])
        pts = N.sample(segs)
        k = int(len(pts) * 0.8)
        part = ' '.join(['M', *map(str, pts[0])] + [f'L {px:.1f} {py:.1f}' for px, py in pts[1:k]])
        fill(soften(N.ink(strokes[:-1], pen, g['f'])), x + g['dx'])
        # the partial stroke is already in centre space, so sweep it without the zone mapping
        from shapely.geometry import MultiPoint
        from shapely.ops import unary_union
        sh = [[(px + qx, py + qy) for qx, qy in pen.shape(a0)] for px, py in pts[:k]]
        fill(soften(unary_union([MultiPoint(a + b).convex_hull for a, b in zip(sh, sh[1:])])), x + g['dx'])
        tip = pts[k - 1]
        outline = [to_px(px + tip[0], py + tip[1], x + g['dx']) for px, py in pen.shape(a0)]
        d.polygon(outline, fill=RED)
    else:
        fill(soften(N.ink(strokes, pen, g['f'])), x + g['dx'])
    x += g['adv']
im = im.resize((W, H), Image.LANCZOS)
out = os.path.join(here, '..', 'thumb.jpg')
im.save(out, quality=86)
print(out)
