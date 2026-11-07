import { sunTimes, sunAt, dayNum } from './sun.mjs';
import { CITIES } from './cities.mjs';
function stdOffset(tz) {
  const off = d => { const s = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(d).find(p => p.type === 'timeZoneName').value;
    const m = s.match(/GMT([+-])(\d\d):(\d\d)/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] + m[3] / 60) : 0; };
  return Math.min(off(new Date(Date.UTC(2026, 0, 15))), off(new Date(Date.UTC(2026, 6, 15))));
}
for (const [name, lat, lon, tz] of CITIES) {
  const off = stdOffset(tz), sol = lat >= 0 ? Date.UTC(2026, 11, 21) : Date.UTC(2027, 5, 21);
  let ms = [99], mr = [-99];
  for (let i = -70; i <= 70; i++) {
    const dt = new Date(sol + i * 864e5), t = sunTimes(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), lat, lon);
    if (t.set + off < ms[0]) ms = [t.set + off, i]; if (t.rise + off > mr[0]) mr = [t.rise + off, i];
  }
  console.log(name.padEnd(14), String(off).padStart(5), 'set', ms[1], 'rise', mr[1], 'gap', mr[1] - ms[1]);
}
