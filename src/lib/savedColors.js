// Saved colors: remembers the colors used for each brand + material type
// so a replacement spool can reuse them. Same data shape and rules as the
// saved-colors feature in PrintTag-Web-Rrrrobert, so a list exported from
// there can be imported here.
//
// Data: { "<brand>|<type>": [ { colors: ["2B2B2D", ...], name: "",
//          variants: ["Matte", ...], colorType?: "0" | "1" } ] }
// Newest first. A color set used under another variant gains that variant
// instead of becoming a new row. The same colors as a gradient and as
// segments are two different entries.

export const STORAGE_KEY = 'spoolscribe-saved-colors';
export const PAGE_SIZE = 15;

const HEX = /^[0-9A-F]{6}$/;

export function keyFor(brand, type) {
  const b = (brand || '').trim();
  const t = (type || '').trim();
  return b && t ? `${b}|${t}` : null;
}

export function idFor(colors, style) {
  return colors.join(',') + (colors.length > 1 && style === '0' ? '~gradient' : '');
}

export const entryId = (entry) => idFor(entry.colors, entry.colorType);

function clean(all) {
  const out = {};
  if (!all || typeof all !== 'object' || Array.isArray(all)) return out;
  for (const [key, list] of Object.entries(all)) {
    if (!key.includes('|') || !Array.isArray(list)) continue;
    const entries = list
      .filter((e) => e && Array.isArray(e.colors) && e.colors.length)
      .map((e) => {
        const colors = e.colors.map((h) => String(h).replace('#', '').toUpperCase()).filter((h) => HEX.test(h));
        const entry = {
          colors,
          name: typeof e.name === 'string' ? e.name : '',
          variants: Array.isArray(e.variants) ? e.variants.map(String) : [''],
        };
        if (colors.length > 1) entry.colorType = e.colorType === '0' ? '0' : '1';
        return entry;
      })
      .filter((e) => e.colors.length);
    if (entries.length) out[key] = entries;
  }
  return out;
}

export function load(storage = globalThis.localStorage) {
  try {
    return clean(JSON.parse(storage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return {};
  }
}

export function store(all, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable (e.g. private mode): colors just aren't kept
  }
}

const copy = (all) => JSON.parse(JSON.stringify(all));

function setEntries(all, key, list) {
  const next = copy(all);
  if (list.length) next[key] = list;
  else delete next[key];
  return next;
}

export const entriesFor = (all, key) => (key && all[key] ? all[key] : []);

/** Save colors under key (newest first), adding the variant to a matching row. */
export function save(all, key, colors, style, variant) {
  if (!key || !colors.length) return all;
  const id = idFor(colors, style);
  const entries = copy(entriesFor(all, key));
  const index = entries.findIndex((e) => entryId(e) === id);
  const entry = index >= 0 ? entries.splice(index, 1)[0] : { colors: [...colors], name: '', variants: [] };
  if (colors.length > 1) entry.colorType = style === '0' ? '0' : '1';
  if (!entry.variants.includes(variant)) entry.variants.push(variant);
  entries.unshift(entry);
  return setEntries(all, key, entries);
}

export function removeEntry(all, key, id) {
  return setEntries(all, key, entriesFor(all, key).filter((e) => entryId(e) !== id));
}

/** Remove one variant from a row; the row goes when it has none left. */
export function removeVariant(all, key, id, variant) {
  const entries = copy(entriesFor(all, key));
  const target = entries.find((e) => entryId(e) === id);
  if (!target) return all;
  target.variants = target.variants.filter((v) => v !== variant);
  return setEntries(all, key, target.variants.length ? entries : entries.filter((e) => e !== target));
}

export function rename(all, key, id, name) {
  const entries = copy(entriesFor(all, key));
  const target = entries.find((e) => entryId(e) === id);
  if (target) target.name = name.trim();
  return setEntries(all, key, entries);
}

/**
 * Replace a row's colors, keeping its name, variants and place. If the new
 * colors match another row, the two are merged. Returns { all, id }.
 */
export function replaceColors(all, key, id, colors, style) {
  const newId = idFor(colors, style);
  const entries = copy(entriesFor(all, key));
  const index = entries.findIndex((e) => entryId(e) === id);
  if (index < 0) return { all, id };
  const target = entries[index];
  const other = newId !== id ? entries.find((e) => entryId(e) === newId) : null;
  if (other) {
    target.variants.forEach((v) => { if (!other.variants.includes(v)) other.variants.push(v); });
    if (!other.name && target.name) other.name = target.name;
    entries.splice(index, 1);
  } else {
    target.colors = [...colors];
    if (colors.length > 1) target.colorType = style === '0' ? '0' : '1';
    else delete target.colorType;
  }
  return { all: setEntries(all, key, entries), id: newId };
}

export const clearKey = (all, key) => setEntries(all, key, []);

/**
 * Merge an exported list (this app's or PrintTag-Web-Rrrrobert's) into
 * the saved colors. Rows already saved gain any new variants and a name.
 * Returns { all, added }.
 */
export function importInto(all, incoming) {
  const data = clean(incoming);
  let next = copy(all);
  let added = 0;
  for (const [key, list] of Object.entries(data)) {
    const entries = next[key] ? next[key] : [];
    for (const entry of list) {
      const existing = entries.find((e) => entryId(e) === entryId(entry));
      if (existing) {
        entry.variants.forEach((v) => { if (!existing.variants.includes(v)) existing.variants.push(v); });
        if (!existing.name && entry.name) existing.name = entry.name;
      } else {
        entries.push(entry);
        added++;
      }
    }
    next[key] = entries;
  }
  return { all: next, added };
}
