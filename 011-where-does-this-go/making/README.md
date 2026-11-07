# making of 011

There's no build step. Everything is in `where-does-this-go.html`: the round as data, a small music engraver,
four formant singers, a sink, and the header drawing made with 006's pen.

- `round.py` is where the tune was written. It holds the four lines and the eight chords under them, and
  checks every beat of every line against the chord and every pair of lines against each other.
  `python3 round.py` prints the clashes, the ranges and how often two voices land in unison. The page has
  its own copy of the notes (with syllables and sounds), so change both.
- `glyphs.py` pulls the clef, flat, rests, noteheads, flags and fermata out of Noto Music (SIL Open Font
  License) as SVG paths. It needs fontTools, which isn't installed here: use a throwaway venv in the scratchpad.
  The result is pasted into the page as `GLYPHS`. In Noto Music one staff space is 250 font units and the
  baseline of the clef and rests is the bottom staff line.
- `uitest.mjs` presses Sing, waits for the count-in, checks which singer is doing what, takes parts, drops
  singers, and does it all again on a phone.

The engraver: `engrave()` lays out each system by finding one scale for note lengths that fills the line
while every lyric still clears its neighbour, and shrinks the lyrics a little if they can't. On screens under
540px it puts two bars on a system instead of four. Before printing it lays out at full width again.

The singers: a glottal-pulse PeriodicWave through three bandpass formant filters, with breath noise, a
vibrato that grows on long notes, and consonants as puffs of filtered noise (one fixed filter per kind).
`?voices=1&times=1&sink=0` with `harness.mjs audio` renders one singer alone.
`window.__showAt(seconds)` draws the cursors at any moment without sound, for stills.
