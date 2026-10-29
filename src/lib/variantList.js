// Variants you never use, hidden from the Variant row in Settings. Unlike
// brands and materials this is a list of what is *hidden*: variant names
// come from every brand's own words (Metal, Luminous, Rainbow...), so there
// is no short list to start from. Nothing is hidden until you hide it.
//
// A variant is hidden by kind: hiding "Metallic" also hides a brand's own
// word for it ("Metal"). Hidden variants are left off the built-in chips for
// every brand and material. None, your own saved variants and the Custom box
// are never affected, and a variant that is selected (for example read from
// a tag) still gets its chip.
//
// Data: { hidden: ["Rainbow", "Glow"] }
import { sameVariant } from './brandColors.js';

export const STORAGE_KEY = 'filascribe-variants';
const LONGEST = 40;
const MAX = 200;

const key = (v) => String(v ?? '').trim().toLowerCase();

const cleanList = (list) => {
  const seen = new Set();
  const out = [];
  for (const v of Array.isArray(list) ? list : []) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (!t || t.length > LONGEST || seen.has(key(t))) continue;
    seen.add(key(t));
    out.push(t);
  }
  return out.slice(0, MAX);
};

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.hidden)) return cleanList(data.hidden);
    }
  } catch {
    // fall through to nothing hidden
  }
  return [];
}

export function store(hidden, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ hidden: cleanList(hidden) }));
  } catch {
    // Storage unavailable: the choice lasts until the page closes
  }
}

// Hidden by kind: hiding "Metallic" also hides a brand's "Metal"
export const isHidden = (hidden, variant) => !!key(variant) && hidden.some((h) => sameVariant(h, variant));

/** Hide a variant. Returns the same array when nothing changes. */
export function hide(hidden, variant) {
  const v = String(variant ?? '').trim();
  if (!v || v.length > LONGEST || isHidden(hidden, v) || hidden.length >= MAX) return hidden;
  return [...hidden, v];
}

/** Show a variant again. Returns the same array when nothing changes. */
export function show(hidden, variant) {
  return isHidden(hidden, variant) ? hidden.filter((h) => !sameVariant(h, variant)) : hidden;
}

/**
 * The built-in variant chips without the hidden ones. None ('') always stays,
 * and so does `current` (the selected variant, e.g. read from a tag).
 */
export function visible(choices, hidden, current = '') {
  if (!hidden.length) return choices;
  return choices.filter((c) => !c || !isHidden(hidden, c) || key(c) === key(current)); // the name itself, not the kind: typing "Matt" doesn't bring Matte back
}

/** Variant names starting with `text`, not hidden yet, best known first. */
export function find(names, hidden, text, limit = 12) {
  const q = key(text);
  if (!q) return [];
  return names.filter((n) => key(n).startsWith(q) && !isHidden(hidden, n)).slice(0, limit);
}
