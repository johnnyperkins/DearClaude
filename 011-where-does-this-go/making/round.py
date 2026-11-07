# The round, as data, and a check that its four lines sound right on top of each other.
# Durations are in sixteenths: a 6/8 bar is 12, a beat (dotted crotchet) is 6.
# python3 round.py          check it
# python3 round.py json     print it for the page
import json, sys
from itertools import combinations

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(p):
    if p is None: return None
    n, acc, octv = p[0], p[1:-1], int(p[-1])
    return 12 * (octv + 1) + NAMES[n] + {'': 0, 'b': -1, '#': 1}[acc]

# one chord per beat, the same eight beats under every line
CHORDS = ['F', 'F', 'Bb', 'F', 'Gm', 'C7', 'F', 'F']
TONES = {'F': {5, 9, 0}, 'Bb': {10, 2, 5}, 'Gm': {7, 10, 2}, 'C7': {0, 4, 7, 10}, 'Dm': {2, 5, 9}}

# (pitch, sixteenths, syllable); None pitch is a rest
LINES = [
    ('the washer', [
        ('C5', 6, 'Hot'), ('C5', 4, 'wa'), ('A4', 2, 'ter,'),
        ('D5', 6, 'hot'), ('C5', 2, 'wa'), ('A4', 2, 'ter'), ('C5', 2, 'and'),
        ('D5', 6, 'plen'), ('C5', 4, 'ty'), ('Bb4', 2, 'of'),
        ('A4', 12, 'soap,'),
    ]),
    ('the dryer', [
        ('A4', 2, 'dry'), ('G4', 2, 'it'), ('F4', 2, 'and'), ('A4', 2, 'dry'), ('G4', 2, 'it'), ('F4', 2, 'and'),
        ('Bb4', 2, 'dry'), ('A4', 2, 'it'), ('G4', 2, 'and'), ('F4', 2, 'dry'), ('G4', 2, 'it'), ('A4', 2, 'and'),
        ('Bb4', 2, 'tea'), ('A4', 2, 'tow'), ('G4', 2, "el's"), ('C5', 2, 'soak'), ('Bb4', 2, 'ing,'), ('G4', 2, 'and'),
        ('A4', 2, 'here'), ('G4', 2, 'comes'), ('F4', 2, 'an'), ('C5', 4, 'oth'), ('C5', 2, 'er:'),
    ]),
    ('the one who knows', [
        ('F4', 3, 'Plates'), ('G4', 1, 'in'), ('A4', 2, 'the'), ('C5', 3, 'rack'), ('Bb4', 1, 'and'), ('A4', 2, 'the'),
        ('D5', 3, 'cups'), ('C5', 1, 'on'), ('Bb4', 2, 'the'), ('A4', 3, 'hooks'), ('G4', 1, 'and'), ('F4', 2, 'the'),
        ('G4', 3, 'pans'), ('A4', 1, 'in'), ('Bb4', 2, 'the'), ('G4', 3, 'cup'), ('E4', 1, 'board'), ('D4', 2, 'be'),
        ('C4', 6, 'low.'), (None, 6, ''),
    ]),
    ('the one putting away', [
        ('C4', 2, 'Where'), ('D4', 2, 'does'), ('C4', 2, 'this'), ('F4', 6, 'go?'),
        ('D4', 2, 'Where'), ('E4', 2, 'does'), ('F4', 2, 'this'), ('A4', 6, 'go?'),
        ('Bb4', 2, 'No'), ('A4', 2, 'bod'), ('G4', 2, 'y'), ('E4', 6, 'knows'),
        ('F4', 4, 'where'), ('G4', 2, 'this'), ('F4', 6, 'goes.'),
    ]),
]

BAR, BEAT, LEN = 12, 6, 48
BAD = {1: 'm2', 2: 'M2', 6: 'tritone', 10: 'm7', 11: 'M7'}

def grid(notes):
    """pitch sounding at every sixteenth, and whether a note starts there"""
    out, t = [], 0
    for p, d, s in notes:
        for k in range(d): out.append((midi(p), k == 0))
        t += d
    assert t == LEN, f'{t} != {LEN}'
    return out

def check():
    grids = [grid(n) for _, n in LINES]
    problems = 0
    # each line against the chords on each beat
    for (name, notes), g in zip(LINES, grids):
        for b in range(8):
            p, _ = g[b * BEAT]
            if p is not None and p % 12 not in TONES[CHORDS[b]]:
                print(f'  {name}: beat {b+1} starts off the chord ({CHORDS[b]})')
                problems += 1
        ps = [m for m, _ in g if m is not None]
        print(f'{name:22s} range {min(ps)}-{max(ps)} ({max(ps)-min(ps)} semitones)')
    allp = [m for g in grids for m, _ in g if m is not None]
    print(f'whole round range {min(allp)}-{max(allp)} ({max(allp)-min(allp)} semitones)')
    # all four lines together, every sixteenth
    clashes = []
    for t in range(LEN):
        here = [(i, grids[i][t]) for i in range(4) if grids[i][t][0] is not None]
        for (i, (a, sa)), (j, (b, sb)) in combinations(here, 2):
            iv = abs(a - b) % 12
            if iv in BAD:
                strong = t % BEAT == 0
                # a clash matters more when both notes are long, or it lands on a beat
                clashes.append((t, i, j, BAD[iv], strong))
    for t, i, j, iv, strong in clashes:
        bar, pos = divmod(t, BAR)
        print(f'  {"STRONG " if strong else "       "}bar {bar+1} +{pos:2d}/16: {LINES[i][0]} vs {LINES[j][0]}: {iv}')
    print(f'{sum(c[4] for c in clashes)} clashes on beats, {len(clashes)} in all, {problems} off-chord beats')
    # how often voices land in unison (they vanish into each other)
    uni = sum(1 for t in range(LEN) for (a, b) in combinations([g[t][0] for g in grids], 2) if a is not None and a == b)
    print(f'{uni} sixteenth-pairs in unison')

if __name__ == '__main__':
    if sys.argv[1:] == ['json']:
        print(json.dumps([{'who': w, 'notes': [[midi(p), d, s] for p, d, s in n]} for w, n in LINES]))
    else:
        check()
