// Loads the brand-colors snapshot once, as its own chunk, for everything that
// needs it (the Variant chips and the Brand colors panel).
let loading = null;

export function loadBrandColors() {
  loading ??= import('../data/brand-colors.json')
    .then((m) => m.default)
    .catch(() => ({ brands: [], source: {} }));
  return loading;
}
