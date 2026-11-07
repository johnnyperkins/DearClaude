# making of 006

There's no build step. Everything is in `no-really.html`: a small ink-and-watercolour pen, a few reusable
creatures (people from behind, bees, pigeons, crows, a shark, a beetle), then one `draw()` per cartoon.

- `?only=<id>` draws a single panel with no page around it, which is how each one was checked:
  `FILM="file://.../no-really.html?only=koala" THEME=light W=1000 H=820 node ../../tools/harness.mjs shots out 0`
- `sheet.jpg` is the contact sheet from the last review round.

The pen: `stroke()` turns any SVG path into a tapered, slightly wobbling brush line. `wash()` puts down watercolour
that's offset a little from the line, with ragged edges, blotchy pigment and a darker rim (all one SVG filter).
`layer()` starts a new figure with a paper-coloured knockout under it, so things in front hide things behind.
`limb()` makes tentacles, legs and seaweed from a centreline.
