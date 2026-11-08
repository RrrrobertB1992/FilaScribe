// My filaments: whole spools you saved (brand, material, variant, colors and
// temperatures) so one tap fills the Create form. Kept on this device.
//
// Data: [ { profile, brand, type, subtype, minTemp, maxTemp, bedMinTemp,
//           bedMaxTemp, colors: ["2B2B2D", ...], colorType?: "0" | "1",
//           colorName: "Blue", name?: "Everyday black", note?: "...",
//           pinned?: true } ]  newest first.
// name, note and pinned are yours alone: they never go on a tag and are not
// part of what makes two spools the same.
// The same spool (every field alike) is only kept once. Spool details
// (weight, diameter, opacity) aren't part of it: they change per spool.
import { PROFILES, normalizeHex, usedColors } from './formats/openspool.js';

export const STORAGE_KEY = 'filascribe-filaments';
export const AUTO_KEY = 'filascribe-filaments-auto';
export const MAX = 200;
export const NAME_MAX = 40;
export const NOTE_MAX = 200;

const TEXT = ['brand', 'type', 'subtype', 'minTemp', 'maxTemp', 'bedMinTemp', 'bedMaxTemp'];
const HEX = /^[0-9A-F]{6}$/;

function cleanEntry(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const colors = (Array.isArray(e.colors) ? e.colors : [])
    .filter((h) => typeof h === 'string')
    .map((h) => h.replace('#', '').toUpperCase())
    .filter((h) => HEX.test(h))
    .slice(0, 5);
  if (!colors.length) return null;
  const out = { profile: PROFILES[e.profile] ? e.profile : 'u1' };
  for (const f of TEXT) out[f] = typeof e[f] === 'string' && e[f].length <= 40 ? e[f] : '';
  if (!out.brand.trim() || !out.type.trim()) return null;
  out.colors = colors;
  if (colors.length > 1) out.colorType = e.colorType === '0' ? '0' : '1';
  out.colorName = typeof e.colorName === 'string' ? e.colorName.slice(0, 60) : '';
  const name = typeof e.name === 'string' ? e.name.trim().slice(0, NAME_MAX) : '';
  const note = typeof e.note === 'string' ? e.note.trim().slice(0, NOTE_MAX) : '';
  if (name) out.name = name;
  if (note) out.note = note;
  if (e.pinned === true) out.pinned = true;
  return out;
}

const clean = (list) => (Array.isArray(list) ? list.map(cleanEntry).filter(Boolean).slice(0, MAX) : []);

