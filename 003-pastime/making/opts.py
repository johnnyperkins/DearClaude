# Given a filled grid, free some slots and list the best ways to refill them.
# usage: python3 opts.py fill.txt "A4,0 D0,0" [top]
# fill.txt: 15 lines of the grid (letters and #, spaces optional)
import sys, re
from grid import slots
from fill import load_words

rows = [l.replace(' ', '').strip() for l in open(sys.argv[1]) if l.strip()]
free_keys = sys.argv[2].split()
top = int(sys.argv[3]) if len(sys.argv) > 3 else 25
score, extra = load_words()
tpl = [''.join('#' if ch == '#' else '.' for ch in r) for r in rows]
sl = slots(tpl)
key = {f'{d}{r},{c}': i for i, (d, r, c, cells) in enumerate(sl)}
free = [key[k] for k in free_keys]
letters = {}
freecells = set()
for i in free:
    freecells.update(sl[i][3])
# a cell keeps its letter if some non-free slot covers it
covered = set()
for i, s in enumerate(sl):
    if i not in free:
        covered.update(s[3])
for r in range(15):
    for c in range(15):
        if rows[r][c] != '#' and ((r, c) in covered or (r, c) not in freecells):
            letters[(r, c)] = rows[r][c]
# keep the diagonal message
for k in range(8):
    i = 2 * k
    letters[(i, i)] = rows[i][i]
    letters[(14 - i, i)] = rows[14 - i][i]
existing = set()
for i, s in enumerate(sl):
    if i not in free:
        existing.add(''.join(rows[r][c] for r, c in s[3]))
bylen = {}
for w in score:
    bylen.setdefault(len(w), []).append(w)
for L in bylen:
    bylen[L].sort(key=lambda w: -score[w])

results = []
def rec(assign, order):
    if len(results) > 200000:
        return
    # choose most constrained free slot
    best, bestc = None, None
    for i in free:
        if i in assign:
            continue
        pat = ''.join(letters.get(x, '.') for x in sl[i][3])
        rx = re.compile(pat)
        cs = [w for w in bylen[len(pat)] if rx.fullmatch(w) and w not in existing and w not in assign.values()]
        if not cs:
            return
        if best is None or len(cs) < len(bestc):
            best, bestc = i, cs
    if best is None:
        results.append(dict(assign))
        return
    for w in bestc[:60]:
        newly = [x for x in sl[best][3] if x not in letters]
        for x, ch in zip(sl[best][3], w):
            letters[x] = ch
        assign[best] = w
        rec(assign, order)
        del assign[best]
        for x in newly:
            del letters[x]

rec({}, [])
ranked = sorted(results, key=lambda a: -sum(score[w] for w in a.values()))
print(len(results), 'refills')
seen = set()
n = 0
for a in ranked:
    sig = tuple(a[i] for i in free)
    if sig in seen:
        continue
    seen.add(sig)
    print(f"{sum(score[w] for w in a.values()):6.1f}  " + '  '.join(f'{free_keys[j]}={a[i]}' for j, i in enumerate(free)))
    n += 1
    if n >= top:
        break
