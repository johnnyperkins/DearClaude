"""Write data.json for the page: every state, what its top looks like, and where each flex goes.

Also checks the kaleidoscope claim: with the corner classes below, every view of every state is a
window onto a *333 wallpaper (same class meets same class along every hinge).
"""
import json, sim

def classes(face, leaf):
    """Which wallpaper corner class (0,1,2) each printed corner of this leaf side gets."""
    if face <= 3:
        return [0, 1, 2]
    a = {4: {1, 7, 13}, 5: {2, 8, 14}, 6: {4, 10, 16}}[face]
    if leaf in a:
        return [0, 1, 2]
    return [1, 2, 0] if face == 4 else [2, 0, 1]

def canon(s):
    reps = [(repr(sim.rotate(s, m)), m) for m in range(6)]
    r, m = min(reps)
    return sim.rotate(s, m), m

def top_view(s):
    place = sim.place_all(s)
    out = []
    for j, p in enumerate(s):
        x = sim.top(p); k = abs(x); tri = sim.strip_tri(k)
        inv = {q: v for v, q in place[k].items()}
        face = sim.FRONT[k] if x > 0 else sim.BACK[k]
        out.append([face, k, 1 if x > 0 else -1,
                    tri.index(inv[0]), tri.index(inv[1 + j]), tri.index(inv[1 + (j + 1) % 6])])
    return out

def check_kaleido(view):
    face = view[0][0]
    cls = [[classes(face, k)[c] for c in (cO, cA, cB)] for f, k, sd, cO, cA, cB in view]
    assert all(f == face for f, *_ in view)
    assert len({c[0] for c in cls}) == 1, cls
    for j in range(6):
        assert cls[j][2] == cls[(j + 1) % 6][1], (face, cls)
    return face, cls[0][0]

seen, _ = sim.explore()
canons = {}
for s in seen.values():
    c, _ = canon(s)
    canons[repr(c)] = c
keys = sorted(canons)
index = {k: i for i, k in enumerate(keys)}
states = []
views = set()
for k in keys:
    s = canons[k]
    tv = top_view(s)
    fv = check_kaleido(tv)
    views.add(fv)
    flex = []
    for f in range(6):
        u = sim.pinch(sim.rotate(s, f))
        if u is None:
            flex.append(None)
            continue
        cu, m = canon(u)
        # u's pat r sits at relative sector f + r; canon pat r' = u pat (r' + m) -> relative sector f + m + r'
        flex.append([index[repr(cu)], (f + m) % 6])
    t = sim.turn_over(s)
    ct, m = canon(t)
    states.append({'pats': s, 'top': tv, 'view': list(fv), 'flex': flex, 'turn': [index[repr(ct)], m]})
start, m0 = canon(sim.START)
print(len(states), 'states;', len(views), 'views:', sorted(views))
print('start', index[repr(start)], states[index[repr(start)]]['view'])
json.dump({'states': states, 'start': index[repr(start)]}, open('data.json', 'w'), separators=(',', ':'))

# ---- folding steps, for the instruction diagrams ----
import fold, copy

def snapshot(st, note):
    """Top triangle of every stack, with its strip corners' positions (strip units, y up)."""
    cells = fold.cells(st)
    out = []
    for key, ts in cells.items():
        t = ts[0]
        up = st['up'][t]
        out.append([t, up, [list(map(lambda v: round(v, 5), st['pos'][t][v])) for v in sim.strip_tri(t)], len(ts)])
    under = []
    for key, ts in cells.items():   # and the bottom one, for drawing the back
        t = ts[-1]
        under.append([t, st['up'][t], [list(map(lambda v: round(v, 5), st['pos'][t][v])) for v in sim.strip_tri(t)], len(ts)])
    pos = {t: [list(map(lambda v: round(v, 5), st['pos'][t][v])) for v in sim.strip_tri(t)] for t in fold.TRIS}
    return {'note': note, 'top': out, 'bottom': under, 'pos': pos}

st = fold.fresh()
steps = [snapshot(st, 'flat')]
for k in [2, 4, 6, 8, 10, 12, 14, 16]:
    fold.fold(st, k, 'after', 'under' if st['up'][k] == 1 else 'over')
    if k == 2:
        steps.append(snapshot(st, 'first pair'))
    if k == 4:
        steps.append(snapshot(st, 'second pair'))
steps.append(snapshot(st, 'rolled'))
for k in (3, 9, 15):
    fold.fold(st, k, 'after', 'over')
    steps.append(snapshot(st, f'fold {k}'))
fold.fold(st, 18, 'after', 'over')
z = [t for t in st['z'] if t not in (18, 19)]
i = z.index(1)
st['z'] = z[:i + 1] + [19, 18] + z[i + 1:]
steps.append(snapshot(st, 'tucked'))
ok, info = fold.matches_start(st)
print('fold steps', len(steps), 'end matches start (mirrored frame):', info)
d = json.load(open('data.json'))
d['steps'] = steps
json.dump(d, open('data.json', 'w'), separators=(',', ':'))
