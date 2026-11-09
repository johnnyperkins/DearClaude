# The pen. A glyph is a list of strokes; a stroke is a centre path for a broad nib held at a fixed angle.
# Paths are written in "ink space": a y coordinate says where the ink's edge lands, not where the nib's centre goes.
# zone() turns that into centre coordinates for a given nib, so the same skeleton aligns at any weight.
import math, re
from shapely.geometry import MultiPoint
from shapely.ops import unary_union

XH, CAP, ASC, DSC = 470, 660, 730, -230   # x-height, cap height, ascender, descender (ink)


class Nib:
    def __init__(self, width=92, thick=14, angle=30, corner=5):
        self.w, self.t, self.angle, self.r = width, thick, angle, corner

    def half_y(self, angle=None):
        a = math.radians(self.angle if angle is None else angle)
        return self.w / 2 * abs(math.sin(a)) + self.t / 2 * abs(math.cos(a))

    def shape(self, angle):
        """The nib's footprint at an angle: a thin rectangle with slightly rounded corners."""
        a, b, r = self.w / 2, self.t / 2, min(self.r, self.t / 2 - 0.01)
        pts = []
        for cx, cy, a0 in ((a - r, b - r, 0), (-a + r, b - r, 90), (-a + r, -b + r, 180), (a - r, -b + r, 270)):
            for k in range(4):
                t = math.radians(a0 + 30 * k)
                pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
        c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        return [(x * c - y * s, x * s + y * c) for x, y in pts]


def zone(y, hy, frame):
    """Ink-space y to centre y. Only the main zone (x-height, or cap height) is squeezed."""
    top = XH if frame == 'lc' else CAP
    if y < 0:
        return y + hy
    if y > top:
        return y - hy
    return hy + y * (top - 2 * hy) / top


TOK = re.compile(r'[MLCQ]|-?\d+(?:\.\d+)?')


def parse(d):
    """'M x y L x y C x1 y1 x2 y2 x y Q x1 y1 x y ...' to a list of cubic segments. A second M starts afresh."""
    toks, i, segs, cur = TOK.findall(d), 0, [], None
    num = lambda k: [float(v) for v in toks[i + 1:i + 1 + k]]
    while i < len(toks):
        c = toks[i]
        if c == 'M':
            cur = tuple(num(2)); i += 3
        elif c == 'L':
            b = tuple(num(2)); i += 3
            segs.append((cur, lerp(cur, b, 1 / 3), lerp(cur, b, 2 / 3), b)); cur = b
        elif c == 'C':
            v = num(6); i += 7
            segs.append((cur, tuple(v[0:2]), tuple(v[2:4]), tuple(v[4:6]))); cur = tuple(v[4:6])
        elif c == 'Q':
            v = num(4); i += 5
            q, b = tuple(v[0:2]), tuple(v[2:4])
            segs.append((cur, lerp(cur, q, 2 / 3), lerp(b, q, 2 / 3), b)); cur = b
        else:
            raise ValueError(f'bad token {c!r} in {d!r}')
    return segs


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def bez(s, t):
    u = 1 - t
    return (u**3 * s[0][0] + 3 * u * u * t * s[1][0] + 3 * u * t * t * s[2][0] + t**3 * s[3][0],
            u**3 * s[0][1] + 3 * u * u * t * s[1][1] + 3 * u * t * t * s[2][1] + t**3 * s[3][1])


def centre_segments(stroke, nib, frame):
    """A stroke's segments mapped from ink space to centre space, with its pen angles."""
    d, opt = (stroke, {}) if isinstance(stroke, str) else stroke
    a0 = opt.get('angle', nib.angle)
    a1 = opt.get('to', a0)
    hy = nib.half_y((a0 + a1) / 2)
    segs = [tuple((x + opt.get('dx', 0), zone(y, hy, frame)) for x, y in s) for s in parse(d)]
    return segs, a0, a1


def sample(segs, step=3.0):
    pts = []
    for s in segs:
        L = sum(math.dist(s[k], s[k + 1]) for k in range(3))
        n = max(2, int(L / step) + 1)
        for k in range(0 if not pts else 1, n + 1):
            pts.append(bez(s, k / n))
    return pts


def ink(strokes, nib, frame):
    """Sweep the nib along every stroke and return the union as a shapely geometry."""
    hulls = []
    for st in strokes:
        segs, a0, a1 = centre_segments(st, nib, frame)
        pts = sample(segs)
        # pen twist is spread by arc length
        acc = [0.0]
        for p, q in zip(pts, pts[1:]):
            acc.append(acc[-1] + math.dist(p, q))
        tot = acc[-1] or 1
        shapes = [[(x + px, y + py) for x, y in nib.shape(a0 + (a1 - a0) * l / tot)] for (px, py), l in zip(pts, acc)]
        if len(shapes) == 1:
            hulls.append(MultiPoint(shapes[0]).convex_hull)
        for s0, s1 in zip(shapes, shapes[1:]):
            hulls.append(MultiPoint(s0 + s1).convex_hull)
    return unary_union(hulls)
