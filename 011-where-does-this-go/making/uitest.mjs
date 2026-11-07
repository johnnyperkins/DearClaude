// Use the page like a person: click and tap the controls, then watch what the singers and the score do.
// Built on 008's uitest: a throwaway profile, a free port checked first, and Browser.close at the end.
// usage: node uitest.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 9336;
const PROFILE = process.env.HOME + '/snap/chromium/common/claude-prof-test-' + process.pid;
const PAGE = new URL('../where-does-this-go.html', import.meta.url).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(PROFILE, { recursive: true, force: true });

if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) { console.log(`something is already on port ${PORT}`); process.exit(2); }
spawn('chromium', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1280,900', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
await send('Runtime.enable');

let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

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
async function click(sel) {
  const p = await centre(sel);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
}
async function tap(sel) {
  const p = await centre(sel);
  for (const type of ['touchStart', 'touchEnd']) await send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p[0], y: p[1] }] });
}
const q = s => `document.querySelector(${JSON.stringify(s)})`;
const jobs = () => ev(`[...document.querySelectorAll('.job')].map(j => j.innerText.replace(/\\s+/g, ' ').trim()).join(' | ')`);
const lit = () => ev(`[...document.querySelectorAll('.head')].filter(h => h.style.fill).map(h => h.dataset.line + ':' + h.dataset.i + '=' + h.style.fill).join(' ')`);
const cursorsOn = () => ev(`[...document.querySelectorAll('.cursor')].filter(c => c.getAttribute('opacity') === '1').length`);
const state = () => ev(`playing && playing.ctx ? playing.ctx.state : 'none'`);

// --- desktop: press Sing and watch part 1 come in after the count-in
await open();
ok(await ev(`document.querySelectorAll('#score svg').length`) === 4, 'four systems on a wide screen');
ok((await jobs()) === 'A ready | B ready | C ready | D ready', 'before singing, four singers ready: ' + await jobs());
await click(q('#go'));
await sleep(400);
ok(await state() === 'running', 'audio is running after a click');
ok((await ev(q('#golabel') + '.textContent')) === 'Stop', 'the button says Stop');
await sleep(2600);   // past the two-beat count-in plus a little
const j1 = await jobs();
ok(/^A washing \| B waiting \| C waiting \| D waiting$/.test(j1), 'part 1 is washing, the rest wait: ' + j1);
ok(await cursorsOn() === 1, 'one cursor showing');
const l1 = await lit();
ok(/^0:\d+=var\(--v1\)$/.test(l1), 'one note lit on line 1 in part 1\'s colour: ' + l1);
// part 2 comes in when part 1 reaches line 2: 4 bars = 8 beats of 0.909 s
await sleep(6600);
const j2 = await jobs();
ok(/^A drying \| B washing/.test(j2), 'part 1 has moved on to drying and part 2 is washing: ' + j2);
ok(await cursorsOn() === 2, 'two cursors showing');

// --- take C's part while singing: it restarts with C marked as yours, then take D's as well
await click(`document.querySelectorAll('.job')[2]`);
await sleep(500);
ok(/C [a-z ]+you/i.test(await jobs()), 'C is marked as you: ' + await jobs());
ok(await state() === 'running', 'still singing after the change');
await click(`document.querySelectorAll('.job')[3]`);
await sleep(300);
ok(/C [a-z ]+you \| D [a-z ]+you/i.test(await jobs()), 'two parts can be yours: ' + await jobs());
await click(`document.querySelectorAll('.job')[2]`);
await sleep(300);
ok(!/C [a-z ]+you/i.test(await jobs()) && /D [a-z ]+you/i.test(await jobs()), 'pressing C again gives it back: ' + await jobs());

// --- fewer singers than your part takes you out of it
await click(`document.querySelectorAll('#voices button')[1]`);
await sleep(300);
ok(await ev(`opts.mine.size`) === 0, 'two singers: D is gone, and you with it');
ok(await ev(`document.querySelectorAll('.job').length`) === 2, 'and only A and B are shown');
ok(await ev(`[...document.querySelectorAll('#voices button')].map(b => b.getAttribute('aria-pressed')).join()`) === 'false,true,false,false', 'and two singers stays selected');

// --- stop
await click(q('#go'));
await sleep(500);
ok((await ev(q('#golabel') + '.textContent')) === 'Sing', 'Stop puts the button back');
ok(await cursorsOn() === 0 && (await lit()) === '', 'and clears the score');
ok(!(await ev(`document.documentElement.scrollWidth > innerWidth`)), 'no sideways scroll on desktop');

// --- phone: tap Sing
await open(true);
ok(await ev(`document.querySelectorAll('#score svg').length`) === 8, 'eight systems on a phone');
ok(!(await ev(`document.documentElement.scrollWidth > innerWidth`)), 'no sideways scroll on a phone');
await tap(q('#go'));
await sleep(3000);
ok(await state() === 'running', 'a tap starts the singing on a phone');
ok(/^A washing/.test(await jobs()), 'part 1 is washing on the phone too');
await tap(q('#go'));
await sleep(400);
ok((await ev(q('#golabel') + '.textContent')) === 'Sing', 'a second tap stops it');

ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
await send('Browser.close').catch(() => {});
await sleep(500);
fs.rmSync(PROFILE, { recursive: true, force: true });
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
