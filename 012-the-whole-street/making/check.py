# Checks the ten sonnets in the page so that any line can stand in for its neighbours.
# Run with a Python that has `pronouncing` (the CMU dictionary): python check.py [../the-whole-street.html]
#
# What it checks:
#   - 10 houses, 14 lines each, odd lines end with a comma, even lines with a full stop
#   - even lines begin lowercase with a joining word, so they follow any odd line
#   - syllables per line (10 wanted) and the stress shape, for reading by eye
#   - rhyme: lines 1/3, 2/4, 5/7, 6/8, 9/11, 10/12, 13/14 rhyme across all houses
#   - two slots that rhyme with each other never share an end word or an identical rhyme
#     (so no mix can rhyme 'call' with 'recall'); repeats inside one slot are listed too
import re
import sys
from collections import defaultdict

import pronouncing as P

EXTRA = {  # words the dictionary lacks or says in an American way
    'sleepyhead': 'S L IY1 P IY0 HH EH2 D', 'windowpane': 'W IH1 N D OW0 P EY2 N',
    'kielder': 'K IY1 L D ER0', 'auckland': 'AO1 K L AH0 N D', 'scratchcard': 'S K R AE1 CH K AA2 R D',
    'checkouts': 'CH EH1 K AW2 T S', 'wi-fi': 'W AY1 F AY2', 'orange-grey': 'AO1 R AH0 N JH G R EY1',
    'forty-minute': 'F AO1 R T IY0 M IH1 N AH0 T', 'self-checkouts': 'S EH1 L F CH EH1 K AW2 T S',
    'tesco': 'T EH1 S K OW0', 'kielder\'s': 'K IY1 L D ER0 Z', 'firth': 'F ER1 TH', 'colic': 'K AA1 L IH0 K', "tesco's": 'T EH1 S K OW0 Z', 'shane': 'SH EY1 N', 'flo': 'F L OW1',
    "there'll": 'DH EH1 R L', "streetlamps": 'S T R IY1 T L AE2 M P S', 'nepal': 'N AH0 P AO1 L',
    "trumpet's": 'T R AH1 M P AH0 T S', "friday's": 'F R AY1 D EY0 Z', "dad's": 'D AE1 D Z',
    "sky's": 'S K AY1 Z', "street's": 'S T R IY1 T S', "shift's": 'SH IH1 F T S',
    "door's": 'D AO1 R Z', "baby's": 'B EY1 B IY0 Z', "tomorrow's": 'T AH0 M AA1 R OW0 Z',
    "kettle": 'K EH1 T AH0 L', 'hazards': 'HH AE1 Z ER0 D Z', "mum": 'M AH1 M',
    "she's": 'SH IY1 Z', 'every': 'EH1 V R IY0', 'hour': 'AW1 R', 'again': 'AH0 G EY1 N',
    'rounders': 'R AW1 N D ER0 Z', 'letterbox': 'L EH1 T ER0 B AA2 K S', 'pall': 'P AO1 L',
    'here': 'HH IH1 R', 'ear': 'IH1 R', 'hear': 'HH IH1 R', 'mid-label': 'M IH1 D L EY1 B AH0 L', "here's": 'HH IH1 R Z', "that's": 'DH AE1 T S', "it's": 'IH1 T S',
}
CONSONANT_START = re.compile(r'^[^AEIOU]+')
JOINERS = {'and', 'while', 'as', 'with', 'till', 'so'}
ONSETS = {a + ' ' + b for a in 'P B T D K G F TH SH'.split() for b in 'R L W'.split()} | {
    'S P', 'S T', 'S K', 'S F', 'S M', 'S N', 'S L', 'S W', 'S P R', 'S T R', 'S K R', 'S P L', 'S K W', 'SH R'}
PAIRS = [(1, 3), (2, 4), (5, 7), (6, 8), (9, 11), (10, 12), (13, 14)]


def phones(word):
    w = word.lower().strip(".,;:!?'\"")
    if w in EXTRA:
        return EXTRA[w].split()
    p = P.phones_for_word(w)
    if p:
        return p[0].split()
    if '-' in w:
        out = []
        for part in w.split('-'):
            q = phones(part)
            if q is None:
                return None
            out += q
        return out
    return None


def stresses(line):
    shape, missing = '', []
    for word in re.findall(r"[A-Za-z][A-Za-z'\-]*", line):
        ph = phones(word)
        if ph is None:
            missing.append(word)
            continue
        s = ''.join(c for c in ''.join(ph) if c.isdigit())
        # one-syllable words carry whatever stress the line gives them
        shape += '.' if len(s) == 1 else s.replace('2', '1').replace('1', '/').replace('0', 'x')
    return shape, missing


