// How good is each first coin for Heads? For every space, strong players finish the game from there many times.
// node openings.mjs games iters > openings.json
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./engine.js', import.meta.url), 'utf8');
if (isMainThread) {
  const [G, it] = process.argv.slice(2).map(Number);
  const jobs = []; for (let g = 0; g < G; g++) for (let c = 0; c < 49; c++) jobs.push(c);
  const wins = new Array(49).fill(0), games = new Array(49).fill(0); let next = 0;
  await Promise.all(Array.from({ length: 7 }, () => new Promise(done => {
    const w = new Worker(new URL(import.meta.url), { workerData: { src, it } });
    const feed = () => next < jobs.length ? w.postMessage(jobs[next++]) : (w.terminate(), done());
    w.on('message', r => { games[r.c]++; if (r.winner === 1) wins[r.c]++; feed(); }); feed();
  })));
  const v = wins.map((w, c) => +(w / games[c]).toFixed(2));
  for (let r = 0; r < 7; r++) process.stderr.write(' '.repeat(r * 3) + v.slice(r * 7, r * 7 + 7).map(x => x.toFixed(2)).join('  ') + '\n');
  console.log(JSON.stringify(v));
} else {
  new Function(workerData.src)();
  const S = globalThis.Shade, B = S.board(7);
  parentPort.on('message', c => {
    const s = S.start(B); S.play(B, s, c);
    while (!s.winner) S.play(B, s, S.think(B, s, { iters: workerData.it }).mv);
    parentPort.postMessage({ c, winner: s.winner });
  });
}
