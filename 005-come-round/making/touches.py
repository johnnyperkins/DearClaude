# Short true touches of Plain Bob Minor (bob = 14, single = 1234 at the lead end). Entry 005.
import itertools
def ch(pn):
    if pn == 'x': return [0, 2, 4]
    pl = [int(c) - 1 for c in pn]; out, i = [], 0
    while i < 5:
        if i in pl: i += 1
        else: out.append(i); i += 2
    return out
def app(r, c):
    r = list(r)
    for i in c: r[i], r[i + 1] = r[i + 1], r[i]
    return tuple(r)
lead = [ch(p) for p in 'x 16 x 16 x 16 x 16 x 16 x'.split()]
LE = {'P': ch('12'), 'B': ch('14'), 'S': ch('1234')}
R = tuple(range(1, 7))
for n in range(2, 13):
    found = []
    for seq in itertools.product('PBS', repeat=n):
        if seq.count('S') not in (0, 2): continue
        row, rows = R, [R]
        for c in seq:
            for x in lead: row = app(row, x); rows.append(row)
            row = app(row, LE[c]); rows.append(row)
        if row == R and len(set(rows[:-1])) == len(rows) - 1 and all(''.join(map(str, r)) != '123456' for r in rows[1:-1]):
            found.append(''.join(seq))
    if found: print(n * 12, len(found), found[:12])
