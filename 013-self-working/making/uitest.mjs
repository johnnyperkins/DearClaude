// Click through the page like a person, in a throwaway profile, and check that the on-screen deck really does the tricks.
// usage: node uitest.mjs [outdir for stills]
// Ends with the protocol's Browser.close (killing the snap wrapper leaves Chrome running; see the sketchbook).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 9337;
const PROFILE = process.env.HOME + '/snap/chromium/common/claude-prof-test-' + process.pid;
const PAGE = new URL('../self-working.html', import.meta.url).href;
const OUT = process.argv[2] || null;
const RUNS = +(process.env.RUNS || 4);
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(PROFILE, { recursive: true, force: true });
if (OUT) fs.mkdirSync(OUT, { recursive: true });

if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) { console.log(`something is already on port ${PORT}`); process.exit(2); }
spawn('chromium', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1280,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 100 && !ws; i++) {
  try { const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); if (page) ws = page.webSocketDebuggerUrl; } catch {}
  await sleep(200);
}
const sock = new WebSocket(ws);
await new Promise(r => (sock.onopen = r));
let id = 0;
const pending = new Map(), errors = [];
sock.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 400));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value).join(' '));
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result?.value;
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

let mobile = false;
async function open(mob, mode) {
  mobile = mob;
  await send('Emulation.setDeviceMetricsOverride', mob ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mob, maxTouchPoints: mob ? 5 : 0 });
  await send('Page.navigate', { url: PAGE });
  await sleep(400);
  for (let i = 0; i < 60 && !(await ev('window.__ready === true')); i++) await sleep(100);
  await ev(`localStorage.clear()`);
  await click(`document.querySelector('.mode button[data-mode="${mode}"]')`);
  await sleep(200);
}
async function centre(sel) {
  return ev(`(() => { const d = ${sel}; if (!d) return null; const b0 = d.getBoundingClientRect(); if (b0.top < 0 || b0.bottom > innerHeight) d.scrollIntoView({ block: 'center' }); const b = d.getBoundingClientRect(); return [b.x + Math.min(b.width / 2, 8), b.y + b.height / 2]; })()`);
}
async function click(sel) {
  const p = await centre(sel);
  if (!p) { ok(false, 'found ' + sel); return; }
  if (mobile) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1] }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  }
  await sleep(60);
}
const stage = n => `document.querySelector('#act${n} .stage')`;
const btn = (n, text) => `[...document.querySelectorAll('#act${n} .vctl button')].find(b => b.textContent === ${JSON.stringify(text)})`;
const next = async n => { await click(`document.querySelector('#act${n} .next')`); await sleep(900); };
const cards = n => ev(`[...document.querySelectorAll('#act${n} .table .card')].sort((a, b) => { const A = new DOMMatrix(getComputedStyle(a).transform), B = new DOMMatrix(getComputedStyle(b).transform); return Math.abs(A.f - B.f) > 5 ? A.f - B.f : A.e - B.e; }).map(c => ({ up: c.classList.contains('up'), label: c.getAttribute('aria-label'), card: c.dataset.card }))`);
const cardSel = (n, i) => `[...document.querySelectorAll('#act${n} .table .card')].sort((a, b) => { const A = new DOMMatrix(getComputedStyle(a).transform), B = new DOMMatrix(getComputedStyle(b).transform); return Math.abs(A.f - B.f) > 5 ? A.f - B.f : A.e - B.e; })[${i}]`;
async function tapThrough(n) {
  for (let i = 0; i < 6 && await ev(`!!document.querySelector('#act${n} .reveal .more')`); i++) { await click(`document.querySelector('#act${n} .reveal .more')`); await sleep(500); }
  ok(await ev(`getComputedStyle(document.querySelector('#act${n} .answers')).display !== 'none'`), `act ${n}: tapping through the reveal reaches Yes and No`);
}
async function still(name, sel) {
  if (!OUT) return;
  await sleep(700);
  const r = await ev(`(() => { const e = ${sel}; e.scrollIntoView({ block: 'start' }); const b = e.getBoundingClientRect(); return [b.x, b.y + scrollY, b.width, b.height]; })()`);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true, clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1 } });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(shot.result.data, 'base64'));
}

await send('Runtime.enable');
await send('Page.enable');

