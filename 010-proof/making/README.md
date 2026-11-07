# making proof

`proof.js` is the whole game: world, parser and rules. It has no dependencies and runs both in the page (`window.Proof`) and in node (`module.exports`), so the same game can be played from a terminal and tested without a browser.

## the pieces

- **State** is one plain JSON object (`fresh()`), so undo and saving are just `JSON.stringify`. Everything dynamic lives in it: where each object is (`s.where[id]` is a room, `'inv'`, `'in:<id>'` or `'on:<id>'`), the clock in minutes after midnight, the oven, the dough, Gerald.
- **Objects** (`OBJ`) are static: names, the words that can refer to them, and descriptions that are functions of the state. `cont` and `surf` mark things that hold things in or on them, `closable` marks cupboards and doors, `see` means you can see in when it's shut (the oven's glass door).
- **The parser** is a list of regexes (`RX`) tried in order. Order matters: `look in X` has to come before `look X`. Noun phrases go through `resolve()`, which matches every word of the phrase against an object's words, keeps the ones in scope, and asks "Which do you mean" only when priorities can't break a tie. A thing in a shut cupboard in the same room gets the cupboard opened for you.
- **Several commands** can go in one line, split on `then`, full stops, semicolons, and `and` when a verb follows it (`take torch and turn it on`). `take X and Y` takes both.
- **Time** only moves for actions, one minute by default. Looking, examining and inventory are free. `tick()` runs once a minute: the oven heats at 4 degrees a minute (an hour to 250), the bakehouse warms as the oven does, dough rises at a rate set by the temperature of wherever it is, things in the oven collect "bake" in proportion to the oven's temperature, and the village wakes up on schedule (the shipping forecast at 5:20 is real). Waits stop early when something worth knowing happens.

## the bread

The numbers are simple on purpose:

- Rising: `(T - 4) / 1380` per minute for the bulk, so 28 degrees in the airing cupboard doubles it in about an hour, the cold bakehouse takes two, and the fridge stops it. Rolls prove at `(T - 4) / 1035`. Yeast scales the rate; no salt speeds it up and leaves them bland.
- Baking: loaves gain `temp / 250` a minute and are right between 36 and 47 (about forty minutes at 250), "well fired" up to 55, then burnt. Rolls gain `temp / 220` and are right between 11 and 19.
- The steam counts if water hits stones that are over 180 degrees as the loaves go in: in the same move if the jug is full, or the very next one.

## files

- `play.mjs`: play one move per call, with the game kept in a save file. This is how the cold playtesters played it.
- `run.mjs`: run a file of commands and print the transcript. `walk.txt` and `walk2.txt` are full 10/10 walkthroughs, the second in a newcomer's words (spoilers, obviously). `odd.txt` and `t1.txt` to `t8.txt` are strange or newcomer-ish phrasings, most of them things a playtester typed that didn't work at first.
- `uitest.mjs`: types into the real page in headless Chromium: Enter, arrow-up history, saving across a reload, undo, restart, the morning at the end, and a phone layout.
