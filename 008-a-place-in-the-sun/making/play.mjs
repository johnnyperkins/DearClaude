// Play against the page's Claude from a terminal, one move per command, so a cold reader can try the game.
//   node play.mjs new [easy|fair|hard] [cut|choose]      start a game (state kept in $PLAY_STATE or ./game.json).
//                                                          cut: you put down the first coin and Claude picks a side.
//                                                          choose: Claude puts it down, then you pick with `side`.
//   node play.mjs side heads|tails                         pick your side after Claude's first coin
//   node play.mjs move d4                                  put your coin on d4; Claude answers
//   node play.mjs show                                     show the board again
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./engine.js', import.meta.url), 'utf8');
new Function(src)();
const S = globalThis.Shade, n = 7, B = S.board(n);
const FILE = process.env.PLAY_STATE || 'game.json';
const LEVEL = { easy: { iters: 500 }, fair: { iters: 6000 }, hard: { iters: 300000 } };
const DIR = ['east', 'northeast', 'northwest', 'west', 'southwest', 'southeast'];
const name = i => 'abcdefg'[i % n] + (((i / n) | 0) + 1);
const parse = m => { const q = 'abcdefg'.indexOf(m[0]), r = +m.slice(1) - 1; return q >= 0 && r >= 0 && r < n ? r * n + q : -1; };

function draw(s, last, flipped) {
  const out = ['      ' + 'a b c d e f g'.split(' ').map(c => c.padEnd(2)).join('') + '   (Heads joins top and bottom, Tails left and right)'];
  for (let r = 0; r < n; r++) {
    let line = ' '.repeat(r) + String(r + 1).padStart(2) + '   ';
    for (let q = 0; q < n; q++) {
      const i = r * n + q, ch = '.HT'[s.b[i]];
      line += ch + (i === last ? '*' : i === flipped ? '!' : ' ');
    }
    out.push(line + '  ' + (r + 1));
  }
  out.push(' '.repeat(n) + '      ' + 'a b c d e f g'.split(' ').map(c => c.padEnd(2)).join(''));
  out.push('(* marks the last coin put down, ! a coin that was just turned over.)');
  const k = S.roundOf(s.ply);
  if (!s.winner) out.push(`The sun is in the ${DIR[S.sunDir(k)]}, so shadows fall ${DIR[S.shadowDir(k)]}. ` +
    (s.ply & 1 ? 'It moves on after Heads has played. ' : 'It moves on after this turn. ') +
    `Next it goes ${DIR[S.sunDir(k + 1)]}, and shadows will fall ${DIR[S.shadowDir(k + 1)]}.`);
  return out.join('\n');
}
const load = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const save = g => fs.writeFileSync(FILE, JSON.stringify(g));
function state(g) { const s = S.start(B); let f = -1; for (const c of g.moves) f = S.play(B, s, c); return { s, f }; }
function claude(g) {
  const { s } = state(g);
  const r = S.think(B, s, LEVEL[g.level]);
  const f = S.play(B, s, r.mv); g.moves.push(r.mv);
  console.log(`Claude (${['', 'Heads', 'Tails'][2 - (g.moves.length & 1)]}) plays ${name(r.mv)}${f >= 0 ? `, and its shadow turns ${name(f)} over` : ''}.`);
}
function report(g) {
  const { s, f } = state(g);
  console.log(draw(s, g.moves[g.moves.length - 1], f));
  if (s.winner) console.log(s.winner === g.human ? 'You win.' : 'Claude wins.', `(${g.moves.length} moves)`);
  else if (!g.moves.length) console.log('Put down the first coin (heads up) with `move`. Claude will then choose a side.');
  else if (!g.human) console.log('Choose your side with `side heads` (that coin is yours) or `side tails` (you move next).');
  else console.log(`Your move. You are ${['', 'Heads', 'Tails'][g.human]}.`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'new') {
  const g = { level: LEVEL[a] ? a : 'easy', human: 0, cutter: b === 'choose' ? 'claude' : 'you', moves: [] };
  if (g.cutter === 'claude') {                     // cut somewhere close to even, as the page does
    const near = S.OPENING.map((v, c) => [Math.abs(v - .5), c]).sort((x, y) => x[0] - y[0]).slice(0, 6);
    g.moves.push(near[(Math.random() * near.length) | 0][1]);
    console.log(`Claude puts down the first coin, heads up, on ${name(g.moves[0])}.`);
  }
  save(g); report(g);
} else if (cmd === 'side') {
  const g = load();
  if (g.cutter !== 'claude' || g.human || g.moves.length !== 1) { console.log('There is no side to choose now.'); process.exit(1); }
  g.human = a === 'heads' ? 1 : 2;
  if (g.human === 1) claude(g);
  save(g); report(g);
} else if (cmd === 'move') {
  const g = load(), { s } = state(g), c = parse(a || '');
  if (s.winner) { console.log('The game is over. Start a new one.'); process.exit(1); }
  if (g.moves.length === 1 && !g.human) { console.log('Choose a side first.'); process.exit(1); }
  if (c < 0 || s.b[c]) { console.log(`${a} is not an empty space on the board.`); process.exit(1); }
  const f = S.play(B, s, c); g.moves.push(c);
  console.log(`You play ${name(c)}${f >= 0 ? `, and your shadow turns ${name(f)} over` : ''}.`);
  if (g.moves.length === 1) {                      // that was the first coin: Claude chooses
    g.human = S.OPENING[c] > .5 ? 2 : 1;
    console.log(g.human === 2 ? 'Claude takes Heads, so that coin is Claude\u2019s. You play Tails.' : 'Claude leaves you Heads and plays Tails.');
    if (g.human === 1) claude(g);
  } else if (!s.winner) claude(g);
  save(g); report(g);
} else report(load());
