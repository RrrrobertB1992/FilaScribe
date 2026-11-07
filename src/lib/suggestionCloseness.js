// How close a brand color has to be to be suggested (Settings → Closest brand
// colors → How close). Each level is the furthest apart (CIEDE2000) a color
// can be and still be offered. Kept on the device; Normal until you choose.
export const STORAGE_KEY = 'filascribe-closest-closeness';
export const LEVELS = { strict: 8, normal: 12, loose: 18 };
export const DEFAULT = 'normal';

/** 'strict', 'normal' or 'loose'; anything else is the default. */
export function clean(value) {
  return typeof value === 'string' && Object.hasOwn(LEVELS, value) ? value : DEFAULT;
}

/** The CIEDE2000 limit for a level. */
export const limitFor = (level) => LEVELS[clean(level)];

export function load(storage = globalThis.localStorage) {
  try {
    const v = storage.getItem(STORAGE_KEY);
    return v === null ? DEFAULT : clean(v);
  } catch {
    return DEFAULT;
  }
}

export function store(level, storage = globalThis.localStorage) {
  try {
    if (clean(level) === DEFAULT) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, clean(level));
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}
