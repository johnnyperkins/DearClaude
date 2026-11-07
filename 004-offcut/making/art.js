// The six faces. Each one is drawn once, in a single triangle with corners
// C0 = (0,0), C1 = (1,0), C2 = (1/2, √3/2). The flexagon's hinges reflect that
// triangle across its edges, so every face is a kaleidoscope, and each view is
// a hexagonal window centred on one of the three corners.
const H3 = Math.sqrt(3) / 2;
const C = [[0, 0], [1, 0], [0.5, H3]];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const f = n => +n.toFixed(4);
// a point at distance r from corner c, at angle a (degrees) measured from that corner's first edge into the triangle
function at(c, r, a) {
  const [x, y] = C[c];
  const base = [0, 120, 240][c];   // direction of each corner's first edge (C0->C1, C1->C2, C2->C0)
  const t = (base + a) * Math.PI / 180;
  return [x + r * Math.cos(t), y + r * Math.sin(t)];
}
const deg = (c, a) => [0, 120, 240][c] + a;

// ---- little drawing kit (all in triangle units) ----
const circ = (x, y, r, fill, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" ${extra}/>`;
function leafPath(x, y, len, wid, ang, bend = 0) {
  // a pointed leaf from (x,y) along ang
  const t = ang * Math.PI / 180, ux = Math.cos(t), uy = Math.sin(t), nx = -uy, ny = ux;
  const tip = [x + ux * len, y + uy * len];
  const m1 = [x + ux * len * 0.45 + nx * wid * (1 + bend), y + uy * len * 0.45 + ny * wid * (1 + bend)];
  const m2 = [x + ux * len * 0.45 - nx * wid * (1 - bend), y + uy * len * 0.45 - ny * wid * (1 - bend)];
  return `M${f(x)} ${f(y)}Q${f(m1[0])} ${f(m1[1])} ${f(tip[0])} ${f(tip[1])}Q${f(m2[0])} ${f(m2[1])} ${f(x)} ${f(y)}Z`;
}
const leaf = (x, y, len, wid, ang, fill, extra = '', bend = 0) => `<path d="${leafPath(x, y, len, wid, ang, bend)}" fill="${fill}" ${extra}/>`;
function petal(x, y, len, wid, ang, fill, extra = '') {
  // a rounded petal: narrow at the base, round at the end
  const t = ang * Math.PI / 180, ux = Math.cos(t), uy = Math.sin(t), nx = -uy, ny = ux;
  const P = (a, b) => `${f(x + ux * a + nx * b)} ${f(y + uy * a + ny * b)}`;
  return `<path d="M${P(0, 0)}C${P(len * 0.35, wid * 1.1)} ${P(len * 1.02, wid * 1.05)} ${P(len, 0)}C${P(len * 1.02, -wid * 1.05)} ${P(len * 0.35, -wid * 1.1)} ${P(0, 0)}Z" fill="${fill}" ${extra}/>`;
}
function star(x, y, r, n, inner, rot, fill, extra = '') {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (rot + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r * inner : r;
    d += (i ? 'L' : 'M') + f(x + rr * Math.cos(a)) + ' ' + f(y + rr * Math.sin(a));
  }
  return `<path d="${d}Z" fill="${fill}" ${extra}/>`;
}
const line = (pts, stroke, w, extra = '') => `<path d="M${pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L')}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const curve = (d, stroke, w, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const P = p => f(p[0]) + ' ' + f(p[1]);
function scatter(seed, n, draw, margin = 0.02) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) {
    let a = r(), b = r(); if (a + b > 1) { a = 1 - a; b = 1 - b; }
    const x = a * C[1][0] + b * C[2][0], y = a * C[1][1] + b * C[2][1];
    s += draw(x, y, r, i);
  }
  return s;
}

const FACES = {
  1: {
    name: 'garden', ground: '#f2e9d2',
    draw() {
      let s = '';
      // corner 0: a flower. Petals on the bisector and on the mirrors.
      s += petal(...C[0], 0.4, 0.085, 30, '#e07a5f', 'opacity=".9"');
      s += petal(...C[0], 0.3, 0.07, 3, '#f2a489', 'opacity=".85"');
      s += petal(...C[0], 0.3, 0.07, 57, '#f2a489', 'opacity=".85"');
      s += circ(...C[0], 0.09, '#e9b949');
      s += circ(...C[0], 0.045, '#b5562f');
      // corner 1: leaves in pairs
      s += leaf(...C[1], 0.36, 0.07, deg(1, 18), '#5f8f55', '', 0.2);
      s += leaf(...C[1], 0.26, 0.055, deg(1, 44), '#86ad6b', '', -0.2);
      s += line([at(1, 0, 0), at(1, 0.34, 18)], '#3f6a3c', 0.006);
      s += circ(...C[1], 0.05, '#3f6a3c');
      // corner 2: berries
      [[0.1, 30, 0.045], [0.19, 18, 0.035], [0.19, 42, 0.035], [0.27, 30, 0.028]].forEach(([r, a, rr]) => {
        const [x, y] = at(2, r, a); s += circ(x, y, rr, '#8c3b5e') + circ(x - rr * 0.3, y - rr * 0.3, rr * 0.3, '#c47a95');
      });
      [[0.62, 0.2], [0.4, 0.44]].forEach(([x, y]) => {
        for (let i = 0; i < 5; i++) s += petal(x, y, 0.035, 0.016, i * 72 + 10, '#fbf6ea');
        s += circ(x, y, 0.01, '#e9b949');
      });
      // a stem that crosses the middle, and pollen
      s += curve(`M${P(at(1, 0.34, 18))}Q${P([0.5, 0.33])} ${P(at(2, 0.3, 30))}`, '#3f6a3c', 0.008);
      s += scatter(11, 12, (x, y, r) => circ(x, y, 0.007 + r() * 0.006, '#d9a441', 'opacity=".8"'));
      return s;
    },
  },
  2: {
    name: 'sky', ground: '#d7e7ee',
    draw() {
      let s = '';
      // corner 0: the sun
      for (let i = 0; i < 4; i++) {
        const a = 7.5 + i * 15;
        s += leaf(...at(0, 0.13, a), i % 2 ? 0.16 : 0.24, 0.018, deg(0, a), '#e8a93e', 'opacity=".9"');
      }
      s += circ(...C[0], 0.13, '#f0bd4f');
      s += circ(...C[0], 0.09, '#f6d27a');
      // corner 1: a cloud
      [[0.1, 10, 0.1], [0.16, 38, 0.09], [0.26, 20, 0.07], [0.05, 50, 0.08]].forEach(([r, a, rr]) => {
        s += circ(...at(1, r, a), rr, '#ffffff', 'opacity=".9"');
      });
      // corner 2: a swallow, flying outward, far enough out that six of them make a ring
      const [bx, by] = at(2, 0.3, 30);
      const b = deg(2, 30) + 180;
      const T = (a, r) => { const t = (b + a) * Math.PI / 180; return [bx + r * Math.cos(t), by + r * Math.sin(t)]; };
      s += `<path d="M${P(T(0, 0.05))}Q${P(T(60, 0.035))} ${P(T(112, 0.12))}Q${P(T(140, 0.03))} ${P(T(180, 0.045))}Q${P(T(220, 0.03))} ${P(T(248, 0.12))}Q${P(T(300, 0.035))} ${P(T(0, 0.05))}Z" fill="#2f4a6b"/>`;
      s += leaf(...T(180, 0.04), 0.07, 0.01, b + 168, '#2f4a6b') + leaf(...T(180, 0.04), 0.07, 0.01, b + 192, '#2f4a6b');
      s += circ(...T(0, 0.01), 0.012, '#c65a3e');
      // distant birds
      [[0.55, 0.2], [0.62, 0.27], [0.42, 0.52]].forEach(([x, y]) => {
        s += curve(`M${f(x - 0.025)} ${f(y)}Q${f(x - 0.012)} ${f(y - 0.014)} ${f(x)} ${f(y)}Q${f(x + 0.012)} ${f(y - 0.014)} ${f(x + 0.025)} ${f(y)}`, '#4b6480', 0.007);
      });
      s += circ(...at(1, 0.3, 50), 0.045, '#ffffff', 'opacity=".85"') + circ(...at(1, 0.34, 40), 0.035, '#ffffff', 'opacity=".85"');
      // wind
      s += curve(`M${P([0.3, 0.05])}Q${P([0.55, 0.12])} ${P([0.72, 0.06])}`, '#9fbfd0', 0.01);
      s += curve(`M${P([0.36, 0.42])}Q${P([0.5, 0.36])} ${P([0.62, 0.44])}`, '#ffffff', 0.012, 'opacity=".8"');
      return s;
    },
  },
  3: {
    name: 'shore', ground: '#eedfc0',
    draw() {
      let s = '';
      // corner 0: a scallop shell, ribs fanning from the corner
      for (let i = 0; i < 7; i++) {
        const a = 4 + i * 8.7;
        s += petal(...C[0], 0.34, 0.03, deg(0, a), i % 2 ? '#e39a78' : '#d47d5c', 'opacity=".95"');
      }
      s += circ(...C[0], 0.06, '#f4c7a6');
      // corner 1: a curling wave
      const w = (r, a) => P(at(1, r, a));
      s += `<path d="M${w(0.05, 2)}Q${w(0.3, 10)} ${w(0.36, 32)}Q${w(0.3, 55)} ${w(0.2, 45)}Q${w(0.16, 30)} ${w(0.22, 28)}Q${w(0.16, 20)} ${w(0.05, 58)}Z" fill="#3f8f96"/>`;
      s += curve(`M${w(0.1, 8)}Q${w(0.28, 14)} ${w(0.32, 32)}`, '#bfe3df', 0.01);
      s += curve(`M${w(0.42, 6)}Q${w(0.46, 20)} ${w(0.44, 40)}`, '#3f8f96', 0.012, 'opacity=".6"');
      // corner 2: sea glass
      s += `<path d="M${P(at(2, 0.08, 20))}L${P(at(2, 0.2, 8))}L${P(at(2, 0.26, 34))}L${P(at(2, 0.13, 46))}Z" fill="#7fb8a4" opacity=".85"/>`;
      s += `<path d="M${P(at(2, 0.27, 20))}L${P(at(2, 0.36, 26))}L${P(at(2, 0.31, 40))}Z" fill="#9ec6dd" opacity=".85"/>`;
      // pebbles and sand
      s += scatter(23, 5, (x, y, r) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(0.018 + r() * 0.015)}" ry="${f(0.012 + r() * 0.01)}" fill="#b9a07d" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`);
      s += scatter(29, 26, (x, y, r) => circ(x, y, 0.006, '#c7ad84'));
      return s;
    },
  },
  4: {
    name: 'night', ground: '#23284f',
    draw() {
      let s = '';
      // corner 0: the moon, whole in the middle
      s += circ(...C[0], 0.2, '#f1e3a9');
      s += circ(...at(0, 0.1, 20), 0.03, '#ddcb8a') + circ(...at(0, 0.14, 45), 0.018, '#ddcb8a');
      s += circ(...C[0], 0.26, 'none', 'stroke="#f1e3a9" stroke-width=".006" opacity=".5"');
      // corner 2: a moth, heading in toward the corner
      const [mx, my] = at(2, 0.3, 30), b = deg(2, 30) + 180;   // b points from the moth to the corner... reversed below
      const hb = b + 180;
      const W = (a, r) => { const t = (hb + a) * Math.PI / 180; return [mx + r * Math.cos(t), my + r * Math.sin(t)]; };
      for (const sg of [1, -1]) {
        s += `<path d="M${P(W(0, 0.01))}C${P(W(sg * 40, 0.14))} ${P(W(sg * 95, 0.2))} ${P(W(sg * 118, 0.14))}C${P(W(sg * 135, 0.08))} ${P(W(sg * 150, 0.03))} ${P(W(0, 0.01))}Z" fill="#b8afd6"/>`;
        s += `<path d="M${P(W(180, 0.01))}C${P(W(sg * 125, 0.09))} ${P(W(sg * 150, 0.13))} ${P(W(sg * 165, 0.1))}C${P(W(sg * 172, 0.06))} ${P(W(180, 0.04))} ${P(W(180, 0.01))}Z" fill="#8c83b6"/>`;
        s += circ(...W(sg * 88, 0.11), 0.018, '#f1e3a9') + circ(...W(sg * 88, 0.11), 0.008, '#23284f');
        s += curve(`M${P(W(sg * 8, 0.04))}Q${P(W(sg * 18, 0.08))} ${P(W(sg * 30, 0.1))}`, '#e6ddf2', 0.005);
      }
      s += leaf(...W(180, 0.07), 0.13, 0.017, hb, '#e6ddf2');
      // corner 1: this corner is never in the middle, only at the edges. Stars.
      s += star(...C[1], 0.12, 4, 0.28, deg(1, 0), '#f6efcf');
      s += star(...at(1, 0.24, 30), 0.035, 4, 0.3, 15, '#f6efcf');
      s += scatter(41, 18, (x, y, r) => circ(x, y, 0.006 + r() * 0.007, '#f6efcf', `opacity="${f(0.55 + r() * 0.45)}"`));
      return s;
    },
  },
  5: {
    name: 'deep', ground: '#0f3a44',
    draw() {
      let s = '';
      // corner 1: a jellyfish seen from above, bell in the middle
      s += circ(...C[1], 0.2, '#e79ab9', 'opacity=".75"');
      s += circ(...C[1], 0.13, '#f2c0d4', 'opacity=".8"');
      for (let i = 0; i < 3; i++) {
        const a = 10 + i * 20;
        const p0 = at(1, 0.2, a), p1 = at(1, 0.3, a + 8), p2 = at(1, 0.38, a - 6), p3 = at(1, 0.47, a + 4);
        s += curve(`M${P(p0)}C${P(p1)} ${P(p2)} ${P(p3)}`, '#e79ab9', 0.008, 'opacity=".8"');
      }
      // corner 2: a radiolarian, a glass lattice
      s += circ(...C[2], 0.17, 'none', 'stroke="#8fe0d6" stroke-width=".008"');
      s += circ(...C[2], 0.11, 'none', 'stroke="#8fe0d6" stroke-width=".006"');
      for (let i = 0; i < 4; i++) s += line([at(2, 0.11, i * 20), at(2, 0.24, i * 20)], '#8fe0d6', 0.006);
      s += circ(...C[2], 0.05, '#8fe0d6', 'opacity=".6"');
      // corner 0 (only at the edges): light
      s += scatter(53, 22, (x, y, r) => circ(x, y, 0.006 + r() * 0.01, '#bff4ea', `opacity="${f(0.35 + r() * 0.6)}"`));
      s += circ(...C[0], 0.06, '#5fd1c4', 'opacity=".8"');
      return s;
    },
  },
  6: {
    name: 'underground', ground: '#3a2a1e',
    draw() {
      let s = '';
      // corner 1: a seed with its first shoot, six of them around the middle
      const sd = deg(1, 30);
      const [sx, sy] = at(1, 0.2, 30);
      s += `<ellipse cx="${f(sx)}" cy="${f(sy)}" rx=".085" ry=".05" fill="#d9a55a" transform="rotate(${f(sd)} ${f(sx)} ${f(sy)})"/>`;
      s += `<ellipse cx="${f(sx)}" cy="${f(sy)}" rx=".085" ry=".05" fill="none" stroke="#8a5f2a" stroke-width=".006" transform="rotate(${f(sd)} ${f(sx)} ${f(sy)})"/>`;
      s += curve(`M${P(at(1, 0.12, 30))}Q${P(at(1, 0.06, 20))} ${P(at(1, 0.07, 44))}`, '#9cc26a', 0.012);
      s += leaf(...at(1, 0.07, 44), 0.06, 0.02, deg(1, 10), '#9cc26a');
      s += circ(...C[1], 0.035, '#e9c348');
      // corner 2: roots
      const root = (r, a, pts) => pts.map(([rr, aa]) => at(2, rr, aa));
      s += line(root(0, 0, [[0, 0], [0.12, 22], [0.25, 18], [0.4, 26]]), '#c8a57a', 0.014);
      s += line(root(0, 0, [[0.12, 22], [0.2, 38], [0.3, 44]]), '#c8a57a', 0.009);
      s += line(root(0, 0, [[0.25, 18], [0.32, 8], [0.38, 4]]), '#c8a57a', 0.007);
      // corner 0 (only at the edges): a network, like slime mold
      const r = rng(61), pts = [];
      for (let i = 0; i < 9; i++) { let a = r(), b = r(); if (a + b > 1) { a = 1 - a; b = 1 - b; } pts.push([a * C[1][0] + b * C[2][0], a * C[1][1] + b * C[2][1]]); }
      pts.forEach((p, i) => pts.forEach((q, j) => { if (j > i && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.3) s += line([p, q], '#e9c348', 0.005, 'opacity=".75"'); }));
      pts.forEach(p => { s += circ(p[0], p[1], 0.012, '#e9c348'); });
      s += scatter(67, 6, (x, y, rr) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(0.02 + rr() * 0.02)}" ry="${f(0.014 + rr() * 0.01)}" fill="#6b5846" transform="rotate(${f(rr() * 180)} ${f(x)} ${f(y)})"/>`);
      return s;
    },
  },
};

