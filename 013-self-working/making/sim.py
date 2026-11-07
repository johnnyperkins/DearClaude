"""Check both tricks' mathematics with random play, and see which human slips break them.
Act 1 (Hummer's turn-two principle): a row of N cards alternating down/up, one card turned, gathered,
mixed by cuts, turn-top-two and turn-the-packet-over, then dealt into two piles, left and right, with the right-hand pile turned over.
Act 2 (Gilbreath): a deck sorted by suit, ace to king, cut, part dealt into a pile one at a time,
riffled once, dealt into four hands of thirteen."""
import random, sys

def act1(n=10, moves=40, slip=None, rng=random):
    # card = [id, up]; packet index 0 = top
    row = [[i, i % 2 == 1] for i in range(n)]          # alternate: first down, second up, ...
    pick = rng.randrange(n)
    row[pick][1] = not row[pick][1]
    if slip == 'gather-scramble':
        rng.shuffle(row)
    packet = row[::-1] if rng.random() < .5 else row[:]  # gather either direction
    for _ in range(moves):
        m = rng.choice('CCTTF')
        if m == 'C':
            k = rng.randrange(1, n); packet = packet[k:] + packet[:k]
        elif m == 'T':
            if slip == 'flip-separately':
                packet[0][1] ^= True; packet[1][1] ^= True
            else:
                a, b = packet[0], packet[1]; a[1] ^= True; b[1] ^= True; packet[0], packet[1] = b, a
        elif m == 'F':
            packet = [[c, not u] for c, u in reversed(packet)]
        if slip == 'turn-three' and rng.random() < .05:
            top = [[c, not u] for c, u in reversed(packet[:3])]; packet = top + packet[3:]
    # deal into two piles, left, right, left, right; turn the right-hand pile over; spread both
    left, right = [], []
    for i, card in enumerate(packet):
        (right if i % 2 else left).insert(0, card)
    right = [[c, not u] for c, u in reversed(right)]
    out = left + right
    ups = [c for c, u in out if u]; downs = [c for c, u in out if not u]
    odd = ups if len(ups) == 1 else downs if len(downs) == 1 else None
    return odd == [pick]

def act2(slip=None, rng=random):
    deck = [(s, v) for s in range(4) for v in range(13)]   # top first
    if slip == 'one-suit-reversed':
        deck = deck[:13] + deck[13:26][::-1] + deck[26:]
    for _ in range(rng.randrange(0, 6)):
        k = rng.randrange(1, 52); deck = deck[k:] + deck[:k]
    d = rng.randrange(1, 52)
    if slip == 'deal-in-clumps':
        pile, rest = [], deck[d:]
        src = deck[:d]
        while src:
            k = rng.choice([1, 2, 3]); pile = src[:k] + pile; src = src[k:]
    else:
        pile, rest = deck[:d][::-1], deck[d:]
    merged = []
    a, b = rest, pile
    while a or b:     # a riffle: any interleaving, in clumps
        take_a = (rng.random() < len(a) / (len(a) + len(b)))
        src = a if take_a else b
        k = min(len(src), rng.choice([1, 1, 1, 2, 2, 3]))
        merged += src[:k]; del src[:k]
    if slip == 'table-merge':      # dealt from the two tops into a new pile: reversed
        merged = merged[::-1]
    if slip == 'cut-after':
        k = rng.randrange(1, 52); merged = merged[k:] + merged[:k]
    if slip == 'second-riffle':
        h = 26; x, y = merged[:h], merged[h:]; m2 = []
        while x or y:
            src = x if (rng.random() < len(x) / (len(x) + len(y))) else y
            m2.append(src.pop(0))
        merged = m2
    hands = [merged[13*i:13*i+13] for i in range(4)]
    return all(sorted(v for s, v in h) == list(range(13)) for h in hands)

if __name__ == '__main__':
    T = 20000
    for slip in [None, 'gather-scramble', 'flip-separately', 'turn-three']:
        for n in [10, 9]:
            ok = sum(act1(n, slip=slip) for _ in range(T))
            print(f'act1 n={n:2} slip={slip!s:16} works {ok/T:.1%}')
    for slip in [None, 'table-merge', 'one-suit-reversed', 'deal-in-clumps', 'cut-after', 'second-riffle']:
        ok = sum(act2(slip) for _ in range(T))
        print(f'act2 slip={slip!s:18} works {ok/T:.1%}')
