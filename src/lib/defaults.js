// Defaults for new tags: what Create starts with (and Start over goes back
// to). Saved from the Create form in Settings; colors aren't part of it,
// since they change from spool to spool.
import { emptyForm, PROFILES } from './formats/openspool.js';

export const STORAGE_KEY = 'filascribe-defaults';
export const FIELDS = ['profile', 'brand', 'type', 'subtype', 'minTemp', 'maxTemp', 'bedMinTemp', 'bedMaxTemp', 'weight', 'diameter', 'alpha'];

function clean(data) {
  const out = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
  for (const f of FIELDS) {
    if (typeof data[f] === 'string' && data[f].length <= 40) out[f] = data[f];
  }
  if (out.profile && !PROFILES[out.profile]) delete out.profile;
  return out;
}

/** The saved defaults ({} when none). */
export function load(storage = globalThis.localStorage) {
  try {
    return clean(JSON.parse(storage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return {};
  }
}

export function store(defaults, storage = globalThis.localStorage) {
  try {
    if (Object.keys(defaults).length) storage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the defaults just aren't kept
  }
}

/** The defaults to keep from a form (everything but the colors). */
export const fromForm = (form) => clean(Object.fromEntries(FIELDS.map((f) => [f, form[f] ?? ''])));

/** A new form: the built-in empty form with the defaults on top. */
export function newForm(defaults = {}) {
  const d = clean(defaults);
  return { ...emptyForm(d.profile || 'u1'), ...d };
}
