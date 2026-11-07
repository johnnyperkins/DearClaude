// Type into the page like a person, over the DevTools protocol, in a throwaway profile.
// Checks saving across a reload, undo, restart, the quick buttons and a phone layout.
// usage: node uitest.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 9341;
const PROFILE = process.env.HOME + '/snap/chromium/common/claude-prof-test-' + process.pid;
const PAGE = new URL('../proof.html', import.meta.url).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(PROFILE, { recursive: true, force: true });
if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) { console.log(`something is already on port ${PORT}`); process.exit(2); }
spawn('chromium', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 100 && !ws; i++) {
  try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = list.find(t => t.type === 'page'); if (p) ws = p.webSocketDebuggerUrl; } catch {}
  await sleep(200);
}
const sock = new WebSocket(ws);
await new Promise(r => (sock.onopen = r));
let id = 0; const pending = new Map(), errors = [];
sock.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value).join(' '));
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result.result.value;
await send('Runtime.enable');
let fails = 0;
const ok = (c, what) => { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) fails++; };

async function open(url, mobile) {
  await send('Emulation.setDeviceMetricsOverride', mobile ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  for (let i = 0; i < 50 && !(await ev('window.__ready === true')); i++) await sleep(100);
}
async function type(text) {
  await ev(`document.getElementById('input').focus()`);
  await send('Input.insertText', { text });
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: type === 'keyDown' ? '\r' : undefined });
  await sleep(60);
}
const lastTurn = () => ev(`document.querySelector('#log .turn:last-child').innerText`);
const status = () => ev(`document.querySelector('.bar').innerText`);

await open(PAGE);
ok((await ev(`document.querySelectorAll('#log .turn').length`)) === 1, 'a new game shows the opening');
ok(await ev(`document.activeElement.id === 'input' || !matchMedia('(pointer: fine)').matches`), 'the input has focus when there is a mouse');
await type('turn off the alarm');
ok(/silence is enormous/.test(await lastTurn()), 'typing a command and pressing Enter works');
await type('e'); await type('d');
ok(/Bakehouse/.test(await status()), 'status bar shows the room');
await type('read note');
ok(await ev(`!!document.querySelector('#log .turn:last-child p.hand')`), "Win's note is set as handwriting");
ok(!/\u2014/.test(await ev(`document.body.innerText`)), 'no em dashes on the page');
await type('turn on oven');
ok(/2:04/.test(await status()), 'the clock moved on to 2:04 (reading is free)');
// arrow-up history
await ev(`document.getElementById('input').focus()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 });
ok((await ev(`document.getElementById('input').value`)) === 'turn on oven', 'arrow up brings back the last command');
await ev(`document.getElementById('input').value = ''`);
// reload: the game should still be there
await open(PAGE);
ok(/Bakehouse/.test(await status()) && /2:04/.test(await status()), 'after a reload the game carries on where it was');
ok((await ev(`document.querySelectorAll('#log .turn').length`)) === 6, 'and the transcript is back');
await type('undo');
ok(/Taken back/.test(await lastTurn()) && /2:03/.test(await status()), 'undo goes back a move, even after a reload');
await ev(`document.querySelector('.quick button[data-c=inventory]').click()`);
ok(/carrying|empty-handed/.test(await lastTurn()), 'the inventory button works');
await type('restart');
ok(/Starting again/.test(await lastTurn()) && /Box room/.test(await status()), 'restart starts a new game');
await type('undo');
ok(/Bakehouse/.test(await status()), 'undo after restart brings the old game back');
// the ending turns the page to morning
await open(PAGE + '?run=' + encodeURIComponent(fs.readFileSync(new URL('walk.txt', import.meta.url), 'utf8').trim().split('\n').join('|')));
ok(await ev(`document.body.classList.contains('morning')`), 'finishing the story turns the page to morning');
ok(/10 out of 10/.test(await ev(`document.body.innerText`)), 'the walkthrough scores 10 in the page too');
// phone
await open(PAGE + '?new', true);
const m = await ev(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, fs: getComputedStyle(document.getElementById('input')).fontSize })`);
ok(m.sw <= m.iw, `no sideways scroll on a phone (${m.sw} <= ${m.iw})`);
ok(parseFloat(m.fs) >= 16, `input text is ${m.fs}, big enough that phones won't zoom`);
await ev(`document.getElementById('input').focus()`);
await send('Input.insertText', { text: 'look' });
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
await sleep(100);
ok(/Box room/i.test(await lastTurn()), 'typing on a phone works');
ok(errors.length === 0, 'no errors in the console' + (errors.length ? ': ' + errors.join(' | ') : ''));

await send('Browser.close').catch(() => {});
await sleep(500);
fs.rmSync(PROFILE, { recursive: true, force: true });
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
