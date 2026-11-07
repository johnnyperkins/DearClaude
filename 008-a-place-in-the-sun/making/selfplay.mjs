// Self-play with the page's own engine. node selfplay.mjs n games itersA itersB
// Reports Heads' win rate with equal players, and how often the stronger player wins (seats alternate).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./engine.js', import.meta.url), 'utf8');

if (isMainThread) {
  const [n, G, A, Bi] = process.argv.slice(2).map(Number);
  const jobs = [];
  for (let g = 0; g < G; g++) jobs.push({ kind: 'mirror', it: [A, A] });
  if (Bi) for (let g = 0; g < G; g++) jobs.push({ kind: 'skill', it: g % 2 ? [Bi, A] : [A, Bi], strong: g % 2 ? 2 : 1 });
  const res = []; let next = 0;
  await Promise.all(Array.from({ length: 7 }, () => new Promise(done => {
    const w = new Worker(new URL(import.meta.url), { workerData: { n, src } });
    const feed = () => next < jobs.length ? w.postMessage(jobs[next++]) : (w.terminate(), done());
    w.on('message', r => { res.push(r); feed(); });
    feed();
  })));
  const avg = (a, f) => a.reduce((x, r) => x + f(r), 0) / a.length;
  const mir = res.filter(r => r.kind === 'mirror'), sk = res.filter(r => r.kind === 'skill');
  const p = avg(mir, r => r.winner === 1), se = Math.sqrt(p * (1 - p) / mir.length);
  console.log(`${process.env.TUNE || ''} n=${n} ${A} v ${Bi}: heads=${p.toFixed(2)}±${se.toFixed(2)} len=${avg(mir, r => r.len).toFixed(1)} flips=${avg(mir, r => r.flips).toFixed(1)} strong=${sk.length ? avg(sk, r => r.winner === r.strong).toFixed(2) : "-"}`);
} else {
  if (process.env.TUNE) globalThis.SHADE_TUNE = JSON.parse(process.env.TUNE);
  new Function(workerData.src)();
  const S = globalThis.Shade, B = S.board(workerData.n);
  parentPort.on('message', j => {
    const s = S.start(B); let flips = 0;
    while (!s.winner) { const r = S.think(B, s, { iters: j.it[s.ply & 1] }); if (S.play(B, s, r.mv) >= 0) flips++; }
    parentPort.postMessage({ ...j, winner: s.winner, len: s.ply, flips });
  });
}
