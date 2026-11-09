# Build the font into the entry folder and write the page with the font and the strokes inside it.
# python assemble.py
import base64, json, os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
entry = os.path.dirname(here)
subprocess.run([sys.executable, os.path.join(here, 'build.py'), entry], check=True)
font = base64.b64encode(open(os.path.join(entry, 'Dear-Regular.woff2'), 'rb').read()).decode()
data = open(os.path.join(entry, 'skeleton.json')).read()
page = open(os.path.join(here, 'page.html')).read()
assert '__FONT__' in page and '/*DATA*/null' in page
page = page.replace('__FONT__', font).replace('/*DATA*/null', data)
out = os.path.join(entry, 'thick-and-thin.html')
open(out, 'w').write(page)
print(out, len(page) // 1024, 'KB')
