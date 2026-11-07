// Closest brand colors: for a color that isn't a brand color, find the
// nearest named colors of the brand (see components/BrandColors.svelte).
//
// "Near" is how the eye sees it: the colors are compared in CIELAB with the
// CIEDE2000 formula, not by raw RGB distance. A color is only offered when
// it's also in the same color family, so blue never matches violet even when
// the numbers say they're not far apart:
//   - real colors must be within WHEEL_LIMIT degrees of each other on the
//     ordinary color wheel (Lab hue alone puts blue and violet close
//     together). It is a plain check with no special cases, so a color is
//     never turned away by a narrow miss at some cutoff;
//   - a grey only matches a grey (or a very muted color).
// How close is close enough is a setting (Strict, Normal, Loose), which is
// the limit passed in as `maxDelta`.
// Gradients and segments compare color by color, in order, and only against
// colors with the same number of parts.

/** Furthest apart (CIEDE2000) a color can be and still be offered. */
export const MAX_DELTA = 12;
/** Up to this, the label says "Very close"; beyond it, "Close". */
export const VERY_CLOSE = 5;
/** How far apart two colors can be on the ordinary color wheel, in degrees. */
export const WHEEL_LIMIT = 20;
/** Below this chroma a color counts as a grey. */
export const GREY_CHROMA = 8;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** "FFAA00", "#fa0" -> [r, g, b] 0-255, or null when it isn't a hex color. */
export function parseHex(hex) {
  let h = String(hex ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Hex -> [L, a, b] (sRGB, D65), or null. */
export function toLab(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference of two [L, a, b] colors (Sharma et al., 2005). */
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hue = (b, ap) => (b === 0 && ap === 0 ? 0 : (deg(Math.atan2(b, ap)) + 360) % 360);
  const hp1 = hue(b1, ap1);
  const hp2 = hue(b2, ap2);

  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(rad(dh / 2));

  const Lm = (L1 + L2) / 2;
  const Cpm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2 === 0) hm = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) <= 180) hm = (hp1 + hp2) / 2;
  else hm = (hp1 + hp2 + (hp1 + hp2 < 360 ? 360 : -360)) / 2;

  const T = 1 - 0.17 * Math.cos(rad(hm - 30)) + 0.24 * Math.cos(rad(2 * hm)) + 0.32 * Math.cos(rad(3 * hm + 6)) - 0.2 * Math.cos(rad(4 * hm - 63));
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

/** Hue on the ordinary color wheel in degrees, or null when the color is too grey or too dark to have a steady one. */
function wheelHue(hex) {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (max < 0.2 || d / max < 0.25) return null;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
const gapBetween = (x, y) => {
  const d = Math.abs(x - y);
  return Math.min(d, 360 - d);
};

const chroma = ([, a, b]) => Math.hypot(a, b);

/**
 * How two single colors compare: { delta, ok }. `ok` means near enough in
 * shade AND in the same color family; `delta` is the CIEDE2000 distance.
 * Colors that aren't valid hex never match.
 */
export function compare(hexA, hexB, maxDelta = MAX_DELTA) {
  const A = toLab(hexA);
  const B = toLab(hexB);
  if (!A || !B) return { delta: Infinity, ok: false };
  const delta = deltaE2000(A, B);
  const [ca, cb] = [chroma(A), chroma(B)];
  let family;
  if (ca < GREY_CHROMA && cb < GREY_CHROMA) {
    family = true; // two greys: only the shade matters
  } else if (ca < GREY_CHROMA || cb < GREY_CHROMA) {
    family = Math.abs(ca - cb) <= 12; // a grey doesn't match a vivid color
  } else {
    const [wa, wb] = [wheelHue(hexA), wheelHue(hexB)];
    family = wa === null || wb === null || gapBetween(wa, wb) <= WHEEL_LIMIT;
  }
  return { delta, ok: family && delta <= maxDelta };
}

/**
 * How close brand color `theirs` (a list of hex) is to `mine`:
 * { delta, label } or null when it's not a match. Colors are compared in
 * order, and only when there are as many of them.
 */
export function closeness(mine, theirs, maxDelta = MAX_DELTA) {
  if (!mine.length || mine.length !== theirs.length) return null;
  let sum = 0;
  let worst = 0;
  for (let i = 0; i < mine.length; i++) {
    const { delta, ok } = compare(mine[i], theirs[i], maxDelta);
    if (!ok) return null;
    sum += delta;
    worst = Math.max(worst, delta);
  }
  return { delta: sum / mine.length, label: worst <= VERY_CLOSE ? 'Very close' : 'Close' };
}

/**
 * The nearest of `tiles` ({ info: { colors } }, see tilesFor in
 * brandColors.js) to the colors `mine`, nearest first, at most `limit`.
 * Returns [{ tile, delta, label }]; fewer than `limit`, or none, when not
 * enough of them are within `maxDelta`.
 */
export function nearest(tiles, mine, limit = 3, maxDelta = MAX_DELTA) {
  if (limit < 1) return [];
  const out = [];
  for (const tile of tiles) {
    const c = closeness(mine, tile.info.colors, maxDelta);
    if (c) out.push({ tile, ...c });
  }
  return out.sort((a, b) => a.delta - b.delta).slice(0, limit);
}
