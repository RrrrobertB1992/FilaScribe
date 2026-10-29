// Which materials the Material row shows, chosen in Settings. The row starts
// short (PLA, PETG, ABS); the rest of the built-in materials are added in
// Settings, and anything else is typed with "Other…" (and Save, or writing a
// tag, turns it on). Same idea as brandList.js, without a fixed first chip.
//
// Data: { shown: ["PLA", "PETG", "PLA+"] }
import { MATERIALS } from './catalog.js';

export const STORAGE_KEY = 'filascribe-materials';
export const DEFAULT = ['PLA', 'PETG', 'ABS'];
const LONGEST = 40;
const MAX = 60;

const isBuiltIn = (m) => Object.prototype.hasOwnProperty.call(MATERIALS, m);

const cleanList = (list) =>
  [...new Set((Array.isArray(list) ? list : []).filter((v) => typeof v === 'string').map((v) => v.trim()))]
    .filter((v) => v && v.length <= LONGEST)
    .slice(0, MAX);

/**
 * The materials shown. Until Settings changes them: the short default list
 * plus any materials saved as chips before this setting existed (`legacy`).
 */
export function load(storage = globalThis.localStorage, legacy = []) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.shown)) return cleanList(data.shown);
    }
  } catch {
    // fall through to the default
  }
  return cleanList([...DEFAULT, ...legacy]);
}

export function store(shown, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ shown: cleanList(shown) }));
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}

/** Turn a material on (at the end). Returns the same array when nothing changes. */
export function add(shown, material) {
  const m = String(material ?? '').trim();
  if (!m || m.length > LONGEST || shown.includes(m) || shown.length >= MAX) return shown;
  return [...shown, m];
}

/** Turn a material off. Returns the same array when nothing changes. */
export const remove = (shown, material) => (shown.includes(material) ? shown.filter((m) => m !== material) : shown);

/** The built-in materials that aren't shown, in the usual order. */
export const hidden = (shown) => Object.keys(MATERIALS).filter((m) => !shown.includes(m));

/**
 * The Material row: the materials shown, as many as the brand makes (`made`,
 * from materialChoices, which includes `current` when it's a built-in one).
 * Your own materials (not built in) stay for every brand. A built-in material
 * that is selected but hidden still gets a chip at the end, so a tag read
 * with it (or one picked before it was hidden) never shows nothing selected.
 */
export function rowFor(shown, made, current = '') {
  const row = shown.filter((m) => !isBuiltIn(m) || made.includes(m));
  const cur = String(current ?? '').trim();
  return cur && isBuiltIn(cur) && made.includes(cur) && !row.includes(cur) ? [...row, cur] : row;
}

/** Built-in materials that aren't shown and start with `text`, for Other… */
export function suggest(shown, text, limit = 6) {
  const q = String(text ?? '').trim().toLowerCase();
  if (!q) return [];
  return hidden(shown).filter((m) => m.toLowerCase().startsWith(q)).slice(0, limit);
}

/** A typed name that is a built-in material (in any case) becomes its spelling. */
export function canonical(text) {
  const t = String(text ?? '').trim();
  return Object.keys(MATERIALS).find((m) => m.toLowerCase() === t.toLowerCase()) || t;
}
