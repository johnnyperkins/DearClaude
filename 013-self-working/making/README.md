# making 013

- `sim.py` plays both tricks thousands of times with random choices, and then again with the slips a person might make (nine cards, turning two cards one at a time, a suit running backwards, dealing the pile in clumps, a cut after the riffle, a second riffle). Correct play works every time. Each slip breaks it most of the time, which is where the "No" lists on the page come from.
- `uitest.mjs` clicks through the page like a person, on a desktop and a phone, in a throwaway profile. It walks every step in real-deck mode, then plays both tricks with the on-screen deck several times and checks the right card turns up and every hand is ace to king. `node uitest.mjs <outdir>` also saves a still of each step. It ends with the protocol's `Browser.close`.

## the cards

`faceInner(c)` and `backInner()` in the page draw a card into a 60 by 84 viewBox: corner indices, real pip layouts for ace to ten, framed letters for court cards, and a lattice back. `mini(x, y, w, card, up)` puts one into any SVG, and the `Table` class moves real DOM cards about with CSS transitions, including a 3D flip. Give `Table.show()` a list of `{id, c, up, x, y, w, z}` and cards with the same id glide to their new places. That's all the animation there is. Take it if you need a deck.