// 1. Real-deck mode: every step has its words and its drawing, on a desktop and a phone, and Next walks through them.
for (const mob of [false, true]) {
  await open(mob, 'real');
  for (const n of [1, 2]) {
    for (let s = 0; s < 7; s++) {
      const has = await ev(`(() => { const st = ${stage(n)}; return { say: !!st.querySelector('.say, .reveal'), svg: !!st.querySelector('.diagram svg'), count: st.querySelector('.dots span').textContent }; })()`);
      ok(has.say && (s === 6 || has.svg) && has.count === `step ${s + 1} of 7`, `${mob ? 'phone' : 'desktop'} act ${n} step ${s + 1} has its words${s < 6 ? ' and drawing' : ''}`);
      await still(`${mob ? 'p' : 'd'}-real-${n}-${s + 1}`, stage(n));
      if (s < 6) await next(n);
    }
    await tapThrough(n);
    await click(`document.querySelector('#act${n} .answers button[data-a="no"]')`);
    ok(await ev(`!!document.querySelector('#act${n} .after li')`), `act ${n}: "no" gives the list of usual slips`);
    await still(`${mob ? 'p' : 'd'}-real-${n}-no`, stage(n));
  }
}
// progress survives a reload in real mode
await open(false, 'real');
await next(1); await next(1);
await send('Page.reload'); await sleep(800);
ok((await ev(`document.querySelector('#act1 .dots span').textContent`)) === 'step 3 of 7', 'real mode remembers the step after a reload');