// ---- rendering: defs for each face's triangle, and affine maps onto target triangles ----
function faceDefs(prefix = 'k') {
  // the clip is a hair bigger than the triangle, so neighbours overlap instead of leaving an antialiased seam
  const g = 1.012, cx = 0.5, cy = H3 / 3, E = ([x, y]) => `${f(cx + (x - cx) * g)} ${f(cy + (y - cy) * g)}`;
  let s = `<clipPath id="${prefix}clip" clipPathUnits="userSpaceOnUse"><path d="M${E(C[0])}L${E(C[1])}L${E(C[2])}Z"/></clipPath>`;
  for (const [n, face] of Object.entries(FACES)) {
    s += `<g id="${prefix}${n}"><g clip-path="url(#${prefix}clip)"><path d="M-0.01 -0.01L1.01 -0.01L0.5 ${f(H3 + 0.01)}Z" fill="${face.ground}"/>${face.draw()}</g></g>`;
  }
  return s;
}
// matrix taking C[a]->p, C[b]->q, C[c]->r where (a,b,c) is a permutation of 0,1,2
function triMatrix(cls, pts) {
  // solve for M with M*C[cls[i]] = pts[i]
  const [x0, y0] = C[cls[0]], [x1, y1] = C[cls[1]], [x2, y2] = C[cls[2]];
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  const inv = [(y2 - y0) / det, -(x2 - x0) / det, -(y1 - y0) / det, (x1 - x0) / det];
  const dx1 = pts[1][0] - pts[0][0], dy1 = pts[1][1] - pts[0][1], dx2 = pts[2][0] - pts[0][0], dy2 = pts[2][1] - pts[0][1];
  const a = dx1 * inv[0] + dx2 * inv[2], c = dx1 * inv[1] + dx2 * inv[3];
  const b = dy1 * inv[0] + dy2 * inv[2], d = dy1 * inv[1] + dy2 * inv[3];
  const e = pts[0][0] - a * x0 - c * y0, ff = pts[0][1] - b * x0 - d * y0;
  return `matrix(${[a, b, c, d, e, ff].map(v => +v.toFixed(5)).join(' ')})`;
}
function triUse(face, cls, pts, prefix = 'k') {
  // a hair of overlap hides the seams antialiasing leaves between neighbouring triangles
  return `<use href="#${prefix}${face}" transform="${triMatrix(cls, pts)}"/>`;
}
// the ideal kaleidoscope window centred on corner class c (used to check the flexagon against)
function kaleidoView(face, c, R = 1) {
  const others = [0, 1, 2].filter(x => x !== c);
  const V = j => [R * Math.cos(j * Math.PI / 3), R * Math.sin(j * Math.PI / 3)];
  let s = '';
  for (let j = 0; j < 6; j++) s += triUse(face, [c, others[j % 2], others[(j + 1) % 2]], [[0, 0], V(j), V(j + 1)]);
  return s;
}
if (typeof module !== 'undefined') module.exports = { FACES, faceDefs, triMatrix, triUse, kaleidoView, C, H3 };
