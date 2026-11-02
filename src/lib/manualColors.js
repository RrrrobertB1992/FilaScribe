// Color overrides you make in the app: a brand color whose hex is wrong in the
// database, with your hex instead. Kept on this device and applied on top of
// the database every time it loads, so database updates never touch them and
// a manual override always wins (including over the corrections bundled in
// scripts/color-overrides.json).
//
// Data: [ { brand, material, line, color, hex, was } ]
//   brand, material, line, color: as the database spells them ("Anycubic",
//     "PLA", "PLA Basic", "Black"); line "*" covers every line of that brand
//     and material that has a color of that name
//   hex: your color(s), "212121" or "RRGGBB,RRGGBB" for several
//   was: the database's hex when you made the override, to tell you if the
//     database has changed it since
// A color entry in the snapshot is [name, hex, traits, altHexes]; an
// overridden one gets a fifth item, the database's own hex.

export const STORAGE_KEY = 'filascribe-color-overrides';
export const ALL_LINES = '*';

const HEX_LIST = /^[0-9A-F]{6}(,[0-9A-F]{6}){0,4}$/;
const text = (v) => (typeof v === 'string' ? v.trim() : '');

function cleanEdit(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const out = {
    brand: text(e.brand),
    material: text(e.material),
    line: text(e.line),
    color: text(e.color),
    hex: text(e.hex).replace(/#/g, '').toUpperCase(),
    was: text(e.was).replace(/#/g, '').toUpperCase(),
  };
  if (!out.brand || !out.material || !out.line || !out.color) return null;
  if (!HEX_LIST.test(out.hex) || !HEX_LIST.test(out.was)) return null;
  if (out.hex.split(',').length !== out.was.split(',').length) return null; // the number of colors can't change
  return out;
}

const clean = (list) => (Array.isArray(list) ? list.map(cleanEdit).filter(Boolean) : []);

export function load(storage = globalThis.localStorage) {
  try {
    return clean(JSON.parse(storage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function store(edits, storage = globalThis.localStorage) {
  try {
    if (edits.length) storage.setItem(STORAGE_KEY, JSON.stringify(edits));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: they just aren't kept
  }
}

/** Same color, same place. */
export const sameTarget = (a, b) => a.brand === b.brand && a.material === b.material && a.line === b.line && a.color === b.color;
const sameColor = (a, b) => a.brand === b.brand && a.material === b.material && a.color === b.color;

/**
 * The list with this override in it. An override that gives the database's
 * own hex back is dropped. One for every line replaces any single-line
 * overrides of the same color.
 */
export function set(edits, edit) {
  const e = cleanEdit(edit);
  if (!e) return edits;
  let next = edits.filter((x) => !sameTarget(x, e));
  if (e.line === ALL_LINES) next = next.filter((x) => !sameColor(x, e));
  if (e.hex === e.was) return next;
  return [e, ...next];
}

export const remove = (edits, edit) => edits.filter((x) => !sameTarget(x, edit));

/** The override that applies to a color in a line: the line's own, else the all-lines one. */
export function find(edits, { brand, material, line, color }) {
  return (
    edits.find((e) => e.brand === brand && e.material === material && e.line === line && e.color === color) ||
    edits.find((e) => e.brand === brand && e.material === material && e.line === ALL_LINES && e.color === color) ||
    null
  );
}

/**
 * The database with the overrides applied. Brands and lines nothing touches
 * are shared with the original, so it is cheap to redo when an override changes.
 */
export function apply(db, edits) {
  if (!db || !edits.length) return db;
  const names = new Set(edits.map((e) => e.brand));
  return {
    ...db,
    brands: db.brands.map((b) => {
      if (!names.has(b.name)) return b;
      const mine = edits.filter((e) => e.brand === b.name);
      const materials = {};
      for (const [material, lines] of Object.entries(b.materials)) {
        materials[material] = lines.map((l) => {
          let touched = false;
          const colors = l.colors.map((c) => {
            const e = find(mine, { brand: b.name, material, line: l.name, color: c[0] });
            if (!e || e.hex === c[1]) return c;
            touched = true;
            return [c[0], e.hex, c[2], c[3], c[1]];
          });
          return touched ? { ...l, colors } : l;
        });
      }
      return { ...b, materials };
    }),
  };
}

/**
 * Each override with how it stands against the database (which can be the
 * original or one with overrides applied): state "ok", "changed" (the
 * database's hex is not what it was when you made the override; `dbNow` is
 * what it is now) or "missing" (the color is gone or renamed).
 */
export function report(db, edits) {
  return edits.map((e) => {
    const b = db?.brands.find((x) => x.name === e.brand);
    const lines = (b?.materials?.[e.material] || []).filter((l) => e.line === ALL_LINES || l.name === e.line);
    const entry = lines.flatMap((l) => l.colors).find((c) => c[0] === e.color);
    if (!entry) return { ...e, state: 'missing', dbNow: '' };
    const dbNow = entry[4] || entry[1];
    return { ...e, state: dbNow === e.was ? 'ok' : 'changed', dbNow };
  });
}

/** Merge an exported list into `edits`. Returns { edits, added }. */
export function importInto(edits, incoming) {
  if (!Array.isArray(incoming)) throw new Error('Not a list');
  const valid = clean(incoming);
  if (!valid.length && incoming.length) throw new Error('No overrides');
  let next = edits;
  let added = 0;
  for (const e of valid.reverse()) {
    const before = next;
    next = set(next, e);
    if (next !== before && !before.some((x) => sameTarget(x, e) && x.hex === e.hex)) added++;
  }
  return { edits: next, added };
}
