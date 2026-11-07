// The rules, and Claude's player. Shared by the page and by the tests in making/.
// Board: an n by n diamond of hexagons. Cell i = r * n + q. Heads (1) joins top and bottom, Tails (2) left and right.
// Directions, as seen on screen with pointy-topped hexagons: 0 E, 1 NE, 2 NW, 3 W, 4 SW, 5 SE.
(function (root) {
  const DQ = [1, 1, 0, -1, -1, 0], DR = [0, -1, -1, 0, 1, 1];

  function board(n) {
    const N = n * n, step = [], nb = [];
    for (let i = 0; i < N; i++) {
      const q = i % n, r = (i / n) | 0, s = [];
      for (let d = 0; d < 6; d++) {
        const q2 = q + DQ[d], r2 = r + DR[d];
        s.push(q2 >= 0 && q2 < n && r2 >= 0 && r2 < n ? r2 * n + q2 : -1);
      }
      step.push(s); nb.push(s.filter(j => j >= 0));
    }
    return { n, N, step, nb };
  }

  // The sun starts in the east and goes clockwise, one step after each round.
  // Round k: the sun is in direction sunDir(k), so shadows fall the opposite way.
  const T = Object.assign({ start: 0, every: 2, phase: 1 }, root.SHADE_TUNE);  // tests may override
  const sunDir = k => (((T.start - k) % 6) + 6) % 6;    // E, SE, SW, W, NW, NE
  const shadowDir = k => (sunDir(k) + 3) % 6;           // W, NW, NE, E, SE, SW
  const roundOf = ply => Math.floor((ply + T.phase) / T.every);

  function start(B) { return { b: new Int8Array(B.N), ply: 0, winner: 0, empty: B.N }; }
  const copy = s => ({ b: s.b.slice(), ply: s.ply, winner: s.winner, empty: s.empty });
  const toMove = s => 1 + (s.ply & 1);

  function connected(B, b, p) {
    const n = B.n, seen = new Uint8Array(B.N), st = [];
    for (let k = 0; k < n; k++) { const i = p === 1 ? k : k * n; if (b[i] === p) { seen[i] = 1; st.push(i); } }
    while (st.length) {
      const i = st.pop();
      if (p === 1 ? i >= B.N - n : i % n === n - 1) return true;
      for (const j of B.nb[i]) if (!seen[j] && b[j] === p) { seen[j] = 1; st.push(j); }
    }
    return false;
  }

  // The winning chain (for drawing): the cells of p's group that touches both edges.
  function chain(B, b, p) {
    const n = B.n, comp = new Int32Array(B.N).fill(-1);
    for (let i0 = 0; i0 < B.N; i0++) {
      if (b[i0] !== p || comp[i0] >= 0) continue;
      const st = [i0], cells = []; comp[i0] = i0;
      let a = false, z = false;
      while (st.length) {
        const i = st.pop(); cells.push(i);
        const q = i % n, r = (i / n) | 0;
        if (p === 1 ? r === 0 : q === 0) a = true;
        if (p === 1 ? r === n - 1 : q === n - 1) z = true;
        for (const j of B.nb[i]) if (comp[j] < 0 && b[j] === p) { comp[j] = i0; st.push(j); }
      }
      if (a && z) return cells;
    }
    return [];
  }

  // Place a coin. Returns the cell whose coin was turned over, or -1.
  function play(B, s, c) {
    const p = toMove(s), b = s.b;
    b[c] = p; s.empty--;
    const j = B.step[c][shadowDir(roundOf(s.ply))];
    let flipped = -1;
    if (j >= 0 && b[j] === 3 - p) { b[j] = p; flipped = j; }
    s.ply++;
    if (connected(B, b, p)) s.winner = p;
    return flipped;
  }

  const legal = s => { const m = []; for (let i = 0; i < s.b.length; i++) if (!s.b[i]) m.push(i); return m; };

  // Claude: Monte Carlo tree search with random playouts.
  function think(B, root, opts) {
    const iters = opts.iters || 1e9, until = opts.ms ? Date.now() + opts.ms : Infinity, C = opts.C || 0.8;
    const rnd = opts.random || Math.random;
    const R = { mv: -1, parent: null, kids: null, untried: null, n: 0, w: 0, who: 3 - toMove(root) };
    const empties = new Int32Array(B.N);
    let it = 0;
    for (; it < iters; it++) {
      if ((it & 255) === 0 && Date.now() > until) break;
      const s = copy(root);
      let node = R;
      while (!s.winner) {
        if (!node.kids) { node.kids = []; node.untried = legal(s); }
        if (node.untried.length) {
          const k = (rnd() * node.untried.length) | 0, mv = node.untried[k];
          node.untried[k] = node.untried[node.untried.length - 1]; node.untried.pop();
          const who = toMove(s); play(B, s, mv);
          const ch = { mv, parent: node, kids: null, untried: null, n: 0, w: 0, who };
          node.kids.push(ch); node = ch; break;
        }
        let best = null, bv = -1, ln = Math.log(node.n);
        for (const ch of node.kids) { const v = ch.w / ch.n + C * Math.sqrt(ln / ch.n); if (v > bv) { bv = v; best = ch; } }
        play(B, s, best.mv); node = best;
      }
      if (!s.winner) {                                  // random playout
        let m = 0; for (let i = 0; i < B.N; i++) if (!s.b[i]) empties[m++] = i;
        while (!s.winner && m) { const k = (rnd() * m) | 0, c = empties[k]; empties[k] = empties[--m]; play(B, s, c); }
      }
      for (let x = node; x; x = x.parent) { x.n++; if (s.winner === x.who) x.w++; }
    }
    let best = null;
    for (const ch of R.kids) if (!best || ch.n > best.n) best = ch;
    return { mv: best.mv, value: best.w / best.n, iters: it };
  }

  // How often Heads wins from each first coin on the 7 by 7 board, between strong players (openings.mjs, 30 games each).
  const OPENING = [0.5, 0.63, 0.53, 0.53, 0.63, 0.57, 0.6, 0.63, 0.33, 0.57, 0.37, 0.33, 0.63, 0.57, 0.73, 0.5, 0.33, 0.47, 0.47, 0.47, 0.4, 0.47, 0.63, 0.33, 0.8, 0.67, 0.53, 0.43, 0.47, 0.4, 0.7, 0.57, 0.53, 0.67, 0.5, 0.47, 0.43, 0.6, 0.77, 0.7, 0.67, 0.63, 0.43, 0.53, 0.67, 0.57, 0.7, 0.63, 0.33];

  root.Shade = { OPENING, board, start, copy, toMove, play, legal, connected, chain, think, sunDir, shadowDir, roundOf, DQ, DR };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
