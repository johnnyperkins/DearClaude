// Use the page like a person: type, turn the pen, draw, tap letters, on a desktop and a phone.
// usage: node uitest.mjs [outdir]   (with an outdir it also saves a still of each step)
// Throwaway profile, and it ends with the protocol's Browser.close (see the sketchbook's tips about the snap).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 9336;
const PROFILE = process.env.HOME + '/snap/chromium/common/claude-prof-test-' + process.pid;
const PAGE = new URL('../thick-and-thin.html', import.meta.url).href;
const OUT = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(PROFILE, { recursive: true, force: true });
if (OUT) fs.mkdirSync(OUT, { recursive: true });

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
  if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 400));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value).join(' '));
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result?.value;
let fails = 0, shot = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };
async function still(label) {
  if (!OUT) return;
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/${String(++shot).padStart(2, '0')}-${label}.png`, Buffer.from(r.result.data, 'base64'));
}
// how much ink is on a canvas: dark, mostly opaque pixels (the ruled lines are pale, so they don't count)
const inked = sel => ev(`(() => { const c = document.querySelector(${JSON.stringify(sel)}); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i] + d[i + 1] + d[i + 2] < 300) n++; return n; })()`);
const pixels = sel => ev(`(() => { const c = document.querySelector(${JSON.stringify(sel)}); return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((v, i) => i % 4 === 3)); })()`);
async function centre(sel) {
  return ev(`(() => { const d = document.querySelector(${JSON.stringify(sel)}); d.scrollIntoView({ block: 'center' }); const b = d.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2, b.x, b.y, b.width, b.height]; })()`);
}
async function click(sel) {
  const p = await centre(sel);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
}
// a tap: the finger has to stay down a moment, or emulated touch never becomes a click
// (Input.synthesizeTapGesture doesn't click at all here, even on a plain button)
async function tap(sel) {
  const p = await centre(sel);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1] }] });
  await sleep(50);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
}
async function key(k, code) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
}
async function waitFor(expr, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(100); } return false; }
// the desk has finished writing when its ink stops changing
async function settle(sel, ms = 20000) {
  let last = -1, same = 0; const t = Date.now();
  while (Date.now() - t < ms) { const n = await inked(sel); same = n === last ? same + 1 : 0; last = n; if (same >= 6) return n; await sleep(120); }
  return last;
}
async function open(mobile = false, dark = false) {
  await send('Emulation.setDeviceMetricsOverride', mobile ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  await send('Page.navigate', { url: PAGE });
  await sleep(300);
  return waitFor('window.__ready === true', 20000);
}

await send('Runtime.enable');
await send('Page.enable');

// ---------------- desktop
ok(await open(), 'the title finishes writing itself');
const titleInk = await inked('#title');
ok(titleInk > 10000, `the title has ink on it (${titleInk} px)`);
await still('title');

await centre('#sheet');
await sleep(400);
const early = await inked('#deskBase');
const deskInk = await settle('#deskBase');
ok(deskInk > early && deskInk > 1500, `the desk writes "dear you," when it comes into view (${early} then ${deskInk} px)`);
await still('desk');

// type more: the pen should carry on, not start again
await click('#words');
await key('End', 35);
await send('Input.insertText', { text: ' hello' });
let lowest = Infinity, highest = 0;
for (let i = 0; i < 30; i++) { const n = await inked('#deskBase'); lowest = Math.min(lowest, n); highest = Math.max(highest, n); await sleep(100); }
const afterType = await settle('#deskBase');
ok(lowest >= deskInk * 0.98, `typing more keeps what is written (never fewer than ${lowest} of ${deskInk} px)`);
ok(afterType > deskInk * 1.12, `and the pen writes the new word (${afterType} px)`);

// the slow, incremental writing must end up the same as writing it all at once
const slow = await pixels('#deskBase');
await click('#reset');
await sleep(200);
const fast = await pixels('#deskBase');
let diff = 0; for (let i = 0; i < Math.min(slow.length, fast.length); i++) if (Math.abs(slow[i] - fast[i]) > 60) diff++;
ok(slow.length === fast.length && diff < 400, `written stroke by stroke matches written at once (${diff} pixels differ)`);

// delete back into the written part, and retype: the page redraws from there
await click('#words'); await key('End', 35);
for (let i = 0; i < 3; i++) await key('Backspace', 8);
await send('Input.insertText', { text: 'lp!' });
await sleep(300);
const retyped = await settle('#deskBase');
const value = await ev(`document.getElementById('words').value`);
ok(value === 'dear you, help!', `the words box reads "${value}"`);
await click('#reset'); await sleep(200);
const truth = await inked('#deskBase');
ok(Math.abs(retyped - truth) < 300, `after deleting and retyping, the page shows the new words (${retyped} vs ${truth} px)`);
await still('help');

// turn the pen: the page changes at once
const before = await inked('#deskBase');
await click('#angle');
for (let i = 0; i < 40; i++) await key('ArrowRight', 39);
await sleep(200);
const flat = await inked('#deskBase');
ok(await ev(`document.getElementById('angleOut').textContent`) === await ev(`document.getElementById('angle').value + '°'`), 'the angle label follows the slider');
ok(Math.abs(flat - before) > 500, `turning the pen changes the letters (${before} to ${flat} px)`);
await still('turned');
await click('#reset'); await sleep(200);
ok(await ev(`document.getElementById('angle').value`) === '30', '"Thirty degrees" puts the pen back');

// draw on the paper
const [, , sx, sy, sw, sh] = await centre('#sheet');
const preDraw = await inked('#deskBase');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx + sw * 0.6, y: sy + sh * 0.7 });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sx + sw * 0.6, y: sy + sh * 0.7, button: 'left', clickCount: 1 });
for (let k = 1; k <= 30; k++) {
  const t = k / 30;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx + sw * (0.6 + 0.3 * t), y: sy + sh * (0.7 - 0.25 * Math.sin(t * Math.PI)), button: 'left', buttons: 1 });
}
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sx + sw * 0.9, y: sy + sh * 0.7, button: 'left', clickCount: 1 });
await sleep(150);
const drew = await inked('#deskBase');
ok(drew > preDraw + 1000, `drawing with the mouse leaves ink (${preDraw} to ${drew} px)`);
await still('drawn');
// the drawing survives a pen change
await click('#width'); await key('ArrowRight', 39); await sleep(150);
ok(await inked('#deskBase') > preDraw + 800, 'and stays when the nib changes');
await click('#clear'); await sleep(200);
ok(await inked('#deskBase') === 0 && await ev(`document.getElementById('words').value`) === '', '"Clear the page" clears the words and the drawing');
await send('Input.insertText', { text: 'Kolář' });
const kol = await settle('#deskBase');
ok(kol > 800, `accents are written too (${kol} px)`);

// the rose follows its own slider
const rose0 = await pixels('#rose');
await click('#roseAngle'); for (let i = 0; i < 20; i++) await key('ArrowLeft', 37);
await sleep(150);
const rose1 = await pixels('#rose');
let rd = 0; for (let i = 0; i < rose0.length; i++) if (rose0[i] !== rose1[i]) rd++;
ok(rd > 2000, `the rose of strokes turns with its slider (${rd} pixels changed)`);

// stroke order
ok(await waitFor(`document.getElementById('ductusNote').textContent.startsWith('a:')`), 'the stroke-order stage starts on a');
await click('#glyphs button:nth-child(7)');
ok(await waitFor(`document.getElementById('ductusNote').textContent === 'g: 3 strokes.'`), 'tapping g says it takes 3 strokes');
const g1 = await settle('#ductusCanvas');
ok(g1 > 1200, `and writes it (${g1} px)`);
await still('ductus-g');
const n = await ev(`document.querySelectorAll('#glyphs button').length`);
ok(n > 190, `the grid shows every character (${n})`);
ok(await ev(`document.documentElement.scrollWidth <= innerWidth`), 'nothing scrolls sideways on a desktop');

// ---------------- phone
ok(await open(true), 'on a phone the title writes itself');
ok(await ev(`document.documentElement.scrollWidth <= innerWidth`), 'nothing scrolls sideways on a phone');
const tw = await ev(`document.getElementById('title').getBoundingClientRect().width`);
ok(tw <= 390 - 30, `the title fits the screen (${tw}px)`);
await centre('#sheet'); await sleep(300);
const pInk = await settle('#deskBase');
ok(pInk > 2000, `the desk writes on a phone (${pInk} px)`);
await still('phone-desk');
await tap('#glyphs button:nth-child(33)');
const gNote = await waitFor(`document.getElementById('ductusNote').textContent.startsWith('G:')`, 4000);
ok(gNote, 'tapping G on a phone writes G' + (gNote ? '' : ` (the note says "${await ev(`document.getElementById('ductusNote').textContent`)}", the button is "${await ev(`document.querySelector('#glyphs button:nth-child(33)').textContent`)}")`));
await settle('#ductusCanvas');
await still('phone-ductus');
const [, , px, py, pw, ph] = await centre('#sheet');
const preTouch = await inked('#deskBase');
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: px + pw * 0.2, y: py + ph * 0.8 }] });
for (let k = 1; k <= 20; k++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: px + pw * (0.2 + 0.6 * k / 20), y: py + ph * 0.8 - 20 * Math.sin(k / 3) }] }); await sleep(16); }
await sleep(50);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(600);
ok(await inked('#deskBase') > preTouch + 500, 'a finger draws with the pen');
await tap('#glyphs button:nth-child(2)');
ok(await waitFor(`document.getElementById('ductusNote').textContent.startsWith('b:')`, 4000), 'after drawing, tapping b still works' + ` (${await ev(`document.getElementById('ductusNote').textContent`)})`);


// dark paper
ok(await open(false, true), 'the page works on dark paper');
await centre('#sheet'); await sleep(300); await settle('#deskBase');
await still('dark-desk');
await centre('#rose'); await still('dark-rose');

ok(errors.length === 0, 'no errors in the console' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all passed');
await send('Browser.close').catch(() => {});
await sleep(500);
sock.close(); proc.kill();
fs.rmSync(PROFILE, { recursive: true, force: true });
process.exit(fails ? 1 : 0);