export function load(storage = globalThis.localStorage) {
  try {
    return clean(JSON.parse(storage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function store(list, storage = globalThis.localStorage) {
  try {
    if (list.length) storage.setItem(STORAGE_KEY, JSON.stringify(list));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: they just aren't kept
  }
}

export function loadAuto(storage = globalThis.localStorage) {
  try {
    return storage.getItem(AUTO_KEY) === '1';
  } catch {
    return false;
  }
}

export function storeAuto(on, storage = globalThis.localStorage) {
  try {
    if (on) storage.setItem(AUTO_KEY, '1');
    else storage.removeItem(AUTO_KEY);
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}

/** The spool on a form as an entry, or null when it can't be saved (no brand or material, bad colors). */
export function fromForm(form, colorName = '') {
  const colors = usedColors(form);
  if (!colors.length || colors.some((c) => !c)) return null;
  const u1 = form.profile === 'u1';
  return cleanEntry({
    profile: form.profile,
    brand: (form.brand || '').trim(),
    type: (form.type || '').trim(),
    subtype: u1 ? (form.subtype || '').trim() : '',
    minTemp: form.minTemp,
    maxTemp: form.maxTemp,
    bedMinTemp: u1 ? form.bedMinTemp : '',
    bedMaxTemp: u1 ? form.bedMaxTemp : '',
    colors,
    colorType: form.colorType,
    colorName,
  });
}

/** What makes two entries the same spool. */
export const keyOf = (e) =>
  [e.profile, e.brand, e.type, e.subtype, e.minTemp, e.maxTemp, e.bedMinTemp, e.bedMaxTemp, e.colors.join(','), e.colors.length > 1 ? e.colorType : '']
    .join('|')
    .toLowerCase();

export const has = (list, entry) => list.some((e) => keyOf(e) === keyOf(entry));

/** The list with `entry` first, or the same list when it's already there (or the list is full). */
export function add(list, entry) {
  if (!entry || has(list, entry) || list.length >= MAX) return list;
  return [entry, ...list];
}

export const remove = (list, entry) => list.filter((e) => keyOf(e) !== keyOf(entry));

/** The list with `entry` changed by `patch` (name, note, pinned), in the same place. Empty name/note and pinned: false are left out. */
export function update(list, entry, patch) {
  const key = keyOf(entry);
  return list.map((e) => {
    if (keyOf(e) !== key) return e;
    const next = cleanEntry({ ...e, ...patch });
    return next || e;
  });
}

/** What the list shows: pinned first, otherwise the saved order (newest first). */
export const ordered = (list) => [...list.filter((e) => e.pinned), ...list.filter((e) => !e.pinned)];

/** The form fields an entry sets. */
export function toForm(entry) {
  const u1 = entry.profile === 'u1';
  return {
    profile: entry.profile,
    brand: entry.brand,
    type: entry.type,
    subtype: u1 ? entry.subtype : '',
    minTemp: entry.minTemp,
    maxTemp: entry.maxTemp,
    bedMinTemp: entry.bedMinTemp,
    bedMaxTemp: entry.bedMaxTemp,
    colors: [...entry.colors],
    colorType: entry.colorType || '1',
  };
}

/** A rough color word for a hex, so "white" finds your white spools even when the color has no name of its own. */
export function basicColorName(hex) {
  const n = normalizeHex(hex);
  if (!n) return '';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (l < 0.16) return 'black';
  if (l > 0.9 && d < 0.12) return 'white';
  if (d < 0.1) return l > 0.7 ? 'silver' : 'grey';
  const s = d / (1 - Math.abs(2 * l - 1));
  if (s < 0.18) return l > 0.7 ? 'silver' : 'grey';
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return l > 0.75 ? 'pink' : 'red';
  if (h < 40) return l < 0.4 ? 'brown' : 'orange';
  if (h < 70) return l < 0.35 ? 'brown' : 'yellow';
  if (h < 165) return 'green';
  if (h < 200) return 'teal';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

/** The color's name for display: its own name, else a rough word for each color. */
export function colorLabel(entry) {
  if (entry.colorName) return entry.colorName;
  const words = [...new Set(entry.colors.map(basicColorName))];
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' & ');
}

/** True when the color has no name from the brand's database: you picked it yourself, so its name is only a rough word for the hex. */
export const isCustom = (e) => !e.colorName;

export const title = (e) => [e.brand, e.type, e.subtype].filter(Boolean).join(' ');

const range = (a, b) => (a && b ? `${a}–${b}` : a || b || '');

export function meta(e) {
  const nozzle = range(e.minTemp, e.maxTemp);
  const bed = range(e.bedMinTemp, e.bedMaxTemp);
  return [nozzle && `${nozzle} °C`, bed && `bed ${bed} °C`].filter(Boolean).join(' · ');
}

/** The entries matching every word typed (name, note, brand, material, variant, color name, hex, temperatures). */
export function search(list, text) {
  const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((e) => {
    const hay = [e.name, e.note, title(e), e.colorName, ...e.colors.map(basicColorName), ...e.colors, meta(e)].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w.replace(/^#/, '')));
  });
}

/** Merge an exported list into `list`. Returns { list, added }. */
export function importInto(list, incoming) {
  if (!Array.isArray(incoming)) throw new Error('Not a list');
  let next = list;
  let added = 0;
  for (const e of clean(incoming).reverse()) {
    const after = add(next, e);
    if (after !== next) added++;
    next = after;
  }
  if (!clean(incoming).length && incoming.length) throw new Error('No spools');
  return { list: next, added };
}
