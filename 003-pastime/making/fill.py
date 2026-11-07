# Crossword filler: bitset candidate sets, most-constrained-slot-first DFS, random restarts.
# usage: python3 fill.py template.txt [runs] [seed]
import sys, re, random, time
from grid import parse, slots, report

DICT = '/usr/share/dict/'

def load_words():
    def read(name):
        return set(w.strip() for w in open(DICT + name, encoding='utf-8', errors='ignore'))
    am, br = read('american-english'), read('british-english')
    common = set(w.lower() for w in read('cracklib-small'))
    base = {w for w in am & br if re.fullmatch(r'[a-z]{3,15}', w)}
    black = set()
    try:
        black = {w.strip().lower() for w in open('blacklist.txt') if w.strip() and not w.startswith('%')}
    except FileNotFoundError:
        pass
    extra = {}
    try:
        for line in open('extras.txt'):
            line = line.split('%')[0].strip()
            if not line:
                continue
            key = re.sub(r'[^A-Z]', '', line.upper())
            extra[key] = line
    except FileNotFoundError:
        pass
    stems = set(l.split('/')[0].strip().lower() for l in open('/usr/share/hunspell/en_US.dic', encoding='utf-8', errors='ignore'))
    score = {}
    for w in base:
        if w in black:
            continue
        s = 3.0 if w in common else -2.0
        if w in stems:
            s += 1.0
        if w.endswith('s') and w[:-1] in base:
            s -= 1.2
        if w.endswith('es') and w[:-2] in base:
            s -= 1.2
        if re.search(r'(ier|iest)$', w) or (w.endswith('est') and w[:-3] in base):
            s -= 2.5
        if w.endswith('ed') and (w[:-2] in base or w[:-1] in base):
            s -= 0.6
        if w.endswith('ing') and (w[:-3] in base or w[:-3] + 'e' in base):
            s -= 0.6
        if w.endswith('ness') or w.endswith('nesses'):
            s -= 1.5
        if w.endswith('ly') and w[:-2] in base:
            s -= 0.5
        if len(w) == 3:
            s -= 1.0
        score[w.upper()] = s
    for k in extra:
        score[k] = 2.5
    try:
        for line in open('theme.txt'):
            line = line.split('%')[0].strip()
            if line:
                key = re.sub(r'[^A-Z]', '', line.upper())
                score[key] = score.get(key, 0) + 8
                extra.setdefault(key, line)
    except FileNotFoundError:
        pass
    try:
        for w in open('nice.txt').read().split():
            if w.upper() in score:
                score[w.upper()] += 3
    except FileNotFoundError:
        pass
    for w in black:
        score.pop(w.upper(), None)
    return score, extra

