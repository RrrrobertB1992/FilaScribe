// Which brands the Brand row shows, chosen in Settings. Generic is always
// first and can't be hidden; the rest are in the order they were turned on.
// Anything else is typed with "Other…" (and Save, or writing a tag, turns
// it on).
//
// Data: { shown: ["Bambu Lab", "Elegoo", "My Brand"] }  (Generic not stored)
import { BRANDS } from './catalog.js';

export const STORAGE_KEY = 'filascribe-brands';
export const GENERIC = 'Generic';
export const DEFAULT = BRANDS.filter((b) => b !== GENERIC);
const LONGEST = 40;
const MAX = 60;

const cleanList = (list) =>
  [...new Set((Array.isArray(list) ? list : []).filter((v) => typeof v === 'string').map((v) => v.trim()))]
    .filter((v) => v && v.length <= LONGEST && v !== GENERIC)
    .slice(0, MAX);

/**
 * The brands shown, without Generic. Until Settings changes them: the
 * built-in list plus any brands saved as chips before this setting existed
 * (`legacy`).
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

/** The Brand row: Generic, then the brands shown. */
export const chipsFor = (shown) => [GENERIC, ...shown];

export const isShown = (shown, brand) => brand === GENERIC || shown.includes(brand);

/** Turn a brand on (at the end). Returns the same array when nothing changes. */
export function add(shown, brand) {
  const b = String(brand ?? '').trim();
  if (!b || b === GENERIC || b.length > LONGEST || shown.includes(b) || shown.length >= MAX) return shown;
  return [...shown, b];
}

/** Turn a brand off. Returns the same array when nothing changes. */
export const remove = (shown, brand) => (shown.includes(brand) ? shown.filter((b) => b !== brand) : shown);

export const toggle = (shown, brand) => (shown.includes(brand) ? remove(shown, brand) : add(shown, brand));
