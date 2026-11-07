# Find anagram fodder: pairs (and word+short bits) of common words that use exactly the answer's letters.
import sys, re
from collections import Counter
common = set(w.strip().lower() for w in open('/usr/share/dict/cracklib-small', errors='ignore'))
am = set(w.strip() for w in open('/usr/share/dict/american-english', errors='ignore'))
words = [w for w in am if re.fullmatch(r'[a-z]{2,12}', w) and w in common]
bits = ['a','i','o','e','u','s','t','n','r','l','c','d','h','m','p','k','b','g','f','w','y','v','x','z',
        'on','in','at','it','to','no','so','up','us','me','he','we','an','or','as','is','be','do','go','my','by',
        'ok','re','ex','oh','ah','ha','hi','lo','ta','te','ti','la','mi','do','ma','pa','al','ed','ted','ian','sid']
def key(s): return ''.join(sorted(s))
by = {}
for w in words:
    by.setdefault(key(w), []).append(w)
ans = sys.argv[1].lower()
A = Counter(ans)
out = set()
for w in words:
    c = Counter(w)
    if w == ans or any(c[k] > A[k] for k in c):
        continue
    rest = A - c
    rs = ''.join(sorted(rest.elements()))
    if not rs:
        out.add(w)
        continue
    for v in by.get(rs, []):
        if v != ans:
            out.add(' + '.join(sorted([w, v])))
    for b in bits:
        if key(b) == rs:
            out.add(f'{w} + {b}')
print(len(out))
print('; '.join(sorted(out, key=lambda s: (s.count('+'), -min(len(p) for p in s.split(' + '))))[:400]))
