// Play the page like a person: mouse, touch and keys over the DevTools protocol, in a throwaway profile.
// usage: node uitest.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 9335;
const PROFILE = process.env.HOME + '/snap/chromium/common/claude-prof-test-' + process.pid;   // fresh every run
const PAGE = new URL('../a-place-in-the-sun.html', import.meta.url).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(PROFILE, { recursive: true, force: true });

if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) { console.log(`something is already on port ${PORT}`); process.exit(2); }
const proc = spawn('chromium', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1280,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 100 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === 'page');
    if (page) ws = page.webSocketDebuggerUrl;
  } catch {}
  await sleep(200);
}
const sock = new WebSocket(ws);
await new Promise(r => (sock.onopen = r));
let id = 0;
const pending = new Map(), errors = [];
sock.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value).join(' '));
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result.value;

let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };
const game = () => ev('window.__game()');
const text = sel => ev(`document.querySelector(${JSON.stringify(sel)}).innerText`);
const idx = name => (+name.slice(1) - 1) * 7 + 'abcdefg'.indexOf(name[0]);

async function open(mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', mobile ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 });
  await send('Page.navigate', { url: PAGE });
  await sleep(300);
  for (let i = 0; i < 50 && !(await ev('window.__ready === true')); i++) await sleep(100);
}
async function centre(sel) {
  return ev(`(() => { const d = ${sel}; const b0 = d.getBoundingClientRect(); if (b0.top < 0 || b0.bottom > innerHeight) d.scrollIntoView({ block: 'center' }); const b = d.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
}
const cellSel = name => `document.querySelectorAll('.cell')[${idx(name)}]`;
async function hover(name) { const p = await centre(cellSel(name)); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] }); }
async function click(sel) {
  const p = await centre(sel);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
}
async function tap(sel) {
  const p = await centre(sel);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1] }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(120);
}
const button = (group, v) => `document.querySelector('#${group} button[data-v="${v}"]')`;
async function key(k) {
  const code = { Enter: 13, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[k];
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(k === 'Enter' ? { text: '\r' } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
}
async function waitFor(expr, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(100); } return false; }

await send('Runtime.enable');
await send('Page.enable');

// 1. Against Claude. I put the first coin down, and Claude chooses a side.
await open();
ok((await game()).moves.length <= 1, 'a fresh visit starts a new game (Claude may have put down the first coin)');
await click(button('opp', 'easy'));
await click(button('cutsel', 'you'));
ok((await text('#turn')).includes('Put down the first coin'), 'when I cut, the panel asks me for the first coin');
await hover('d4');
ok(await ev(`document.querySelectorAll('#board use').length > 0`), 'hovering an empty space shows a ghost coin');
await click(cellSel('d4'));
ok((await game()).moves[0] === 'd4', 'clicking places the first coin');
ok(await waitFor('window.__game().human > 0'), 'Claude chooses a side');
const want = await ev(`Shade.OPENING[${idx('d4')}] > .5 ? 2 : 1`);
ok((await game()).human === want, `and takes Heads only when the table says Heads is better (${want === 2 ? 'it did' : 'it didn\u2019t'})`);
ok(await waitFor(`window.__game().human === 2 ? window.__game().moves.length === 1 : window.__game().moves.length === 2`), 'Tails moves next (me, or Claude)');
if ((await game()).human === 2) { await click(cellSel('b2')); ok(await waitFor('window.__game().moves.length === 3'), 'Claude replies to my move'); }
else ok((await text('#turn')).includes('Your move'), 'Claude played Tails, and now it is my move');
const before = (await game()).moves.length;
await click(cellSel('d4'));
ok((await game()).moves.length === before, 'clicking a taken space does nothing');
await click('document.getElementById("undo")');
const u = await game();
ok(u.moves.length === 0 && u.human === 0, 'undo goes back as far as my first coin, and the choice with it');

// Claude cuts, and I choose.
await click(button('cutsel', 'claude'));
ok(await waitFor('window.__game().moves.length === 1'), 'when Claude cuts, it puts down a first coin');
ok(await ev(`!document.getElementById('choose').hidden`), 'and I get to choose a side');
const cut = (await game()).moves[0];
ok(Math.abs(await ev(`Shade.OPENING[${idx(cut)}]`) - .5) < .15, `Claude cut somewhere close to even (${cut})`);
await click(`document.querySelector('#choose button[data-v="2"]')`);
ok((await game()).human === 2 && (await text('#turn')).includes('Your move'), 'choosing Tails makes it my move');
await click('document.getElementById("undo")');
ok((await game()).moves.length === 1 && (await game()).human === 0, 'nothing to undo yet but the choice itself');
await click(`document.querySelector('#choose button[data-v="1"]')`);
ok(await waitFor('window.__game().moves.length === 2'), 'choosing Heads means Claude, as Tails, moves next');

// 2. Two people at one screen, with a capture. Round 0: shadows fall the first way.
await click(button('opp', 'friend'));
ok(await ev(`getComputedStyle(document.getElementById('cutfield')).display === 'none'`), 'the side picker hides for two players');
ok(await ev(`getComputedStyle(document.getElementById('choose')).display === 'none'`), 'and so do the choice buttons');
// Heads plays a1, Tails plays d4, then Heads plays the space whose shadow (in round 1, the third move) falls on d4.
const S = await ev(`(() => { const d = Shade.shadowDir(Shade.roundOf(2)); return [Shade.DQ[d], Shade.DR[d]]; })()`);
const nm = (q, r) => 'abcdefg'[q] + (r + 1);
const tq = 3, tr = 3, hq = tq - S[0], hr = tr - S[1];
await click(cellSel('a1'));                       // Heads somewhere harmless
await click(cellSel(nm(tq, tr)));                 // Tails
await click(cellSel(nm(hq, hr)));                 // Heads, sunward of the tail
const g2 = await game();
ok(g2.moves.length === 3, 'two players can alternate');
// Work out from the engine what should have happened, and compare with the move list.
const expect = await ev(`(() => { const B = Shade.board(7), s = Shade.start(B); let f = -1; for (const m of ${JSON.stringify(g2.moves)}) f = Shade.play(B, s, (+m.slice(1) - 1) * 7 + 'abcdefg'.indexOf(m[0])); return f; })()`);
const listed = await text('#moves');
ok(expect === idx('d4') && listed.includes('turns d4 over'), 'a coin put down sunward of a tail turns it over, and the list says so');
await sleep(900);
ok((await game()).faces[idx('d4')] === 'H', 'and the coin on the board shows heads once it has turned');

// 3. A whole game to a finish, then reload keeps it.
await click('document.getElementById("new")');
// a real game, played out by the page's own engine
const played = await ev(`(() => { const B = Shade.board(7), s = Shade.start(B), m = []; while (!s.winner) { const c = Shade.think(B, s, { iters: 3000 }).mv; m.push(c); Shade.play(B, s, c); } return { m: m.map(i => 'abcdefg'[i % 7] + ((i / 7 | 0) + 1)), w: s.winner }; })()`);
const seq = played.m;
for (const m of seq) await click(cellSel(m));
const g3 = await game();
ok(g3.winner === played.w && g3.moves.length === seq.length, `a full game (${seq.length} moves) ends with the right winner`);
ok((await text('#turn')).startsWith(played.w === 1 ? 'Heads wins' : 'Tails wins'), 'the panel says who won');
ok(await ev(`document.querySelectorAll('#board polyline').length >= 6`), 'the winning chain is drawn');
await click(cellSel('d5'));
ok((await game()).moves.length === seq.length, 'no moves after the game is over');
await open();
ok((await game()).moves.length === seq.length && (await game()).winner === played.w, 'reloading keeps the finished game');

// 4. Winning against Claude counts, and undoing it uncounts.
await ev(`localStorage.setItem('place-in-the-sun:game', JSON.stringify({ moves: ${JSON.stringify(seq.slice(0, -1).map(idx))}, human: ${played.w}, cutter: 'you', opp: 'easy', counted: false })); localStorage.setItem('place-in-the-sun:opp', '"easy"')`);
await open();
ok((await text('#turn')).includes('Your move'), 'a saved game against Claude resumes on my move');
await click(cellSel(seq[seq.length - 1]));
ok((await text('#turn')).startsWith('You win'), 'winning says so');
ok((await text('#tally')).includes('you 1'), 'and the tally counts it');
await click('document.getElementById("undo")');
ok(!(await text('#tally')).includes('you 1'), 'undoing the winning move takes it off the tally');

// 5. Keys.
await click(button('opp', 'friend'));
await click('document.getElementById("new")');
await ev(`document.getElementById('board').focus()`);
await key('ArrowLeft'); await key('ArrowUp'); await key('Enter');   // a new game puts the cursor on d4
ok((await game()).moves[0] === 'c3', 'arrow keys and Enter place a coin');

// 6. Phone: the first tap shows the shadow, the second places.
await open(true);
await click('document.getElementById("new")');
await tap(cellSel('e5'));
ok((await game()).moves.length === 0 && (await text('#note')).includes('Tap again'), 'on a phone, the first tap only previews');
await tap(cellSel('e5'));
ok((await game()).moves[0] === 'e5', 'and the second tap places');
await tap(cellSel('b2')); await tap(cellSel('c2'));
ok((await game()).moves.length === 1, 'tapping a different space moves the preview instead of placing');
ok(await ev(`document.documentElement.scrollWidth <= innerWidth`), 'nothing scrolls sideways on a phone');

ok(errors.length === 0, 'no errors in the console' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all passed');
// Close the browser itself. Killing the snap's wrapper process leaves Chromium running on the port,
// and the next run would quietly connect to it, old localStorage and all.
await send('Browser.close').catch(() => {});
await sleep(500);
sock.close(); proc.kill();
fs.rmSync(PROFILE, { recursive: true, force: true });
process.exit(fails ? 1 : 0);
