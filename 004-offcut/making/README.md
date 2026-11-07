# how 004 was made

The page, `../offcut.html`, is built. Run `python3 export.py` if the simulation changes, then `python3 build.py`, which inlines `art.js` and `data.json` into `template.html`.

- `sim.py` is the flexagon. States are pat trees of signed leaf ids (Flexagonator's notation, github.com/loki3/flexagonator), and the pinch flex is Flexagonator's pattern for six pats. Every state is also checked against geometry: `place_all` walks the paper strip hinge by hinge and fails if any hinge lands somewhere the pats say it can't. All 72 reachable states pass. Its hexagon frame is the mirror image of the page's.
- `fold.py` folds the flat strip by hand, in simulation. The sequence in `export.py` does this: hide the eight dark pairs, fold over at hinges 3, 9 and 15, and tuck triangle 18 under triangle 1 with the tab between. It ends exactly at the flexagon's start state, and the tab lands corner to corner on triangle 1. The simple layer model always puts a folded flap on top, so the final tuck is done by hand in the code.
- `export.py` writes `data.json`: the 18 states up to rotation, each one's top view, where every flex and turn-over leads, and snapshots of the folding steps for the diagrams. It also asserts the kaleidoscope property (below) for every state.
- `art.js` draws each face once, in one triangle. The printed page, the diagrams and the virtual flexagon all place that triangle by its three corner classes.
- `sandbox.html` shows the 15 ideal windows side by side, for working on the art.

The kaleidoscope property: hinges reflect one triangle into the next, so if each leaf's corners are given classes 0, 1 and 2 correctly, every view is a hexagonal window onto a wallpaper with *333 symmetry. For the garden, sky and shore, every leaf gets the same classes. For each hidden face, half the leaves get their classes rotated one step (`classes()` in `export.py`). The window's centre is then class 0, 1 or 2 for the three light faces. Each dark face only ever centres on two of its classes.

Printing: the harness can't print, so `chromium --headless=new --user-data-dir=... --no-pdf-header-footer --print-to-pdf=out.pdf file://...` does it. Then `pdftoppm` turns it into images.
