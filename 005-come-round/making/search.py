# Search symmetric treble-dodging Minor methods (2nds or 6ths place lead end), keep the true ones,
# and score each plain course for music. Entry 005.
import itertools, sys
N = 6
def changes():
    out = []
    for mask in range(1 << (N - 1)):              # bit i: swap positions i, i+1 (0-based)
        pairs = [i for i in range(N - 1) if mask >> i & 1]
        if any(b - a == 1 for a, b in zip(pairs, pairs[1:])): continue
        out.append(frozenset(pairs))
    return out
ALL = changes()
def places(c):
    sw = set(); [sw.update((i, i + 1)) for i in c]
    return [p for p in range(N) if p not in sw]
def pn(c):
    p = places(c); return 'x' if not p else ''.join(str(q + 1) for q in p)
def move(pos, c):
    if pos in c: return pos + 1
    if pos - 1 in c: return pos - 1
    return pos
def apply(row, c):
    r = list(row)
    for i in c: r[i], r[i + 1] = r[i + 1], r[i]
    return tuple(r)
path = [0, 1, 0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 5]    # treble position, rows 0..12 of the half lead
slots = [[c for c in ALL if move(path[k], c) == path[k + 1]] for k in range(12)]
NAMED = {'135246': 'queens', '142536': 'tittums', '531246': 'kings', '654321': 'backrounds', '123456': 'rounds'}
def music(rows):
    s = 0
    for r in rows:
        t = ''.join(map(str, r))
        if t in NAMED and t != '123456': s += 4
        for run in ('3456', '6543', '2345', '5432', '1234', '4321'):
            if t.startswith(run) or t.endswith(run): s += 1
        if t.endswith('56') or t.endswith('65'): s += 0.1
    return s
res = []
def halves(k=0, acc=()):
    # no bell may make places in the same position on consecutive changes (keeps it lively)
    if k == 12: yield acc; return
    for c in slots[k]:
        if acc and set(places(acc[-1])) & set(places(c)): continue
        yield from halves(k + 1, acc + (c,))
for half in halves():
    lead = list(half) + list(half[-2::-1])
    for le in (frozenset([2, 4]), frozenset([1, 3])):   # 12 or 16
        full = lead + [le]
        row = tuple(range(1, N + 1)); rows = [row]
        for _ in range(10):
            for c in full:
                row = apply(row, c); rows.append(row)
            if row == tuple(range(1, N + 1)): break
        if row != tuple(range(1, N + 1)) or len(rows) != 121: continue
        if len(set(rows[:-1])) != 120: continue
        cross = [half[3], half[7]]
        internal = sum(any(0 < p < N - 1 for p in places(c)) for c in cross)
        cls = {2: 'Surprise', 1: 'Delight', 0: 'Treble Bob'}[internal]
        name = ''.join(pn(c) if pn(c) == 'x' else ('.' + pn(c) + '.') for c in half).replace('..', '.').strip('.')
        res.append((music(rows[:-1]), cls, '&' + name + ',' + pn(le), rows))
res.sort(key=lambda r: -r[0])
print(len(res), 'true methods')
for m, cls, n, _ in res[:25]: print(f'{m:5.1f}  {cls:10s} {n}')
