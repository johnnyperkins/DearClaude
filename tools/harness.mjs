// Drive headless snap Chromium over the DevTools protocol. Made for entry 002.
// FILM=<file:// url> picks the page (default: entry 002). THEME=light|dark, W, H, DPR and MOBILE=1
// set the viewport. WAIT=ms delays evalshots captures so transitions can finish.
// MEDIA=print shows the print stylesheet. NOREADY=1 is for static pages without window.__ready. The page should set
// window.__ready = true once it has drawn, and support ?t=SECONDS for stills.
//   node harness.mjs shots <outdir> <t> [t...]        stills at those times
//   node harness.mjs evalshots <outdir> 'label::js'   run js in a fresh page, then take a still
//   node harness.mjs eval '<js expression>'           evaluate in a fresh page, print the result
//   node harness.mjs audio <out.png>                  render the page's sound offline (entry 002's score, or any
//                                                     page with window.__offlineRender), draw a spectrogram, print levels
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9333;
const PROFILE = process.env.HOME + '/snap/chromium/common/claude-prof';
const FILM = process.env.FILM || new URL('../002-i-have-been-here/film.html', import.meta.url).href;
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
  const proc = spawn('chromium', [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    `--window-size=${W},${H}`, '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars',
    '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 150; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      if (list.find(t => t.type === 'page')) return proc;
    } catch {}
    await sleep(200);
  }
  throw new Error('chromium did not start');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map(), listeners = [];
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) listeners.forEach(l => l(msg));
    };
    ws.onerror = reject;
    ws.onclose = () => {   // the browser went away: fail everything still waiting instead of hanging
      for (const { rej } of pending.values()) rej(new Error('browser connection closed'));
      pending.clear();
    };
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const i = ++id;
        pending.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method, params }));
      }),
      on: l => listeners.push(l),
      close: () => ws.close(),
    });
  });
}

async function newPage(label) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  cdp.on(m => {
    if (m.method === 'Runtime.exceptionThrown') console.log(`[${label}] EXCEPTION`, JSON.stringify(m.params.exceptionDetails).slice(0, 800));
    if (m.method === 'Runtime.consoleAPICalled') console.log(`[${label}] console.${m.params.type}:`, m.params.args.map(a => a.value ?? a.description).join(' '));
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: +(process.env.DPR || 1), mobile: !!process.env.MOBILE });
  if (process.env.THEME || process.env.MEDIA) await cdp.send('Emulation.setEmulatedMedia', {
    media: process.env.MEDIA || '', features: process.env.THEME ? [{ name: 'prefers-color-scheme', value: process.env.THEME }] : [] });
  return cdp;
}

async function evalp(cdp, expression, timeoutMs = 240000) {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error('evaluate timed out: ' + expression.slice(0, 120))), timeoutMs);
  });
  const r = await Promise.race([cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }), timeout])
    .finally(() => clearTimeout(timer));   // a pending timer would keep node alive after we're done
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1500));
  return r.result.value;
}

async function load(cdp, url, timeoutMs = 180000) {
  // wait for the new document's load event so we never poll the old one
  const loaded = new Promise(res => cdp.on(m => { if (m.method === 'Page.loadEventFired') res(); }));
  await cdp.send('Page.navigate', { url });
  await loaded;
  if (process.env.NOREADY) { await sleep(500); return 0; }   // static pages that never set __ready
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await sleep(150);
    try { if (await evalp(cdp, 'window.__ready === true')) return Date.now() - t0; } catch {}
  }
  throw new Error('timeout loading ' + url);
}

