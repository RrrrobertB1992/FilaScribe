// How many closest brand colors to suggest (Settings → Closest brand colors):
// 0 turns the suggestions off. Kept on the device; 3 until you choose.
export const STORAGE_KEY = 'filascribe-closest-colors';
export const DEFAULT = 3;
export const MAX = 5;

/** A whole number from 0 to MAX; anything else is the default. */
export function clean(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= MAX ? n : DEFAULT;
}

export function load(storage = globalThis.localStorage) {
  try {
    const v = storage.getItem(STORAGE_KEY);
    return v === null ? DEFAULT : clean(v);
  } catch {
    return DEFAULT;
  }
}

export function store(count, storage = globalThis.localStorage) {
  try {
    if (clean(count) === DEFAULT) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, String(clean(count)));
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}
