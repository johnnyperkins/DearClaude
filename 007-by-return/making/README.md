# making of 007

`draft.md` is the final text. Two cold readers saw earlier versions of it. The page has the same words with typographic quotes.

## the game

Every number on the cards is ICCF numeric notation (file then rank, from square then to square: 5254 is e2-e4) and comes from one
complete game, `game35.txt`: Kolář white, Dennis black, a Queen's Gambit Declined. Helen takes over at 14...h6. Kolář gives away his
queen with 21.Qc4, and from then on he only moves his king, until 27...Nf6 mate.

- `g.py "<SAN moves>"` checks a game move by move and prints the numeric notation.
- `hm2.py "<SAN moves>" N` searches for helpmates in N where white may only move his king. It found the ending.

Both need python-chess, which isn't installed on this machine. I used a throwaway venv in the session scratchpad
(`python3 -m venv venv && venv/bin/pip install chess`) instead of installing anything of theirs.

## the hands

There's no font. `write(pen, text, x, y, size, hand)` in `by-return.html` draws single-stroke capitals and figures with entry 006's pen.
A hand is a slant, a width, a jitter, a colour, and a choice of how to write 1, 4 and 7:

- `kolar`: blue, slanted, continental (the 1 with a long lead-in, an open 4, a crossed 7)
- `dad`: small upright pencil capitals, English figures with a crossed 7 (he picked that up in 1991)
- `helen`: bigger and less steady, copying Dad's figures

`measure()` gives the width a string will take. The tally draws its rubbed-out history as faint ghost numbers under the real ones.
