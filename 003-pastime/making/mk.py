# Build a symmetric 15x15 British-style template from a list of extra black cells.
# (odd, odd) cells are black by default. Extra blacks are mirrored through the centre.
# Nina letters go on the diagonals.
import sys
from grid import report

N = 15
MAIN = 'YOURTURN'   # (0,0) (2,2) ... (14,14)
ANTI = 'THANKYOU'   # read bottom-left to top-right: (14,0) (12,2) ... (0,14)

def build(extra, main=MAIN, anti=ANTI, anti_from='bottom'):
    g = [['.'] * N for _ in range(N)]
    for r in range(N):
        for c in range(N):
            if r % 2 and c % 2:
                g[r][c] = '#'
    for r, c in extra:
        g[r][c] = '#'
        g[N - 1 - r][N - 1 - c] = '#'
    for k in range(8):
        i = 2 * k
        for (r, c, ch) in ((i, i, main[k] if main else '.'), ((N - 1 - i, i) if anti_from == 'bottom' else (i, N - 1 - i)) + (anti[k] if anti else '.',)):
            assert g[r][c] != '#', (r, c)
            g[r][c] = ch
    return [''.join(row) for row in g]

if __name__ == '__main__':
    spec = eval(open(sys.argv[1]).read())
    rows = build(spec['black'], spec.get('main', MAIN), spec.get('anti', ANTI), spec.get('anti_from', 'bottom'))
    for row in rows:
        print(' '.join(row))
    report(rows)
    open(sys.argv[2], 'w').write('\n'.join(rows) + '\n')
