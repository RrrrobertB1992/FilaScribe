// One look for a spool's colors wherever they are drawn, so the same spool
// looks the same on every screen. In a circle the colors go around it, like
// the spool in the preview: pie wedges with the first color on the left (a
// gradient loops back to the first color, so there is no hard seam). In a
// rectangle (the color tiles) the same wedges become bands at an angle.
// Settings → Appearance can switch circles and tiles to vertical bands or
// angled bands instead (lib/swatchStyle.js).
// Colors are hex strings, with or without the #.

const hashed = (colors) => colors.map((h) => `#${String(h).replace(/^#/, '')}`);

/** The CSS background for a round swatch. */
export function around(colors, gradient = false) {
  const list = hashed(colors);
  if (list.length < 2) return list[0] || '#FFFFFF';
  if (gradient) return `conic-gradient(from 180deg, ${[...list, list[0]].join(', ')})`;
  const step = 360 / list.length;
  return `conic-gradient(from 180deg, ${list.map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
}

/** The CSS background for a rectangular swatch (a color tile). */
export function diagonal(colors, gradient = false) {
  const list = hashed(colors);
  if (list.length < 2) return list[0] || '#FFFFFF';
  if (gradient) return `linear-gradient(135deg, ${list.join(', ')})`;
  const step = 100 / list.length;
  return `linear-gradient(135deg, ${list.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

/** The CSS background for vertical bands (side by side, first color on the left). */
export function vertical(colors, gradient = false) {
  const list = hashed(colors);
  if (list.length < 2) return list[0] || '#FFFFFF';
  if (gradient) return `linear-gradient(90deg, ${list.join(', ')})`;
  const step = 100 / list.length;
  return `linear-gradient(90deg, ${list.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

/** A round swatch in the chosen style: 'vertical', 'angled' or 'around' (the default). */
export function circleFill(colors, gradient = false, style = 'around') {
  if (style === 'vertical') return vertical(colors, gradient);
  if (style === 'angled') return diagonal(colors, gradient);
  return around(colors, gradient);
}

/** A rectangular swatch in the chosen style: 'vertical' or 'angled' (anything else is angled). */
export function tileFill(colors, gradient = false, style = 'angled') {
  return style === 'vertical' ? vertical(colors, gradient) : diagonal(colors, gradient);
}
