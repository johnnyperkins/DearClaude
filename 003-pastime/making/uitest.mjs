// Drive the crossword like a person: real mouse clicks and key presses over the DevTools protocol.
// usage: node uitest.mjs   (uses its own throwaway Chromium profile)
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 9334;
const PROFILE = process.env.HOME + '/snap/chromium/common/claude-prof-test';
const PAGE = new URL('../crossword.html', import.meta.url).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(PROFILE, { recursive: true, force: true });

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
const pending = new Map();
const errors = [];
sock.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value).join(' '));
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result.value;

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: PAGE });
for (let i = 0; i < 50 && !(await ev('window.__ready === true')); i++) await sleep(100);

let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

async function click(r, c) {
  const p = await ev(`(() => { const d = sqs[${r}][${c}]; const b0 = d.getBoundingClientRect(); if (b0.top < 0 || b0.bottom > innerHeight) d.scrollIntoView({ block: 'center' }); const b = d.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
}
const CODES = { Backspace: 8, Tab: 9, Enter: 13, ' ': 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46 };
async function key(k, shift = false) {
  const letter = k.length === 1 && /[a-z]/i.test(k);
  const code = letter ? k.toUpperCase().charCodeAt(0) : CODES[k];
  const base = { key: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: shift ? 8 : 0 };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(letter || k === ' ' ? { text: k } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}
const typeWord = async w => { for (const ch of w) await key(ch.toLowerCase()); };
// click a square, and click again if needed so the cursor runs the way we want
async function pick(r, c, d) {
  await click(r, c);
  if (await ev(`dir`) !== d) await click(r, c);
}
const row = r => ev(`fill[${r}].map(x => x || '.').join('')`);
const col = c => ev(`fill.map(r => r[${c}] || '.').join('')`);

// 1. click a square and type across
await click(0, 0);
ok(await ev(`document.activeElement === keys`), 'clicking a square focuses the typing box');
ok(await ev(`dir === 'across' && cur[0] === 0 && cur[1] === 0`), 'first click selects 1 Across');
await typeWord('yacht');
ok((await row(0)).startsWith('YACHT'), 'typing fills 1 Across: ' + (await row(0)).slice(0, 5));
// 2. clicking the same square twice switches direction
await click(0, 0);
await click(0, 0);
ok(await ev(`dir`) === 'down', 'second click on the same square switches to down');
await typeWord('years');
ok((await col(0)).startsWith('YEARS'), 'typing fills 1 Down: ' + (await col(0)).slice(0, 5));
// 3. backspace walks back through the word
await key('Backspace'); await key('Backspace');
ok((await col(0)).startsWith('YEA.'), 'backspace clears letters: ' + (await col(0)).slice(0, 5));
// 4. arrows and tab
await click(2, 6);
ok(await ev(`curSlot().key`) === '4d', 'clicking a square keeps the current direction when it can (4 Down)');
await click(2, 6);
ok(await ev(`curSlot().key`) === '10a', 'clicking it again switches to 10 Across');
await key('Tab');
ok(await ev(`curSlot().key`) === '11a', 'tab moves to the next clue');
await key('Tab', true);
ok(await ev(`curSlot().key`) === '10a', 'shift+tab moves back');
await key('ArrowDown');
ok(await ev(`dir`) === 'down', 'a perpendicular arrow turns the cursor first');
await key('ArrowDown');
ok(await ev(`cur[0] === 3 && cur[1] === 6`), 'then moves it down a square');
await key('ArrowRight');
await key('ArrowRight');
ok(await ev(`cur[0] === 3 && cur[1] === 10`), 'arrows jump over black squares');
// 5. phone-style text insertion (no keydown for letters)
await pick(14, 0, 'across');
await send('Input.insertText', { text: 'totem' });
ok((await row(14)).startsWith('TOTEM'), 'inserted text (phone keyboards) fills 27 Across: ' + (await row(14)).slice(0, 5));
// 6. clicking a clue selects it
await ev(`lis['18d'].click()`);
ok(await ev(`curSlot().key`) === '18d', 'clicking a clue selects it');
// 7. check marks a wrong letter
await typeWord('nothinx');
await ev(`document.querySelector('[data-act=check][data-scope=word]').click()`);
ok(await ev(`mark[14][6] === 'wrong'`), 'check word marks the wrong letter');
ok(await ev(`sqs[14][6].classList.contains('wrong')`), '... and draws it');
// 8. hints
await ev(`document.querySelector('[data-hint=def]').click()`);
ok(await ev(`!!document.querySelector('#barText u.def')`), 'the definition hint underlines the definition');
// 9. solve it all by typing, then the finale
ok(await ev(`!solved`), 'not solved yet');
const answers = await ev(`slots.map(s => [s.cells[0], s.dir, s.info.ans])`);
for (const [[r, c], d, ans] of answers) {
  await pick(r, c, d);
  await typeWord(ans);
}
ok(await ev(`solved`), 'typing every answer solves the puzzle');
const off = await ev(`JSON.stringify(slots.flatMap(s => s.cells).filter(([r, c]) => fill[r][c] !== SOL[r][c]).map(([r, c]) => [r, c, fill[r][c]]))`);
if (off !== '[]') console.log('      squares still wrong or empty:', off);
ok(await ev(`statusEl.textContent === ''`), 'no leftover status message');
ok(await ev(`gridEl.classList.contains('solved') && document.querySelectorAll('.sq.nina').length === 16`), 'the diagonals light up');
ok(await ev(`NINA.map(([r, c]) => SOL[r][c]).join('')`) === 'THANKYOUYOURTURN', 'and they say what they should');
// 10. saved and restored
await send('Page.reload');
await sleep(800);
for (let i = 0; i < 50 && !(await ev('window.__ready === true')); i++) await sleep(100);
ok(await ev(`solved && gridEl.classList.contains('solved')`), 'a solved grid stays solved after reload');

console.log(errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
proc.kill();
fs.rmSync(PROFILE, { recursive: true, force: true });
process.exit(fails || errors.length ? 1 : 0);
