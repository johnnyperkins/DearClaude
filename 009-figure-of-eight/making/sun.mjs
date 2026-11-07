// The sun as a Kepler ellipse with three numbers: tilt, eccentricity, and where perihelion falls.
// Shared by the page (pasted in) and by the checks here.
const R = Math.PI / 180;
export const EARTH = { tilt: 23.44, ecc: 0.0167, peri: 282.94 };   // peri: longitude of perihelion, degrees from the March equinox

const wrap = a => ((a + 180) % 360 + 360) % 360 - 180;

// d: days since 2000-01-01 12:00 UT. Returns declination (deg) and equation of time (minutes, sundial fast is +).
export function sunAt(d, p = EARTH) {
  const M = (357.5291 + 0.98560028 * d) * R;
  const peri = p === EARTH ? 282.9404 + 4.70935e-5 * d : p.peri;
  let E = M;
  for (let i = 0; i < 8; i++) E -= (E - p.ecc * Math.sin(E) - M) / (1 - p.ecc * Math.cos(E));
  const nu = 2 * Math.atan(Math.sqrt((1 + p.ecc) / (1 - p.ecc)) * Math.tan(E / 2));
  const lam = nu + peri * R, eps = p.tilt * R;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const L = M / R + peri;            // mean sun
  return { dec: dec / R, eot: 4 * wrap(L - ra / R), lam: wrap(lam / R) };
}

export const dayNum = (y, m, dd) => (Date.UTC(y, m - 1, dd, 12) - Date.UTC(2000, 0, 1, 12)) / 864e5;

// Sunrise, noon and sunset in hours of UT for a calendar day at lat/lon (east +). Iterated once at each event.
export function sunTimes(y, m, dd, lat, lon, p = EARTH) {
  const d0 = dayNum(y, m, dd) - 0.5;   // 00:00 UT
  const noonAt = () => { let t = 12; for (let i = 0; i < 3; i++) t = 12 - (lon + sunAt(d0 + t / 24 - lon / 360 * 0, p).eot / 4 + 0) / 15; return t; };
  let noon = 12;
  for (let i = 0; i < 3; i++) noon = 12 - lon / 15 - sunAt(d0 + noon / 24, p).eot / 60;
  const ev = sign => {
    let t = noon;
    for (let i = 0; i < 4; i++) {
      const s = sunAt(d0 + t / 24, p);
      const c = (Math.sin(-0.833 * R) - Math.sin(lat * R) * Math.sin(s.dec * R)) / (Math.cos(lat * R) * Math.cos(s.dec * R));
      if (c > 1 || c < -1) return NaN;
      const n = 12 - lon / 15 - s.eot / 60;
      t = n + sign * Math.acos(c) / R / 15;
    }
    return t;
  };
  return { rise: ev(-1), noon, set: ev(1) };
}
