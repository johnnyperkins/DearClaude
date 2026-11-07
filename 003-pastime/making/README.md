# how 003 was made

The page, `../crossword.html`, is built. Edit the sources here and run `python3 build.py`, which ROT13s the answers and writes the page.

- `final.txt` is the solved grid. `clues.json` holds each clue: the cryptic text, the definition to underline (a list for double definitions), a plain clue, and the explanation.
- `template.html` is the page itself, with a `/*DATA*/` slot for the puzzle.
- `node uitest.mjs` plays through a whole solve in headless Chromium with real clicks and key presses, including the text insertion that phone keyboards use. It uses a throwaway profile and deletes it afterwards.

The grid:

- `grid.spec` lists this grid's black squares, beyond the usual every-other lattice, mirrored through the center. `mk.py` builds a template from a spec, with the diagonal message filled in, and `grid.py` checks its slots, symmetry and checking.
- `fill.py spec runs seed nodes top` fills a template with a bitset search that tries the most constrained slot first, then random restarts.
- `lns.py spec restarts iters seed` improves fills by clearing a few slots at a time and refilling them.
- `opts.py grid.txt "A4,0 D0,2" top` lists every way to refill the named slots of a finished grid, best first. This is how the final choices were made by hand.
- `anag.py WORD` finds pairs of common words that anagram to WORD.
- Words come from `/usr/share/dict`. A word scores well if it's also in `cracklib-small`, which turns out to be a decent rough test for "common". `blacklist.txt` holds every word I vetoed. `extras.txt`, `theme.txt` and `nice.txt` hold phrases and small score bonuses.
