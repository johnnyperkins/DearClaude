# Pull a few outlines out of Noto Music (SIL Open Font License) as SVG path data, in font units (y up).
# Run with a python that has fontTools: the sketchbook keeps one in a throwaway venv.
import json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
f = TTFont('/usr/share/fonts/truetype/noto/NotoMusic-Regular.ttf')
cmap, gs = f.getBestCmap(), f.getGlyphSet()
from fontTools.pens.boundsPen import BoundsPen
want = {'gclef': 0x1D11E, 'flat': 0x266D, 'rest4': 0x1D13D, 'rest8': 0x1D13E, 'rest16': 0x1D13F,
        'head': 0x1D158, 'void': 0x1D157, 'flag8': 0x1D16E, 'flag16': 0x1D16F, 'fermata': 0x1D110}
out = {'upm': f['head'].unitsPerEm}
for k, cp in want.items():
    name = cmap.get(cp)
    if not name: print('missing', k); continue
    p = SVGPathPen(gs); gs[name].draw(p)
    b = BoundsPen(gs); gs[name].draw(b)
    out[k] = {'d': p.getCommands(), 'bbox': b.bounds, 'adv': gs[name].width}
    print(k, name, b.bounds, gs[name].width, len(p.getCommands()))
json.dump(out, open('glyphs.json', 'w'))   # then minified into glyphs.min.json and pasted into the page
