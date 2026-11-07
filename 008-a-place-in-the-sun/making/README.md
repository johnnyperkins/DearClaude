# making of 008

`engine.js` is the whole game: the rules, the sun, a table of first coins, and Claude's player (Monte Carlo tree
search with random playouts). The page carries a copy of it inline, so it stays one file and the worker Claude thinks
in can be made from the same text. After editing `engine.js`, run `python3 build.py` to copy it into the page.

- `selfplay.mjs n games itersA [itersB]` plays the engine against itself on an n by n board, in seven worker threads.
  It prints how often Heads wins between equal players and, if you give `itersB`, how often the player that thinks
  more wins. `TUNE='{"start":s,"every":e,"phase":p}'` changes where the sun starts, how many turns it waits, and
  whether it moves after Tails (phase 0) or after Heads (phase 1, the real rule).
- `openings.mjs games iters` finishes the game from every possible first coin and prints Heads' win rate for each.
  Its output is `openings.json`, which is pasted into `engine.js` as `OPENING`.
- `tuning.txt` has the balance numbers the next section talks about.
- `edges.mjs games iters` counts where strong players put their coins: on the edge or in the middle.
- `play.mjs` plays Claude from a terminal, one move per command. The two cold playtesters used it.
- `uitest.mjs` plays the page like a person with mouse, keys and a touchscreen, in a throwaway Chromium profile.

## how the rules were chosen

A tournament of rule sets on one engine, scored by self-play (equal players for balance, a 10 to 1 thinking
advantage for depth, and how often the lead changed hands):

- A hexagonal board where most coins wins: every flipping rule either handed the game to one player or drew
  four games in ten.
- Hex's board and goal, where the new coin's shadow turns over one coin: no draws possible, about sixteen flips
  a game, the lead changing hands several times, and more thinking winning about 90% of the time. That's the game.

Balance took longer. With the sun moving after Tails, Tails won 61% between strong players, whichever way the sun
started (twelve settings tried, then the two best again with 350 games each: both 39% for Heads). The cause was who
plays second under each sun: they can answer a coin in the same light and turn it straight over. Moving the sun after
Heads gave the edge to Heads instead (60%). Moving it after every turn still left Tails at 58%. So the edge
stays, and the first coin pays for it: one player puts it down and the other chooses a side, as in Hex's swap rule.
The first playtester, who had only seen the old rules, suggested the same thing without being asked.

`OPENING` is 30 strong games from each first coin, so each number is good to about ±0.09. Claude cuts somewhere among
the six closest to even, and takes Heads when the table says Heads wins more than half the time.
