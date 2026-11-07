"""Build ../offcut.html from template.html, art.js and data.json (run export.py first if the simulation changed)."""
import json, re
art = open('art.js').read()
art = art[:art.index("if (typeof module")]
data = json.dumps(json.load(open('data.json')), separators=(',', ':'))
page = open('template.html').read().replace('/*ART*/', art).replace('/*DATA*/', data)
assert '—' not in page, 'em dash'
open('../offcut.html', 'w').write(page)
print('wrote ../offcut.html', len(page), 'bytes')
