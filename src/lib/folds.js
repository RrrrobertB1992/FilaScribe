// Which cards on the Create screen are folded shut (Filament, Colors,
// Temperatures, Spool details, Tag data), remembered per card. A card nobody
// has opened or closed yet uses its own default.
//
// Data: { "filament": true, "temps": false }  (true = open)
export const STORAGE_KEY = 'filascribe-create-open';

export function load(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'boolean'));
  } catch {
    return {};
  }
}

/** Whether card `id` is open: what was chosen last, else `fallback`. */
export function isOpen(id, fallback, storage = globalThis.localStorage) {
  const all = load(storage);
  return id in all ? all[id] : fallback;
}

export function set(id, open, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...load(storage), [id]: !!open }));
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}
