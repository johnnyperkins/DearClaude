"""Hexahexaflexagon simulator.

Pat algebra (trees of signed leaf ids, left = top) with the pinch flex from
Flexagonator (github.com/loki3/flexagonator, MakeFlexes.ts createPinch).
Every state is checked against real geometry: leaves are placed by walking
the paper strip hinge by hinge, and each hinge has to land where the pats say.
"""
import math

FRONT = {k: (k - 1) % 3 + 1 for k in range(1, 19)}
BACK = dict(zip(range(1, 19), [4, 5, 5, 6, 6, 4] * 3))
START = [[1, -18], [[4, -5], [2, -3]], [7, -6], [[10, -11], [8, -9]], [13, -12], [[16, -17], [14, -15]]]

def flip(p):
    return [flip(p[1]), flip(p[0])] if isinstance(p, list) else -p

def match(pat, pattern, env):
    if isinstance(pattern, list):
        return isinstance(pat, list) and match(pat[0], pattern[0], env) and match(pat[1], pattern[1], env)
    env[abs(pattern)] = pat if pattern > 0 else flip(pat)
    return True

def build(pattern, env):
    if isinstance(pattern, list):
        return [build(pattern[0], env), build(pattern[1], env)]
    return env[pattern] if pattern > 0 else flip(env[-pattern])

PIN_IN = [[1, 2], 3, [4, 5], 6, [7, 8], 9]
PIN_OUT = [-1, [5, -3], -4, [8, -6], -7, [2, -9]]

def pinch(state):
    env = {}
    if not all(match(p, q, env) for p, q in zip(state, PIN_IN)):
        return None
    return [build(q, env) for q in PIN_OUT]

def rotate(state, n):          # look at the next vertex: same flexagon, different "current hinge"
    n %= 6
    return state[n:] + state[:n]

def turn_over(state):
    return [flip(p) for p in reversed(state)]

def leaves(p):
    return leaves(p[0]) + leaves(p[1]) if isinstance(p, list) else [p]

def top(p):
    return top(p[0]) if isinstance(p, list) else p

def bottom(p):
    return bottom(p[1]) if isinstance(p, list) else p

def faces(state):
    t = [FRONT[x] if x > 0 else BACK[-x] for x in map(top, state)]
    b = [BACK[x] if x > 0 else FRONT[-x] for x in map(bottom, state)]
    return t, b

# ---- geometry -------------------------------------------------------------
# Strip: triangle k (1..18) in a straight strip, vertices named ('b',i) / ('t',i).
def strip_tri(k):
    if k % 2:  # up triangle
        i = (k - 1) // 2
        return [('b', i), ('b', i + 1), ('t', i)]
    i = k // 2
    return [('t', i - 1), ('t', i), ('b', i)]

def strip_xy(v):
    s, i = v
    return (i, 0.0) if s == 'b' else (i + 0.5, math.sqrt(3) / 2)

def glue(v):   # triangle 19 is the glue tab that lands on triangle 1
    s, i = v
    return (s, i - 9)

def hinge(k):
    """(vertices shared by k and k+1 as named in k, the same named in k+1)"""
    if k < 18:
        a, b = set(strip_tri(k)), set(strip_tri(k + 1))
        sh = sorted(a & b)
        return sh, sh
    a, b = set(strip_tri(18)), set(strip_tri(19))
    sh = sorted(a & b)
    return sh, [glue(v) for v in sh]

P = [(0.0, 0.0)] + [(math.cos(math.pi / 3 * j), math.sin(math.pi / 3 * j)) for j in range(6)]  # 0 = centre, 1+j = V_j

def near(pt):
    for i, q in enumerate(P):
        if abs(pt[0] - q[0]) < 1e-6 and abs(pt[1] - q[1]) < 1e-6:
            return i
    return None

def reflect(pt, a, b):
    ax, ay = a; bx, by = b; px, py = pt
    dx, dy = bx - ax, by - ay
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    fx, fy = ax + t * dx, ay + t * dy
    return (2 * fx - px, 2 * fy - py)

def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

def sector_pts(j):
    return {0, 1 + j % 6, 1 + (j + 1) % 6}

def side_up(k, place):
    tri = strip_tri(k)
    s = cross(*[strip_xy(v) for v in tri])
    h = cross(*[P[place[v]] for v in tri])
    return 1 if s * h < 0 else -1   # +1 means the front is up (the strip is drawn front side down)

def place_all(state):
    """Return {leaf: {vertex: point index}} or raise if the paper can't do this."""
    sector, sign = {}, {}
    for j, p in enumerate(state):
        for x in leaves(p):
            sector[abs(x)] = j
            sign[abs(x)] = 1 if x > 0 else -1
    good = []
    tri1 = strip_tri(1)
    j1 = sector[1]
    pts = [0, 1 + j1, 1 + (j1 + 1) % 6]
    import itertools
    for perm in itertools.permutations(pts):
        place = {1: dict(zip(tri1, perm))}
        try:
            for k in range(1, 19):
                nk = k % 18 + 1
                shk, shn = hinge(k)
                third_k = [v for v in strip_tri(k) if v not in shk][0]
                tri_n = strip_tri(nk)
                third_n = [v for v in tri_n if v not in shn][0]
                pk = place[k]
                if sector[nk] == sector[k]:
                    w = pk[third_k]
                else:
                    w = near(reflect(P[pk[third_k]], P[pk[shk[0]]], P[pk[shk[1]]]))
                    if w is None:
                        raise ValueError(f'hinge {k}-{nk} flat on an outer edge')
                new = {shn[0]: pk[shk[0]], shn[1]: pk[shk[1]], third_n: w}
                if set(new.values()) != sector_pts(sector[nk]):
                    raise ValueError(f'leaf {nk} lands outside sector {sector[nk]}')
                if nk == 1:
                    if new != place[1]:
                        raise ValueError('loop does not close')
                else:
                    place[nk] = new
            for k in range(1, 19):
                if side_up(k, place[k]) != sign[k]:
                    raise ValueError(f'leaf {k} has the wrong side up')
            good.append(place)
        except ValueError:
            pass
    if len(good) != 1:
        raise ValueError(f'{len(good)} consistent placements')
    return good[0]

def key(state):
    return repr(state)

def explore():
    """Every state reachable by pinch flexes at any vertex, and turning over."""
    seen, todo, edges = {key(START): START}, [START], []
    while todo:
        s = todo.pop()
        place_all(s)
        for n in range(6):
            r = rotate(s, n)
            for t in (r, turn_over(r)):
                u = pinch(t)
                if u is None:
                    continue
                for m in range(6):   # store with a canonical rotation so vertices don't multiply states
                    pass
                k = key(u)
                edges.append((key(s), n, t is not r, k))
                if k not in seen:
                    seen[k] = u
                    todo.append(u)
    return seen, edges

if __name__ == '__main__':
    place_all(START)
    print('start ok', faces(START))
    seen, edges = explore()
    print(len(seen), 'states', len(edges), 'flexes')
