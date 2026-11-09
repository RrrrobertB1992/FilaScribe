// What opening a card does to the others (Settings → Appearance → Opening a card):
// 'leave' (the default) lets every card be opened and closed on its own; 'close'
// closes the other cards and scrolls the one you opened to the top of the screen.
// Kept on the device; Leave the others until you choose.
export const STORAGE_KEY = 'filascribe-open-mode';
export const MODES = ['leave', 'close'];
export const DEFAULT = 'leave';

/** 'leave' or 'close'; anything else is the default. */
export function clean(value) {
  return MODES.includes(value) ? value : DEFAULT;
}

export function load(storage = globalThis.localStorage) {
  try {
    const v = storage.getItem(STORAGE_KEY);
    return v === null ? DEFAULT : clean(v);
  } catch {
    return DEFAULT;
  }
}

export function store(mode, storage = globalThis.localStorage) {
  try {
    if (clean(mode) === DEFAULT) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, clean(mode));
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}
