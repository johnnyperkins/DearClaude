# Grid helpers: parse a template, find slots, report checking.
# A template is a list of strings: '#' black, '.' empty white, 'A'-'Z' fixed letter.

def parse(rows):
    rows = [r.replace(' ', '') for r in rows]
    n = len(rows)
    assert all(len(r) == n for r in rows), [len(r) for r in rows]
    return rows

def slots(rows):
    n = len(rows)
    out = []
    for r in range(n):
        c = 0
        while c < n:
            if rows[r][c] != '#':
                s = c
                while c < n and rows[r][c] != '#':
                    c += 1
                if c - s >= 2:
                    out.append(('A', r, s, [(r, x) for x in range(s, c)]))
            else:
                c += 1
    for c in range(n):
        r = 0
        while r < n:
            if rows[r][c] != '#':
                s = r
                while r < n and rows[r][c] != '#':
                    r += 1
                if r - s >= 2:
                    out.append(('D', s, c, [(y, c) for y in range(s, r)]))
            else:
                r += 1
    return out

def number(rows, sl):
    # standard numbering: scan cells in reading order, number any cell that starts a slot
    starts = {}
    for d, r, c, cells in sl:
        starts.setdefault((r, c), []).append(d)
    nums, k = {}, 0
    for (r, c) in sorted(starts):
        k += 1
        nums[(r, c)] = k
    return nums

def symmetric(rows):
    n = len(rows)
    return all((rows[r][c] == '#') == (rows[n - 1 - r][n - 1 - c] == '#') for r in range(n) for c in range(n))

def report(rows, verbose=True):
    rows = parse(rows)
    n = len(rows)
    sl = slots(rows)
    cover = {}
    for i, (d, r, c, cells) in enumerate(sl):
        for cell in cells:
            cover.setdefault(cell, []).append(i)
    problems = []
    for r in range(n):
        for c in range(n):
            if rows[r][c] != '#' and (r, c) not in cover:
                problems.append(f'orphan cell {(r, c)}')
    lens = []
    for d, r, c, cells in sl:
        L = len(cells)
        lens.append(L)
        if L < 3:
            problems.append(f'short {d} {r},{c} len {L}')
        chk = [len(cover[x]) > 1 for x in cells]
        nck = sum(chk)
        if nck * 2 < L:
            problems.append(f'undercheck {d} {r},{c} {nck}/{L}')
        if not chk[0]:
            problems.append(f'unch first {d} {r},{c}')
        for i in range(L - 1):
            if not chk[i] and not chk[i + 1]:
                problems.append(f'double unch {d} {r},{c} at {i}')
    if not symmetric(rows):
        problems.append('not symmetric')
    white = sum(ch != '#' for row in rows for ch in row)
    if verbose:
        from collections import Counter
        print('slots', len(sl), 'white', white, 'lengths', sorted(Counter(lens).items()))
        for p in problems:
            print('  !', p)
    return sl, problems