async function shots(outdir, times) {
  fs.mkdirSync(outdir, { recursive: true });
  const N = Math.min(4, times.length);
  const pages = await Promise.all(Array.from({ length: N }, (_, i) => newPage('p' + i)));
  let next = 0;
  await Promise.all(pages.map(async cdp => {
    while (next < times.length) {
      const t = times[next++];
      const ms = await load(cdp, `${FILM}${FILM.includes("?") ? "&" : "?"}t=${t}`);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
      const file = path.join(outdir, `t${String(t).padStart(6, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log(`t=${t} ok (${ms} ms)`);
    }
  }));
}

const AUDIO_CHECK = `(async () => {
  const sr = 22050, t0 = performance.now();
  let buf;
  if (window.__offlineRender) buf = await window.__offlineRender(sr);   // entry 005 and later: the page renders itself
  else {
    const oac = new OfflineAudioContext(2, Math.ceil(sr * (END + 3)), sr);
    const b = makeBus(oac, 0);
    for (const e of EVENTS) e.play(oac, 0, b);
    console.log('scheduled', EVENTS.length, 'events');
    buf = await oac.startRendering();
  }
  const len = buf.length, DUR = buf.duration;
  console.log('rendered in', Math.round(performance.now() - t0), 'ms');
  const renderMs = performance.now() - t0;
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0, sum = 0;
  for (let i = 0; i < len; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; sum += (L[i] * L[i] + R[i] * R[i]) / 2; }
  const hop = sr / 10, rms = [];
  for (let s = 0; s + hop <= len; s += hop) { let q = 0; for (let i = s; i < s + hop; i++) q += (L[i] * L[i] + R[i] * R[i]) / 2; rms.push(Math.sqrt(q / hop)); }
  // spectrogram
  const Wd = 1600, Hs = 520, He = 200, cvs = document.createElement('canvas');
  cvs.width = Wd; cvs.height = Hs + He + 40;
  const g = cvs.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cvs.width, cvs.height);
  const n = 2048, img = g.createImageData(Wd, Hs);
  const win = new Float32Array(n); for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
  function fft(re, im) {
    const m = re.length;
    for (let i = 1, j = 0; i < m; i++) { let bit = m >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= m; size <<= 1) { const ang = -2 * Math.PI / size, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < m; i += size) { let cr = 1, ci = 0; for (let k = 0; k < size / 2; k++) { const a = i + k, c = a + size / 2; const xr = re[c] * cr - im[c] * ci, xi = re[c] * ci + im[c] * cr; re[c] = re[a] - xr; im[c] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
  }
  const fmin = 40, fmax = 8000;
  for (let col = 0; col < Wd; col++) {
    const s0 = Math.floor(col / Wd * (len - n));
    const re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 0; i < n; i++) re[i] = (L[s0 + i] + R[s0 + i]) * 0.5 * win[i];
    fft(re, im);
    for (let row = 0; row < Hs; row++) {
      const f = fmin * Math.pow(fmax / fmin, 1 - row / Hs), bin = Math.min(n / 2 - 1, Math.round(f / sr * n));
      const mag = Math.hypot(re[bin], im[bin]);
      const db = 20 * Math.log10(mag + 1e-9);
      const v = Math.max(0, Math.min(1, (db + 60) / 60));
      const o = (row * Wd + col) * 4;
      img.data[o] = 255 * Math.min(1, v * 1.6); img.data[o + 1] = 255 * v * v; img.data[o + 2] = 90 * v; img.data[o + 3] = 255;
    }
  }
  console.log('spectrogram done');
  g.putImageData(img, 0, 0);
  // rms (dBFS) strip
  g.strokeStyle = '#6cf'; g.beginPath();
  rms.forEach((v, i) => { const db = 20 * Math.log10(v + 1e-9); const y = Hs + 20 + He * (1 - Math.max(0, (db + 50) / 50)); const x = i / rms.length * Wd; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  g.fillStyle = '#888'; g.font = '12px monospace';
  for (let s = 0; s <= DUR; s += 10) { const x = s / (len / sr) * Wd; g.fillRect(x, Hs, 1, 12); g.fillText(s + 's', x + 2, Hs + 14); }
  for (const db of [-10, -20, -30, -40]) { const y = Hs + 20 + He * (1 - (db + 50) / 50); g.fillRect(0, y, 8, 1); g.fillText(db + ' dB', 10, y + 4); }
  return { renderMs: Math.round(renderMs), peakDb: 20 * Math.log10(peak), rmsDb: 10 * Math.log10(sum / len), loudest: 20 * Math.log10(Math.max(...rms)), png: cvs.toDataURL('image/png') };
})()`;

const [cmd, ...args] = process.argv.slice(2);
const proc = await launch();
try {
  if (cmd === 'shots') await shots(args[0], args.slice(1).map(Number));
  else if (cmd === 'audio') {
    const cdp = await newPage('audio');
    await load(cdp, FILM);
    const r = await evalp(cdp, AUDIO_CHECK);
    fs.writeFileSync(args[0], Buffer.from(r.png.split(',')[1], 'base64'));
    delete r.png;
    console.log(JSON.stringify(r, null, 1));
  } else if (cmd === 'evalshots') {
    // each arg is "label::js"; the js should draw a frame
    const outdir = args[0], jobs = args.slice(1).map(s => s.split('::'));
    fs.mkdirSync(outdir, { recursive: true });
    const pages = await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, (_, i) => newPage('p' + i)));
    let next = 0;
    await Promise.all(pages.map(async cdp => {
      while (next < jobs.length) {
        const [label, js] = jobs[next++];
        await load(cdp, FILM);
        const t0 = Date.now();
        await evalp(cdp, `(() => { if (typeof startCard !== 'undefined') startCard.style.display = 'none'; ${js}; return true; })()`);
        if (process.env.WAIT) await sleep(+process.env.WAIT);   // let transitions finish
        const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
        fs.writeFileSync(path.join(outdir, label + '.jpg'), Buffer.from(shot.data, 'base64'));
        console.log(`${label} ok (${Date.now() - t0} ms)`);
      }
    }));
  } else if (cmd === 'eval') {
    const cdp = await newPage('eval');
    await load(cdp, FILM);
    console.log(JSON.stringify(await evalp(cdp, args[0]), null, 1));
  }
} finally {
  proc.kill();
  process.exit(process.exitCode ?? 0);
}
