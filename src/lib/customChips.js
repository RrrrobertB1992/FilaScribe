// Your own chips: Custom brands, materials and variants you saved (with the
// Save button by their text box, or by writing a tag with them), shown as
// chips after the built-in ones. Variants belong to a brand + material, like
// the Variant row itself; brands and materials are shown everywhere.
//
// Data: { brands: ["Zephyr"], materials: ["PLA+"], variants: { "<brand>|<type>": ["Rapid"] } }

export const STORAGE_KEY = 'filascribe-custom-chips';
export const MAX = 30; // per list
const LONGEST = 40; // same as the text boxes

const empty = () => ({ brands: [], materials: [], variants: {} });

const cleanList = (list) =>
  Array.isArray(list)
    ? [...new Set(list.filter((v) => typeof v === 'string').map((v) => v.trim()).filter((v) => v && v.length <= LONGEST))].slice(0, MAX)
    : [];

function clean(data) {
  const out = empty();
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
  out.brands = cleanList(data.brands);
  out.materials = cleanList(data.materials);
  if (data.variants && typeof data.variants === 'object' && !Array.isArray(data.variants)) {
    for (const [key, list] of Object.entries(data.variants)) {
      const l = cleanList(list);
      if (key.includes('|') && l.length) out.variants[key] = l;
    }
  }
  return out;
}

export function load(storage = globalThis.localStorage) {
  try {
    return clean(JSON.parse(storage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return empty();
  }
}

export function store(chips, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(chips));
  } catch {
    // Storage unavailable: the chips just aren't kept
  }
}

export const variantKey = (brand, type) => {
  const b = String(brand ?? '').trim();
  const t = String(type ?? '').trim();
  return b && t ? `${b}|${t}` : null;
};

/** The saved variants for a brand + material. */
export const variantsFor = (chips, brand, type) => chips.variants[variantKey(brand, type)] || [];

const addTo = (list, value) => {
  const v = String(value ?? '').trim();
  if (!v || v.length > LONGEST || list.includes(v)) return list;
  return [...list, v].slice(-MAX); // the oldest goes when full
};

/**
 * Save a value. kind: 'brand' | 'material' | 'variant' (variants need the
 * brand and type). `builtIn` lists the chips already shown, which aren't
 * saved again. Returns the same object when nothing changes.
 */
export function add(chips, kind, value, { brand = '', type = '', builtIn = [] } = {}) {
  const v = String(value ?? '').trim();
  if (!v || builtIn.includes(v)) return chips;
  if (kind === 'brand' || kind === 'material') {
    const key = kind === 'brand' ? 'brands' : 'materials';
    const next = addTo(chips[key], v);
    return next === chips[key] ? chips : { ...chips, [key]: next };
  }
  const key = variantKey(brand, type);
  if (!key) return chips;
  const list = chips.variants[key] || [];
  const next = addTo(list, v);
  return next === list ? chips : { ...chips, variants: { ...chips.variants, [key]: next } };
}

/** Remove a saved value. Returns the same object when nothing changes. */
export function remove(chips, kind, value, { brand = '', type = '' } = {}) {
  if (kind === 'brand' || kind === 'material') {
    const key = kind === 'brand' ? 'brands' : 'materials';
    return chips[key].includes(value) ? { ...chips, [key]: chips[key].filter((v) => v !== value) } : chips;
  }
  const key = variantKey(brand, type);
  const list = (key && chips.variants[key]) || [];
  if (!list.includes(value)) return chips;
  const variants = { ...chips.variants };
  const rest = list.filter((v) => v !== value);
  if (rest.length) variants[key] = rest;
  else delete variants[key];
  return { ...chips, variants };
}

/** Chips shown: the built-in ones, then yours that aren't among them. */
export const withSaved = (builtIn, saved) => [...builtIn, ...saved.filter((v) => !builtIn.includes(v))];
