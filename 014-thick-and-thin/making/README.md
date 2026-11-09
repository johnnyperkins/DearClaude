# making 014

The typeface is never drawn as outlines. Each glyph in `glyphs.py` is a list of strokes: the path the centre of a broad nib takes, in the order a scribe would take it. Everything else is made from that.

- `glyphs.py` is the hand. Paths use M, L, C and Q, plus a few helpers: `hook()` (entry serif), `foot()` (the turn at the bottom of a stem), `arch()`, `dot()`, `mirror()` and `turn()`. A stroke can hold the pen at its own angle (`{'angle': 42}` for v and w, 0 for the Z diagonal, the slash and the acute) or turn it as it goes (`{'to': 70}` tapers the ! and the quotes). The y coordinates say where the ink's edge lands, not where the nib's centre goes. `nib.zone()` converts, so the same skeleton lines up with the x-height and baseline at any nib width. `sides` gives the spacing: 'S' and 'R' are measured from the middle band of the glyph, so serifs and tails can overhang, and numbers are measured from the outermost ink. It also holds the kerning (in classes; accented letters inherit their base letter's) and the accent table.
- `nib.py` is the pen: a 92 by 20 unit rectangle with its corners slightly rounded, held at 30 degrees. `ink()` samples each stroke every 3 units, takes the convex hull of the nib at each pair of neighbouring samples, and unions them with shapely.
- `fit.py` turns the dense swept outline into cubic Beziers (Schneider's algorithm from Graphics Gems). It resamples first, so the error check sees long straight runs too.
- `build.py` runs it all: sweep, `soften()` (a small closing and opening, as ink spreads into inside corners and wears off outside ones), fit, space, accents, kerning, then `Dear-Regular.otf`, `.woff2` and `skeleton.json`, the strokes the page writes with.
- `page.html` is the page with two holes in it. `assemble.py` builds the font into the entry folder and fills them with the woff2 (as a data URL, because Chromium won't load a font from file://) and the skeleton.
- `proof.py` renders proof sheets with PIL, which shapes text with HarfBuzz (raqm), so kerning shows.
- `thumb.py` makes the index card, with the last stroke half written.
- `uitest.mjs` uses the page like a person on a desktop and a phone: it types, deletes and retypes, turns the pen, draws with a mouse and a finger, taps letters, and checks the slow stroke-by-stroke writing ends up pixel for pixel the same as writing it all at once.

To rebuild: make a venv in the scratchpad with `fonttools brotli shapely pillow numpy` (and `uharfbuzz` if you want to shape text yourself), then `python assemble.py`.

## the pen, for reuse

The page's script has everything needed to write with this hand anywhere: `glyph(name, nib, step)` gives a glyph's strokes as sampled points for any nib, `lineUp()` sets text with kerning and word wrap, `ink()` fills a stroke (or part of one) on a canvas as a single path, so there are no seams, and the `Sheet` class animates jobs stroke by stroke with the nib drawn where it is. Change the angle or the width and the whole hand changes with it.
