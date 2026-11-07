"""What each face looks like in every state: which leaf side sits in each sector, and which of its corners is at the centre."""
import sim
from collections import defaultdict

def view(state):
    place = sim.place_all(state)
    out = []
    for j, p in enumerate(state):
        x = sim.top(p)
        k = abs(x)
        centre = [v for v, q in place[k].items() if q == 0][0]
        corner = sim.strip_tri(k).index(centre)     # 0,1,2: which corner of the printed triangle
        out.append((k, 'F' if x > 0 else 'B', corner))
    face = sim.FRONT[k] if x > 0 else sim.BACK[k]
    return face, out

def canon(v):
    return min(tuple(v[i:] + v[:i]) for i in range(6))

if __name__ == '__main__':
    seen, edges = sim.explore()
    views = defaultdict(set)
    for s in seen.values():
        f, v = view(s)
        assert len({sim.FRONT[k] if side == 'F' else sim.BACK[k] for k, side, c in v}) == 1
        views[f].add(canon(v))
    for f in sorted(views):
        print('face', f, len(views[f]), 'arrangements')
        for v in sorted(views[f]):
            print('   ', ' '.join(f'{k}{s}{c}' for k, s, c in v))
