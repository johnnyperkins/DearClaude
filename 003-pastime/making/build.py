# Build the finished page from template.html + clues.json + final.txt.
import json, codecs, os
here = os.path.dirname(os.path.abspath(__file__))
path = lambda name: os.path.join(here, name)
rot = lambda s: codecs.encode(s, 'rot13')
rows = [l.replace(' ', '').strip() for l in open(path('final.txt')) if l.strip()]
data = json.load(open(path('clues.json')))
for d in data.values():
    for k in d:
        k['ans'] = rot(k['ans'])
        k['why'] = rot(k['why'])
js = 'const SOLUTION = ' + json.dumps([rot(r) for r in rows]) + ';\n'
js += 'const CLUES = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n'
html = open(path('template.html')).read().replace('/*DATA*/', js)
assert chr(0x2014) not in html, 'no em dashes'
open(path('../crossword.html'), 'w').write(html)
print('wrote crossword.html', len(html))
