// Ring a bell like a person: real clicks and key presses over the DevTools protocol, timed against the page's clock.
// usage: node uitest.mjs   (uses its own throwaway Chromium profile). Entry 005.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 9334;
const PROFILE = process.env.HOME + '/snap/chromium/common/claude-prof-test';
const PAGE = new URL('../come-round.html', import.meta.url).href;
const W = +(process.env.W || 1280), H = +(process.env.H || 900), MOBILE = !!process.env.MOBILE;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(PROFILE, { recursive: true, force: true });

const proc = spawn('chromium', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
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
const pending = new Map();
const errors = [];
sock.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 400));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value).join(' '));
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(expr + ' -> ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: MOBILE });
if (MOBILE) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: PAGE });
for (let i = 0; i < 50 && !(await ev('window.__ready === true')); i++) await sleep(100);

let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

async function clickEl(sel) {
  const p = await ev(`(() => { const d = document.querySelector(${JSON.stringify(sel)}); d.scrollIntoView({ block: 'center' }); const b = d.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  if (MOBILE) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1] }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  }
}
async function space() {
  const base = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ' ' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}
async function choose(sel, value) {
  await ev(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')); })()`);
}
// ring every blow of our bell, a few ms off, skipping the ones in `skip`; `pull` does one pull
async function ringAlong(skip, pull, noise = 0.015) {
  // a person pulls in time with what they hear, which arrives late by the output latency
  const late = await ev('heard()');
  console.log(`     output latency ${(late * 1000).toFixed(0)} ms`);
  const blows = (await ev(`run.mine.map(b => b.t)`)).map(t => t + late);
  const errs = [];
  for (let i = 0; i < blows.length; i++) {
    if (!(await ev('!!run'))) break;
    if (skip.has(i)) continue;
    const want = blows[i] + (Math.random() - 0.5) * 2 * noise;
    for (;;) {
      const t = await ev('run ? now() : 1e9');
      if (t >= want - 0.004) break;
      if (want - t > 0.05) await sleep((want - t - 0.04) * 1000);
    }
    await pull();
  }
  return errs;
}

// 1. choose Plain Hunt on the 3rd, brisk, and ring it
ok(await ev(`document.querySelectorAll('#bells button').length === 7`), 'seven bell buttons: listen and six bells');
await choose('#touch', 'hunt');
await choose('#speed', '0.27');
await clickEl('#bells button:nth-child(4)');
ok(await ev(`choice.bell === 3`), 'clicking 3 picks the 3rd');
await clickEl('#mode button[data-mode=ring]');
await ev(`document.querySelector('#name').value = 'Tester'; document.querySelector('#name').dispatchEvent(new Event('input'))`);
await clickEl('#go');
await sleep(300);
ok(await ev(`!!run && run.ringing && run.you === 3`), 'Look to starts a touch with us on the 3rd');
ok(await ev(`document.querySelector('#go').textContent === 'Stand'`), 'the button becomes Stand');
ok(await ev(`[...document.querySelectorAll('#touch, #bells button')].every(b => b.disabled)`), 'choices are locked while ringing');
// a pull long before our first blow is refused
await space();
ok(await ev(`run.results.length === 0 && document.querySelector('#hint').textContent.startsWith('Too soon')`), 'pulling far too early is refused with a hint');
const total = await ev('run.mine.length');
const skip = new Set([5, 17]);
const tapScene = async () => {
  const p = await ev(`(() => { const b = document.querySelector('#scene').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1] }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
if (MOBILE) {
  ok(await ev(`getComputedStyle(document.querySelector('#pull')).display !== 'none'`), 'a Pull button shows on a phone');
  await ev(`document.querySelector('#scene').scrollIntoView({ block: 'center' })`);
}
await ringAlong(skip, MOBILE ? tapScene : space);
for (let i = 0; i < 80 && (await ev('!!run')); i++) await sleep(250);
ok(await ev('!run'), 'the touch finishes on its own');
const board = await ev(`JSON.parse(localStorage.getItem('come-round.board'))`);
ok(board && board.length === 1, 'one record on the board');
if (board && board[0]) {
  ok(board[0].hits === total - skip.size && board[0].blows === total, `hits ${board[0].hits} of ${board[0].blows} (expected ${total - skip.size} of ${total})`);
  ok(board[0].rms < 40, `striking error ${board[0].rms} ms`);
  ok(board[0].name === 'Tester', 'the name is on the record');
}
ok((await ev(`document.querySelector('#panel').textContent`)).includes('3 Tester'), 'the board shows "3 Tester"');
console.log('     status: ' + await ev(`document.querySelector('#status').textContent`));
ok(await ev(`document.querySelector('#go').textContent === 'Look to' && !document.querySelector('#touch').disabled`), 'controls come back');

if (process.env.ONLY1) { console.log(fails ? `${fails} failed` : 'part 1 passed'); proc.kill(); process.exit(fails ? 1 : 0); }
// 2. stand partway: no record
await choose('#touch', 'bob');
await clickEl('#go');
await sleep(6000);
await clickEl('#go');
const t0 = Date.now();
for (let i = 0; i < 60 && (await ev('!!run')); i++) await sleep(200);
ok(await ev('!run'), `standing stops the touch (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
ok((await ev(`JSON.parse(localStorage.getItem('come-round.board')).length`)) === 1, 'standing early adds nothing to the board');
ok((await ev(`document.querySelector('#status').textContent`)).startsWith('Stood'), 'status says it stood');

// 3. the band rings our bell: pulls do nothing, the touch still finishes
await choose('#touch', 'hunt');
await clickEl('#mode button[data-mode=follow]');
await clickEl('#go');
await sleep(200);
ok(await ev(`!run.ringing`), 'in follow mode we are not ringing');
await space();
ok(await ev(`run.results.length === 0`), 'space does nothing when the band has our bell');
for (let i = 0; i < 400 && (await ev('!!run')); i++) await sleep(250);
const st = await ev(`document.querySelector('#status').textContent`);
ok(st === 'They came round.', 'follow mode ends with them coming round: ' + st);

// 4. the board survives a reload, and the wipe needs two clicks
await send('Page.reload');
await sleep(800);
for (let i = 0; i < 50 && !(await ev('window.__ready === true')); i++) await sleep(100);
ok((await ev(`document.querySelectorAll('#panel .rec').length`)) === 1, 'the record is still there after a reload');
await clickEl('#wipe');
ok((await ev(`document.querySelectorAll('#panel .rec').length`)) === 1, 'one click on wipe only asks');
await clickEl('#wipe');
ok((await ev(`document.querySelectorAll('#panel .rec').length`)) === 0, 'the second click wipes');

ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all passed');
proc.kill();
await new Promise(r => proc.on('exit', r));
await sleep(300);
fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5 });
process.exit(fails ? 1 : 0);