class Filler:
    def __init__(self, rows, score, rng, restrict=None):
        self.rows = parse(rows)
        self.n = len(self.rows)
        self.sl = slots(self.rows)
        self.rng = rng
        lens = {len(s[3]) for s in self.sl}
        self.words, self.masks = {}, {}
        for L in lens:
            ws = [w for w in score if len(w) == L]
            ws.sort(key=lambda w: -(score[w] + rng.random() * 1.5))
            self.words[L] = ws
            m = {}
            for i, w in enumerate(ws):
                bit = 1 << i
                for p, ch in enumerate(w):
                    m[(p, ch)] = m.get((p, ch), 0) | bit
            self.masks[L] = (m, (1 << len(ws)) - 1)
        # per-slot allowed word masks, keyed by slot index
        self.allow = {}
        for key, allowed in (restrict or {}).items():
            d, rc = key[0], key[1:]
            r, c = map(int, rc.split(','))
            idx = [i for i, s in enumerate(self.sl) if s[0] == d and s[1] == r and s[2] == c]
            assert idx, 'no slot ' + key
            i = idx[0]
            L = len(self.sl[i][3])
            pos = {w: j for j, w in enumerate(self.words[L])}
            mask = 0
            for w in allowed:
                w = re.sub(r'[^A-Z]', '', w.upper())
                assert len(w) == L, (key, w)
                assert w in pos, ('not in word list', w)
                mask |= 1 << pos[w]
            self.allow[i] = mask

    def cand(self, cells, letters, used, i=None):
        L = len(cells)
        m, allm = self.masks[L]
        acc = allm & ~used.get(L, 0)
        if i in self.allow:
            acc &= self.allow[i]
        for p, cell in enumerate(cells):
            ch = letters.get(cell)
            if ch:
                acc &= m.get((p, ch), 0)
                if not acc:
                    return 0
        return acc

    def run(self, node_limit=200000):
        letters = {}
        for r in range(self.n):
            for c in range(self.n):
                ch = self.rows[r][c]
                if ch not in '.#':
                    letters[(r, c)] = ch
        assigned = [None] * len(self.sl)
        used = {}
        self.nodes = 0
        sys.setrecursionlimit(10000)

        def dfs():
            self.nodes += 1
            if self.nodes > node_limit:
                return False
            best, bestc, bestn = None, None, 1 << 60
            for i, s in enumerate(self.sl):
                if assigned[i] is not None:
                    continue
                c = self.cand(s[3], letters, used, i)
                k = c.bit_count()
                if k == 0:
                    return False
                if k < bestn:
                    best, bestc, bestn = i, c, k
                    if k == 1:
                        break
            if best is None:
                return True
            cells = self.sl[best][3]
            L = len(cells)
            ws = self.words[L]
            tried = 0
            m = bestc
            while m and tried < 12:
                low = m & -m
                idx = low.bit_length() - 1
                m ^= low
                tried += 1
                w = ws[idx]
                newly = [cell for p, cell in enumerate(cells) if cell not in letters]
                for p, cell in enumerate(cells):
                    letters[cell] = w[p]
                assigned[best] = w
                used[L] = used.get(L, 0) | low
                if dfs():
                    return True
                used[L] ^= low
                assigned[best] = None
                for cell in newly:
                    del letters[cell]
            return False

        ok = dfs()
        return ok, letters, assigned

def show(rows, letters):
    n = len(rows)
    out = []
    for r in range(n):
        out.append(' '.join('#' if rows[r][c] == '#' else letters.get((r, c), '.') for c in range(n)))
    return '\n'.join(out)

if __name__ == '__main__':
    from mk import build
    spec = eval(open(sys.argv[1]).read())
    tpl = build(spec['black'], spec.get('main', 'YOURTURN'), spec.get('anti', 'THANKYOU'), spec.get('anti_from', 'bottom'))
    restrict = spec.get('restrict', {})
    runs = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    for row in tpl:
        print(' '.join(row))
    sl, probs = report(tpl)
    score, extra = load_words()
    THEME = set()
    for line in open('theme.txt'):
        line = line.split('%')[0].strip()
        if line:
            THEME.add(re.sub(r'[^A-Z]', '', line.upper()))
    for ws in restrict.values():
        for w in ws:
            k = re.sub(r'[^A-Z]', '', w.upper())
            if k not in score:
                score[k] = 10.0
    print('words', len(score))
    results = []
    t0 = time.time()
    for k in range(runs):
        rng = random.Random(seed + k)
        f = Filler(tpl, score, rng, restrict)
        ok, letters, assigned = f.run(node_limit=int(sys.argv[4]) if len(sys.argv) > 4 else 20000)
        if ok:
            ws = list(assigned)
            tot = sum(score[w] for w in ws)
            bad = sum(1 for w in ws if score[w] < 0)
            th = sum(1 for w in ws if w in THEME)
            results.append((bad, -th, -tot, k, show(f.rows, letters), ws))
    print(f'{len(results)}/{runs} filled in {time.time() - t0:.0f}s')
    results.sort()
    top = int(sys.argv[5]) if len(sys.argv) > 5 else 3
    for bad, nth, ntot, k, pic, ws in results[:top]:
        print(f'--- seed {seed + k}: {bad} weak, {-nth} theme, total {-ntot:.1f}')
        print(pic)
        print(' '.join(w + ('*' if score[w] < 0 else '') + ('+' if w in THEME else '') for w in ws))
