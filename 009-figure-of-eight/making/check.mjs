import { sunAt, sunTimes, dayNum } from './sun.mjs';
const hm = h => { const m = Math.round(h * 60); return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; };
const hms = h => { const s = Math.round(h * 3600); return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
function scan(name, lat, lon, tz, y0, m0, d0, n) {
  let minSet = [99], maxRise = [-99], minLen = [99];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y0, m0 - 1, d0 + i));
    const t = sunTimes(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), lat, lon);
    const s = t.set + tz, r = t.rise + tz, ds = dt.toISOString().slice(0, 10);
    if (s < minSet[0]) minSet = [s, ds];
    if (r > maxRise[0]) maxRise = [r, ds];
    if (t.set - t.rise < minLen[0]) minLen = [t.set - t.rise, ds];
  }
  console.log(name, 'earliest set', hm(minSet[0]), minSet[1], '| latest rise', hm(maxRise[0]), maxRise[1], '| shortest', hms(minLen[0]), minLen[1]);
}
scan('London', 51.5074, -0.1278, 0, 2026, 11, 15, 70);
scan('New York', 40.7128, -74.006, -5, 2026, 11, 15, 70);
scan('Sydney', -33.8688, 151.2093, 10, 2027, 5, 15, 70);
scan('Helsinki', 60.1699, 24.9384, 2, 2026, 11, 15, 70);
// EoT spot checks: known approx +16.4 min ~Nov 3, -14.2 ~Feb 11, 0 ~Apr 15, Jun 13, Sep 1, Dec 25
for (const [m, d] of [[2,11],[4,15],[5,14],[6,13],[7,26],[9,1],[11,3],[12,25]]) console.log(m, d, sunAt(dayNum(2026, m, d)).eot.toFixed(2));
// solar day length (sec over 24h) around solstices
for (const [m, d] of [[12,22],[6,21],[9,16],[3,26]]) { const a = sunAt(dayNum(2026,m,d)).eot, b = sunAt(dayNum(2026,m,d+1)).eot; console.log('solar day', m, d, ((a - b) * 60).toFixed(1), 's'); }
