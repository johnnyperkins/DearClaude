# Improve a fill by large-neighbourhood search: repeatedly clear a few slots and refill them,
# keeping the change when the total word score goes up.
# usage: python3 lns.py spec [restarts] [iters] [seed]
import sys, random, re, time
from mk import build
from grid import slots
from fill import load_words, Filler, show

def dfs_fill(f, letters, assigned, used, free, rng, node_limit=3000):
    # fill only the slots in `free` (others stay as they are)
    nodes = [0]
    def rec():
        nodes[0] += 1
        if nodes[0] > node_limit:
            return False
        best, bestc, bestn = None, None, 1 << 60
        for i in free:
            if assigned[i] is not None:
                continue
            c = f.cand(f.sl[i][3], letters, used, i)
            k = c.bit_count()
            if k == 0:
                return False
            if k < bestn:
                best, bestc, bestn = i, c, k
        if best is None:
            return True
        cells = f.sl[best][3]
        L = len(cells)
        ws = f.words[L]
        # candidate order: best score first, with a little shuffling among the top few
        idxs = []
        m = bestc
        while m and len(idxs) < 40:
            low = m & -m
            idxs.append(low.bit_length() - 1)
            m ^= low
        idxs.sort(key=lambda j: j + rng.random() * 25)
        for j in idxs[:8]:
            w = ws[j]
            low = 1 << j
            newly = [cell for cell in cells if cell not in letters]
            for p, cell in enumerate(cells):
                letters[cell] = w[p]
            assigned[best] = w
            used[L] = used.get(L, 0) | low
            if rec():
                return True
            used[L] ^= low
            assigned[best] = None
            for cell in newly:
                del letters[cell]
        return False
    return rec()

def total(ws, score):
    return sum(score[w] for w in ws)

def improve(f, score, letters, assigned, rng, iters):
    n = len(f.sl)
    cover = {}
    for i, s in enumerate(f.sl):
        for cell in s[3]:
            cover.setdefault(cell, []).append(i)
    cur = total(assigned, score)
    for it in range(iters):
        # pick a seed slot (biased to weak words) and free it plus some neighbours
        weights = [max(0.2, 6 - score[w]) for w in assigned]
        i0 = rng.choices(range(n), weights)[0]
        free = {i0}
        frontier = [i0]
        want = rng.randint(2, 6)
        while frontier and len(free) < want:
            i = frontier.pop(rng.randrange(len(frontier)))
            for cell in f.sl[i][3]:
                for j in cover[cell]:
                    if j not in free and not f.fixed[j]:
                        free.add(j)
                        frontier.append(j)
        free = [i for i in free if not f.fixed[i]]
        if not free:
            continue
        old = {i: assigned[i] for i in free}
        L2 = dict(letters)
        A2 = list(assigned)
        for i in free:
            A2[i] = None
        keep = set()
        for i, s in enumerate(f.sl):
            if A2[i] is not None:
                keep.update(s[3])
        keep.update(f.given)
        for cell in list(L2):
            if cell not in keep:
                del L2[cell]
        used = {}
        for i, w in enumerate(A2):
            if w is not None:
                L = len(w)
                used[L] = used.get(L, 0) | (1 << f.index[L][w])
        if dfs_fill(f, L2, A2, used, free, rng):
            new = total(A2, score)
            if new > cur + 1e-9 or (new >= cur - 0.5 and rng.random() < 0.03):
                letters.clear(); letters.update(L2)
                assigned[:] = A2
                cur = new
    return cur

if __name__ == '__main__':
    spec = eval(open(sys.argv[1]).read())
    restarts = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    iters = int(sys.argv[3]) if len(sys.argv) > 3 else 3000
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    tpl = build(spec['black'], spec.get('main', 'YOURTURN'), spec.get('anti', 'THANKYOU'), spec.get('anti_from', 'bottom'))
    restrict = spec.get('restrict', {})
    score, extra = load_words()
    THEME = set(re.sub(r'[^A-Z]', '', l.split('%')[0].strip().upper()) for l in open('theme.txt') if l.split('%')[0].strip())
    for ws in restrict.values():
        for w in ws:
            score.setdefault(re.sub(r'[^A-Z]', '', w.upper()), 10.0)
    results = []
    t0 = time.time()
    for k in range(restarts):
        rng = random.Random(seed + k)
        f = Filler(tpl, score, rng, restrict)
        f.index = {L: {w: j for j, w in enumerate(ws)} for L, ws in f.words.items()}
        f.fixed = [False] * len(f.sl)
        f.given = {(r, c) for r in range(15) for c in range(15) if tpl[r][c] not in '.#'}
        ok, letters, assigned = f.run(node_limit=20000)
        if not ok:
            continue
        before = total(assigned, score)
        after = improve(f, score, letters, assigned, rng, iters)
        weak = sum(1 for w in assigned if score[w] < 0)
        th = sum(1 for w in assigned if w in THEME)
        results.append((weak, -after, k, show(f.rows, letters), list(assigned), before))
        print(f'restart {k}: {before:.1f} -> {after:.1f}, weak {weak}, theme {th}, {time.time() - t0:.0f}s', flush=True)
    results.sort()
    for weak, na, k, pic, ws, before in results[:3]:
        print(f'--- seed {seed + k}: weak {weak}, total {-na:.1f}')
        print(pic)
        print(' '.join(w + ('*' if score[w] < 0 else '') + ('+' if w in THEME else '') for w in ws))