def rhyme_key(word):
    ph = phones(word)
    if not ph:
        return None, None
    last = max(i for i, p in enumerate(ph) if p[-1] in '12' or (len(ph) == 1))
    # take the last primary or secondary stressed vowel
    idx = max(i for i, p in enumerate(ph) if p[-1] in '12') if any(p[-1] in '12' for p in ph) else last
    rime = ' '.join(re.sub(r'\d', '', p) for p in ph[idx:])
    cons = []
    j = idx - 1
    while j >= 0 and ph[j][-1] not in '012':
        cons.insert(0, ph[j]); j -= 1
    onset = ''
    for k in range(len(cons)):
        cand = ' '.join(cons[k:])
        if len(cons) - k == 1 or cand in ONSETS:
            onset = cand
            break
    return rime, onset


def end_word(line):
    return re.findall(r"[A-Za-z][A-Za-z'\-]*", line)[-1].lower()


def load(path):
    text = open(path, encoding='utf-8').read()
    if path.endswith('.html'):  # the sonnets live in the page, in <script type="text/plain" id="poems">
        text = text.split('id="poems">', 1)[1].split('</script>', 1)[0]
    houses, cur = [], None
    for raw in text.splitlines():
        line = raw.rstrip('\n')
        if line.startswith('#'):
            num, who = line[1:].split('|')
            cur = {'num': int(num), 'who': who.strip(), 'lines': []}
            houses.append(cur)
        elif line.strip():
            cur['lines'].append(line.strip())
    return houses


def main():
    houses = load(sys.argv[1] if len(sys.argv) > 1 else '../the-whole-street.html')
    problems = []
    assert len(houses) == 10, len(houses)
    for h in houses:
        if len(h['lines']) != 14:
            problems.append(f"house {h['num']}: {len(h['lines'])} lines")
    print('syllables and stress (x weak, / strong, . one-syllable word)\n')
    for h in houses:
        print(f"-- {h['num']} {h['who']}")
        for i, line in enumerate(h['lines'], 1):
            shape, missing = stresses(line)
            n = len(shape)
            flag = '' if n == 10 else f'  <-- {n} syllables'
            if missing:
                flag += f'  ?? {missing}'
            print(f'{i:>3} {shape:<13} {line}{flag}')
            if n != 10 and not missing:
                problems.append(f"{h['num']}.{i}: {n} syllables")
            if missing:
                problems.append(f"{h['num']}.{i}: unknown {missing}")
            if i % 2 and not line.endswith(','):
                problems.append(f"{h['num']}.{i}: odd line should end with a comma")
            if i % 2 == 0:
                if not line.endswith(('.', '?')):
                    problems.append(f"{h['num']}.{i}: even line should end with a full stop")
                first = line.split()[0]
                if first not in JOINERS:
                    problems.append(f"{h['num']}.{i}: even line starts with '{first}'")
        print()

    # rhyme across the whole street
    slot_words = defaultdict(list)
    for h in houses:
        for i, line in enumerate(h['lines'], 1):
            slot_words[i].append((end_word(line), h['num']))
    for a, b in PAIRS:
        keys = defaultdict(list)
        for s in (a, b):
            for w, num in slot_words[s]:
                rime, onset = rhyme_key(w)
                keys[rime].append((s, w, num, onset))
        if len(keys) != 1:
            problems.append(f'lines {a}/{b} do not all rhyme: ' + '; '.join(
                f"{k}: {[x[1] for x in v]}" for k, v in keys.items()))
        allw = [x for v in keys.values() for x in v]
        for x in allw:
            for y in allw:
                if x[0] == a and y[0] == b:
                    if x[1] == y[1]:
                        problems.append(f"lines {a}/{b}: '{x[1]}' ends both ({x[2]}.{a}, {y[2]}.{b})")
                    elif x[3] == y[3] and rhyme_key(x[1])[0] == rhyme_key(y[1])[0]:
                        problems.append(f"lines {a}/{b}: identical rhyme '{x[1]}'/'{y[1]}' ({x[2]}.{a}, {y[2]}.{b})")
    repeats = []
    for s in range(1, 15):
        seen = defaultdict(list)
        for w, num in slot_words[s]:
            seen[rhyme_key(w)].append(f'{w}({num})')
        for k, v in seen.items():
            if len(v) > 1:
                repeats.append(f'line {s}: ' + ', '.join(v))
    print('end words by line:')
    for s in range(1, 15):
        print(f'{s:>3}', ' '.join(w for w, _ in slot_words[s]))
    print('\nsame rhyme twice in one line slot (allowed, never meet):')
    print('\n'.join('  ' + r for r in repeats) or '  none')
    print('\nproblems:')
    print('\n'.join('  ' + p for p in problems) or '  none')


main()
