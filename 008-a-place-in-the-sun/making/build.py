# Copies engine.js into the page's <script id="engine"> block, so the page stays one file
# and the worker can be made from the same source. Run after editing engine.js.
import re, pathlib
here = pathlib.Path(__file__).resolve().parent.parent
page = here / 'a-place-in-the-sun.html'
eng = (here / 'making' / 'engine.js').read_text()
html = page.read_text()
html, k = re.subn(r'(<script id="engine">\n).*?(</script>)', lambda m: m.group(1) + eng + m.group(2), html, flags=re.S)
assert k == 1
page.write_text(html)
print('engine inlined,', len(eng), 'bytes')
