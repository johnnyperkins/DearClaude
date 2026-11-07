// Where do strong players put their coins? Fraction of moves on the board's edge, by move number.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./engine.js', import.meta.url), 'utf8');
if (isMainThread) {
  const [G, it] = process.argv.slice(2).map(Number);
  const res = []; let next = 0;
  await Promise.all(Array.from({ length: 7 }, () => new Promise(done => {
    const w = new Worker(new URL(import.meta.url), { workerData: { src, it } });
    const feed = () => next++ < G ? w.postMessage(1) : (w.terminate(), done());
    w.on('message', r => { res.push(r); feed(); }); feed();
  })));
  const n = 7, edge = i => { const q = i % n, r = (i / n) | 0; return q === 0 || r === 0 || q === n - 1 || r === n - 1; };
  const ring = i => { const q = i % n - 3, r = ((i / n) | 0) - 3; return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); };
  let e = 0, t = 0; const early = [0, 0], first = {};
  const rings = [0, 0, 0, 0, 0, 0, 0];
  for (const g of res) g.moves.forEach((c, k) => { t++; if (edge(c)) e++; if (k < 6) { early[1]++; if (edge(c)) early[0]++; } rings[ring(c)]++; });
  for (const g of res) { const f = 'abcdefg'[g.moves[0] % n] + ((g.moves[0] / n | 0) + 1); first[f] = (first[f] || 0) + 1; }
  console.log(`edge share ${(e / t).toFixed(2)} (board: ${(24 / 49).toFixed(2)}), first six moves ${(early[0] / early[1]).toFixed(2)}, hex distance from centre`, rings.join(' '), 'first moves', JSON.stringify(first));
  console.log('sample:', res.slice(0, 3).map(g => g.moves.map(c => 'abcdefg'[c % n] + ((c / n | 0) + 1)).join(' ') + ' → ' + 'HT'[g.winner - 1]).join('\n'));
} else {
  new Function(workerData.src)();
  const S = globalThis.Shade, B = S.board(7);
  parentPort.on('message', () => {
    const s = S.start(B), moves = [];
    while (!s.winner) { const r = S.think(B, s, { iters: workerData.it }); moves.push(r.mv); S.play(B, s, r.mv); }
    parentPort.postMessage({ moves, winner: s.winner });
  });
}
