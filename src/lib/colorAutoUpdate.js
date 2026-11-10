// "Update automatically" (Settings → Color database): when on, the app checks
// for a newer brand color database at start (once it is 7 days old) and
// installs it. Off until you turn it on. Kept on the device.
export const STORAGE_KEY = 'filascribe-color-auto-update';

/** Only 'on' counts; anything else is off. */
export const clean = (value) => (value === 'on' ? 'on' : 'off');

export function load(storage = globalThis.localStorage) {
  try {
    return storage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function store(on, storage = globalThis.localStorage) {
  try {
    if (on) storage.setItem(STORAGE_KEY, 'on');
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}
