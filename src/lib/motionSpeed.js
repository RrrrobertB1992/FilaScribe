// How fast things fold open and shut (Settings → Appearance → Animation speed).
// Each level is the length of one fold in milliseconds. Kept on the device;
// Normal until you choose.
export const STORAGE_KEY = 'filascribe-motion-speed';
export const LEVELS = { fast: 200, normal: 400, slow: 600 };
export const DEFAULT = 'normal';

/** 'fast', 'normal' or 'slow'; anything else is the default. */
export function clean(value) {
  return typeof value === 'string' && Object.hasOwn(LEVELS, value) ? value : DEFAULT;
}

/** Milliseconds for a level. */
export const msFor = (level) => LEVELS[clean(level)];

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
