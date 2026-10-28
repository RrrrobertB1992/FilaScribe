// Appearance: follow the system (default), or always light or dark. Applied
// as data-theme on <html> (see app.css), before the app mounts, so the page
// doesn't flash the wrong colors.
export const STORAGE_KEY = 'filascribe-theme';
export const THEMES = ['system', 'light', 'dark'];

export function load(storage = globalThis.localStorage) {
  try {
    const t = storage.getItem(STORAGE_KEY);
    return THEMES.includes(t) ? t : 'system';
  } catch {
    return 'system';
  }
}

export function store(theme, storage = globalThis.localStorage) {
  try {
    if (theme === 'system') storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}

export function apply(theme, root = globalThis.document?.documentElement) {
  if (!root) return;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}