// 2. Virtual act one, played like a person, several times.
for (let run = 0; run < RUNS; run++) {
  const mob = run % 2 === 1;
  await open(mob, 'virtual');
  ok(await ev(`document.querySelector('#act1 .next').disabled`), 'virtual: Next waits until the cards are dealt');
  await click(btn(1, 'Shuffle and deal ten')); await sleep(1300);
  let cs = await cards(1);
  ok(cs.length === 10 && cs.every(c => !c.up), 'ten cards dealt face down');
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-1-1`, stage(1));
  await next(1);
  const phase = run % 3 === 2 ? 0 : 1;   // usually the second, fourth...; sometimes the first, third...
  for (let i = phase; i < 10; i += 2) await click(cardSel(1, i));
  await sleep(500);
  ok(!(await ev(`document.querySelector('#act1 .next').disabled`)), 'alternating row is accepted');
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-1-2`, stage(1));
  await next(1);
  const pick = Math.floor(Math.random() * 10);
  const before = await cards(1);
  await click(cardSel(1, pick)); await sleep(600);
  const after = await cards(1);
  const mine = after[pick].card;
  ok(before[pick].card === mine && before[pick].up !== after[pick].up, `one card turned: ${after[pick].up ? after[pick].label : before[pick].label}`);
  ok(!(await ev(`document.querySelector('#act1 .next').disabled`)), 'and Next is allowed');
  await next(1);
  await click(btn(1, 'Gather the row')); await sleep(600);
  await next(1);
  let moves = 0;
  for (let m = 0; m < 24; m++) {
    const r = Math.random();
    if (r < .4) await click(btn(1, 'Turn two'));
    else if (r < .6) await click(btn(1, 'Turn all'));
    else await click(cardSel(1, 1 + Math.floor(Math.random() * 9)));
    moves++;
    await sleep(80);
  }
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-1-5`, stage(1));
  await next(1);
  await click(btn(1, 'Deal into two piles'));
  await sleep(4400);
  ok(await ev(`!!document.querySelector('#act1 .reveal')`), 'the deal moves on to the reveal by itself');
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-1-6`, stage(1));
  await click(`document.querySelector('#act1 .reveal .more')`);
  await sleep(2200);
  const fin = await cards(1);
  const ups = fin.filter(c => c.up), downs = fin.filter(c => !c.up);
  const odd = ups.length === 1 ? ups[0] : downs.length === 1 ? downs[0] : null;
  ok(fin.length === 10, 'ten cards spread in two rows');
  ok(odd && odd.card === mine, `after ${moves} moves, exactly one card faces the other way (${ups.length} up, ${downs.length} down), and it's the chosen one`);
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-1-7`, stage(1));
}

// 3. Virtual act two, several times, with different cuts and piles.
for (let run = 0; run < RUNS; run++) {
  const mob = run % 2 === 0;
  await open(mob, 'virtual');
  await ev(`document.getElementById('act2').scrollIntoView()`);
  await click(btn(2, 'Sort them into suits')); await sleep(900);
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-1`, stage(2));
  await next(2);
  await click(btn(2, 'Put each suit in order')); await sleep(900);
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-2`, stage(2));
  await next(2);
  for (let c = 0; c < 1 + run; c++) {
    const v = 1 + Math.floor(Math.random() * 51);
    await ev(`(() => { const r = document.querySelector('#act2 .vctl input'); r.value = ${v}; r.dispatchEvent(new Event('input')); })()`);
    await click(btn(2, 'Cut here'));
  }
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-3`, stage(2));
  await next(2);
  const deal = 5 + Math.floor(Math.random() * 40);
  for (let i = 0; i < deal; i++) await click(btn(2, 'Deal one'));
  ok((await ev(`document.querySelector('#act2 .vctl .status').textContent`)) === `${deal} in the pile`, `dealt ${deal} into the pile one at a time`);
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-4`, stage(2));
  await next(2);
  for (let i = 0; i < 6; i++) await click(btn(2, Math.random() < .5 ? 'Drop from left' : 'Drop from right'));
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-5a`, stage(2));
  await click(btn(2, 'Riffle'));
  await sleep(4000);
  ok(!(await ev(`document.querySelector('#act2 .next').disabled`)), 'the riffle finishes and Next is allowed');
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-5`, stage(2));
  await next(2);
  await click(btn(2, 'Deal four hands')); await sleep(800);
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-6`, stage(2));
  await next(2);
  await sleep(1800);
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-7a`, stage(2));
  await tapThrough(2); await sleep(1200);
  const rows = await ev(`(() => { const cs = [...document.querySelectorAll('#act2 .table .card')].map(c => { const m = new DOMMatrix(getComputedStyle(c).transform); return { y: Math.round(m.f), x: m.e, l: c.getAttribute('aria-label') }; }); const ys = [...new Set(cs.map(c => c.y))].sort((a, b) => a - b); return ys.map(y => cs.filter(c => c.y === y).sort((a, b) => a.x - b.x).map(c => c.l.split(' ')[0])); })()`);
  const want = 'ace two three four five six seven eight nine ten jack queen king';
  ok(rows.length === 4 && rows.every(r => r.join(' ') === want), `four hands, each ace to king: ${rows.map(r => r.length).join(',')}`);
  if (run === 0) await still(`${mob ? 'p' : 'd'}-virt-2-7`, stage(2));
}

// 4. The two demonstrations further down.
await open(false, 'real');
await ev(`document.getElementById('how').open = true`);
const badgeCount = async () => ev(`(() => { const b = [...document.querySelectorAll('#badgeTable .card')].map(c => c.style.getPropertyValue('--badge')); const a = b.filter(x => x.includes('badge-a')).length; return [a, b.length - a]; })()`);
for (let m = 0; m < 30; m++) {
  const r = Math.random();
  if (r < .4) await click(`[...document.querySelectorAll('#badgeCtl button')].find(b => b.textContent === 'Turn two')`);
  else if (r < .6) await click(`[...document.querySelectorAll('#badgeCtl button')].find(b => b.textContent === 'Turn all')`);
  else await click(`document.querySelectorAll('#badgeTable .card')[${1 + Math.floor(Math.random() * 9)}]`);
  const [a, b] = await badgeCount();
  if (Math.min(a, b) !== 1) { ok(false, `badges stay nine and one (${a}, ${b})`); break; }
}
ok(true, 'badges stayed nine and one through 30 random moves');
await still('d-badges', `document.querySelector('#badgeTable').closest('.demo')`);
await click(`[...document.querySelectorAll('#badgeCtl button')].find(b => b.textContent === 'Deal')`);
await sleep(2000);
const dealt = await ev(`[...document.querySelectorAll('#badgeTable .card')].map(c => c.classList.contains('up'))`);
ok(Math.min(dealt.filter(Boolean).length, dealt.filter(x => !x).length) === 1, 'the demo deal leaves one card the other way');
await still('d-badges-dealt', `document.querySelector('#badgeTable').closest('.demo')`);
await click(`[...document.querySelectorAll('#badgeCtl button')].find(b => b.textContent === 'Turn two')`);
await sleep(600);
const [a2, b2] = await badgeCount();
ok(Math.min(a2, b2) === 1 && a2 + b2 === 10, 'after a deal, the next move gathers the packet back with its colours');
await ev(`(() => { const r = document.querySelector('#ringCtl input'); r.value = 52; r.dispatchEvent(new Event('input')); })()`);
const hr = await ev(`[...document.querySelectorAll('.hands-read div')].map(d => d.textContent)`);
ok(hr.length === 4 && hr.every(t => t.endsWith('A 2 3 4 5 6 7 8 9 10 J Q K')), 'the ring demo deals four complete hands');
await still('d-ring', `document.querySelector('#ring').closest('.demo')`);
await open(true, 'real');
await ev(`document.getElementById('how').open = true`);
await ev(`(() => { const r = document.querySelector('#ringCtl input'); r.value = 30; r.dispatchEvent(new Event('input')); })()`);
await still('p-ring', `document.querySelector('#ring').closest('.demo')`);
await still('p-badges', `document.querySelector('#badgeTable').closest('.demo')`);

ok(errors.length === 0, 'no errors in the console' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all passed');
await send('Browser.close').catch(() => {});
await sleep(500);
fs.rmSync(PROFILE, { recursive: true, force: true });
process.exit(fails ? 1 : 0);
