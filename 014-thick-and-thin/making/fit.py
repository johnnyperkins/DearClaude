# Fit cubic Beziers to a dense closed outline (Philip Schneider, "An Algorithm for Automatically Fitting
# Digitized Curves", Graphics Gems, 1990). Corners split the ring; smooth runs are fitted to within `tol` units.
import math
import numpy as np


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def _bez(ctrl, t):
    t = np.asarray(t)[:, None]
    u = 1 - t
    return u**3 * ctrl[0] + 3 * u * u * t * ctrl[1] + 3 * u * t * t * ctrl[2] + t**3 * ctrl[3]


def _bez_d(ctrl, t):
    t = np.asarray(t)[:, None]
    u = 1 - t
    return 3 * (u * u * (ctrl[1] - ctrl[0]) + 2 * u * t * (ctrl[2] - ctrl[1]) + t * t * (ctrl[3] - ctrl[2]))


def _bez_dd(ctrl, t):
    t = np.asarray(t)[:, None]
    return 6 * ((1 - t) * (ctrl[2] - 2 * ctrl[1] + ctrl[0]) + t * (ctrl[3] - 2 * ctrl[2] + ctrl[1]))


def _chord(pts):
    d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    return d / d[-1] if d[-1] > 0 else d


def _generate(pts, u, t1, t2):
    p0, p3 = pts[0], pts[-1]
    a1, a2 = np.outer(3 * (1 - u) ** 2 * u, t1), np.outer(3 * (1 - u) * u * u, t2)
    c = np.array([[np.sum(a1 * a1), np.sum(a1 * a2)], [np.sum(a1 * a2), np.sum(a2 * a2)]])
    base = _bez(np.array([p0, p0, p3, p3]), u)
    tmp = pts - base
    x = np.array([np.sum(a1 * tmp), np.sum(a2 * tmp)])
    det = c[0, 0] * c[1, 1] - c[0, 1] * c[1, 0]
    seg = np.linalg.norm(p3 - p0)
    if abs(det) > 1e-12:
        al, ar = (x[0] * c[1, 1] - x[1] * c[0, 1]) / det, (c[0, 0] * x[1] - c[1, 0] * x[0]) / det
    else:
        al = ar = seg / 3
    if al < 1e-6 * seg or ar < 1e-6 * seg:
        al = ar = seg / 3
    return np.array([p0, p0 + t1 * al, p3 + t2 * ar, p3])


def _reparam(ctrl, pts, u):
    q, d1, d2 = _bez(ctrl, u) - pts, _bez_d(ctrl, u), _bez_dd(ctrl, u)
    num = np.sum(q * d1, axis=1)
    den = np.sum(d1 * d1, axis=1) + np.sum(q * d2, axis=1)
    out = u - np.where(np.abs(den) > 1e-12, num / np.where(den == 0, 1, den), 0)
    return np.clip(out, 0, 1)


def _fit(pts, t1, t2, tol, out):
    if len(pts) == 2:
        d = np.linalg.norm(pts[1] - pts[0]) / 3
        out.append(np.array([pts[0], pts[0] + t1 * d, pts[1] + t2 * d, pts[1]]))
        return
    u = _chord(pts)
    ctrl = _generate(pts, u, t1, t2)
    err = np.linalg.norm(_bez(ctrl, u) - pts, axis=1)
    if err.max() < tol:
        out.append(ctrl)
        return
    if err.max() < tol * 6:
        for _ in range(12):
            u = _reparam(ctrl, pts, u)
            ctrl = _generate(pts, u, t1, t2)
            err = np.linalg.norm(_bez(ctrl, u) - pts, axis=1)
            if err.max() < tol:
                out.append(ctrl)
                return
    k = int(np.argmax(err[1:-1])) + 1
    tc = _unit(pts[k - 1] - pts[k + 1])
    _fit(pts[:k + 1], t1, tc, tol, out)
    _fit(pts[k:], -tc, t2, tol, out)


def _tangent(pts, i, step, reach=6.0):
    """Direction leaving point i (step=+1) or arriving (step=-1), averaged over `reach` units of the outline."""
    n, p, acc, j = len(pts), pts[i], 0.0, i
    while True:
        j2 = (j + step) % n
        acc += np.linalg.norm(pts[j2] - pts[j])
        j = j2
        if acc >= reach or j == i:
            break
    return _unit(pts[j] - p)


def fit_ring(ring, tol=0.6, corner=45):
    """ring: list of (x, y) without the closing repeat. Returns a list of cubic segments (4 x 2 arrays)."""
    pts = []
    for a, b in zip(ring, ring[1:] + ring[:1]):      # dense enough that the error check sees every stretch
        k = max(1, int(math.dist(a, b) / 3))
        pts += [(a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k) for j in range(k)]
    pts = np.array(pts, dtype=float)
    n = len(pts)
    turn = []
    for i in range(n):
        a, b = _tangent(pts, i, -1), _tangent(pts, i, +1)
        turn.append(math.degrees(math.acos(max(-1, min(1, -float(np.dot(a, b)))))))
    # a corner is a local maximum of turning above the threshold
    cs = [i for i in range(n) if turn[i] > corner and turn[i] >= turn[i - 1] and turn[i] >= turn[(i + 1) % n]]
    segs = []
    if not cs:
        start = int(np.argmax(pts[:, 1]))       # start at the top; any smooth point will do
        order = np.concatenate([pts[start:], pts[:start + 1]])
        t = _unit(_tangent(pts, start, +1) - _tangent(pts, start, -1))
        _fit(order, t, -t, tol, segs)
        return segs
    for a, b in zip(cs, cs[1:] + cs[:1]):
        run = pts[a:b + 1] if b > a else np.concatenate([pts[a:], pts[:b + 1]])
        if len(run) < 2:
            continue
        _fit(run, _tangent(pts, a, +1), _tangent(pts, b, -1), tol, segs)
    return segs
