"""Fold the paper strip by hand, in simulation, and check it becomes the START state of sim.py.

A flat-folded strip: each triangle has vertex positions in the plane, a side up, and a place in
one global top-to-bottom order. A fold reflects one end of the strip across a hinge and puts it
on top of or under the rest, reversing its stacking.
"""
import math, sim

TRIS = list(range(1, 20))   # 19 is the glue tab

def fresh():
    pos = {k: {v: sim.strip_xy(v) for v in sim.strip_tri(k)} for k in TRIS}
    return {'pos': pos, 'up': {k: 1 for k in TRIS}, 'z': list(TRIS)}   # z: top first

def hinge_pts(st, k):
    a, b = set(sim.strip_tri(k)), set(sim.strip_tri(k + 1))
    sh = sorted(a & b)
    return [st['pos'][k][v] for v in sh]

def fold(st, k, moving='after', place='under'):
    """Fold at hinge k|k+1. moving='after' moves k+1..19, 'before' moves 1..k."""
    a, b = hinge_pts(st, k)
    mv = set(range(k + 1, 20)) if moving == 'after' else set(range(1, k + 1))
    for t in mv:
        st['pos'][t] = {v: sim.reflect(p, a, b) for v, p in st['pos'][t].items()}
        st['up'][t] *= -1
    stay = [t for t in st['z'] if t not in mv]
    moved = [t for t in st['z'] if t in mv][::-1]
    st['z'] = stay + moved if place == 'under' else moved + stay
    return st

def cells(st):
    """Group triangles by the region they cover. Returns {frozenset of rounded vertex positions: [tris top first]}"""
    out = {}
    for t in st['z']:
        key = frozenset((round(x, 6), round(y, 6)) for x, y in st['pos'][t].values())
        out.setdefault(key, []).append(t)
    return out

def centroid(key):
    xs, ys = zip(*key)
    return sum(xs) / 3, sum(ys) / 3

def matches_start(st):
    """Does this folded state equal sim.START (up to rotation and mirroring of the hexagon)?"""
    cs = cells(st)
    if len(cs) != 6:
        return False, f'{len(cs)} cells'
    # the hexagon centre is the vertex shared by all six cells
    common = set.intersection(*[set(k) for k in cs])
    if len(common) != 1:
        return False, 'no common centre'
    c = common.pop()
    order = sorted(cs, key=lambda k: math.atan2(centroid(k)[1] - c[1], centroid(k)[0] - c[0]))
    pats = []
    for key in order:
        ts = [t for t in cs[key] if t != 19]
        pats.append([t * st['up'][t] for t in ts])
    want = [[x for x in sim.leaves(p)] for p in sim.START]
    # sim.py's hexagon frame is the mirror image of the page, so its counterclockwise is our clockwise
    ps = pats[::-1]
    for r in range(6):
        if ps[r:] + ps[:r] == want:
            return True, r
    return False, pats
