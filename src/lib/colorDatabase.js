// The Brand colors database in use: what it is (date, brands, colors), checking
// for a newer one, and keeping a downloaded copy on this device.
//
// The app ships with a snapshot (src/data/brand-colors.json and
// orca-vendors.json). The monthly "Update brand colors" workflow rebuilds it
// from the Open Filament Database and opens a pull request; once it is merged
// the finished files on the main branch (DATA_URL) are the newest database.
// "Check for updates" downloads them,
// checks they are well formed, and shows what changed; "Update now" keeps them
// on this device (IndexedDB), where they are used instead of the built-in
// copy, as long as they are newer. Your saved colors and color overrides are
// never touched.
import { diffColors, diffNames } from './snapshotDiff.js';
import { withOrcaNames } from './brandColors.js';
import * as Manual from './manualColors.js';

export const DATA_URL = 'https://raw.githubusercontent.com/RrrrobertB1992/FilaScribe/main/src/data/';
export const MAX_AGE_DAYS = 35;
// A download with fewer colors than this share of the built-in copy is refused
const MIN_SHARE = 0.5;
const CHECKED_KEY = 'filascribe-color-database-checked';

const DAY = 86400000;
const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const isText = (s) => typeof s === 'string' && s.length > 0;

/** Brands and colors in a snapshot's brand list. */
export function countColors(colors) {
  let n = 0;
  for (const b of colors?.brands || []) for (const lines of Object.values(b.materials || {})) for (const l of lines) n += l.colors.length;
  return n;
}

/** What Settings shows about the database in use. `source` is { colors, orca, origin }. */
export function describe(source) {
  const colors = source.colors;
  return {
    origin: source.origin, // 'built-in' or 'downloaded'
    date: colors.source?.date || '',
    commit: colors.source?.commit || '',
    repo: colors.source?.repo || '',
    brands: colors.brands.length,
    colors: countColors(colors),
    orcaDate: source.orca?.source?.date || '',
    orcaCommit: source.orca?.source?.commit || '',
    orcaRepo: source.orca?.source?.repo || '',
  };
}

/** Whole days between a database date (YYYY-MM-DD) and now, or null if the date isn't usable. */
export function ageDays(date, now = new Date()) {
  if (!isDate(date)) return null;
  return Math.floor((now.getTime() - Date.parse(`${date}T00:00:00Z`)) / DAY);
}

export const isOld = (date, now = new Date()) => {
  const age = ageDays(date, now);
  return age !== null && age > MAX_AGE_DAYS;
};

/**
 * Is this a brand colors snapshot the app can use? Returns '' when it is, or
 * what is wrong. Walks every color, so a cut-off or reshaped file is refused
 * instead of breaking the Brand colors panel.
 */
export function problemWith(colors, { builtInColors = 0 } = {}) {
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) return 'not a database';
  if (!colors.source || typeof colors.source !== 'object' || !isDate(colors.source.date) || !isText(colors.source.commit)) return 'no date';
  if (!Array.isArray(colors.brands) || !colors.brands.length) return 'no brands';
  for (const b of colors.brands) {
    if (!b || !isText(b.name) || !Array.isArray(b.keys) || !b.materials || typeof b.materials !== 'object' || Array.isArray(b.materials)) return 'a brand is malformed';
    for (const lines of Object.values(b.materials)) {
      if (!Array.isArray(lines)) return 'a material is malformed';
      for (const l of lines) {
        if (!l || !isText(l.name) || !Array.isArray(l.temps) || !Array.isArray(l.colors)) return 'a line is malformed';
        for (const c of l.colors) {
          if (!Array.isArray(c) || !isText(c[0]) || typeof c[1] !== 'string') return 'a color is malformed';
        }
      }
    }
  }
  if (builtInColors && countColors(colors) < builtInColors * MIN_SHARE) return 'far fewer colors than expected';
  return '';
}

export function orcaProblem(orca) {
  if (!orca || typeof orca !== 'object' || !Array.isArray(orca.vendors) || !orca.vendors.length) return 'no brand names';
  if (!orca.vendors.every(isText)) return 'brand names are malformed';
  if (!orca.source || !isDate(orca.source.date)) return 'no date';
  return '';
}

/** What an update does to your color overrides: { changed, gone } counts. */
export function overridesImpact(current, next, edits) {
  if (!edits?.length) return { changed: 0, gone: 0 };
  const before = Manual.report(withOrcaNames(current.colors, current.orca.vendors), edits);
  const after = Manual.report(withOrcaNames(next.colors, next.orca.vendors), edits);
  let changed = 0;
  let gone = 0;
  after.forEach((a, i) => {
    const b = before[i];
    if (a.state === 'missing' && b.state !== 'missing') gone++;
    else if (a.state === 'changed' && (b.state !== 'changed' || a.dbNow !== b.dbNow)) changed++;
  });
  return { changed, gone };
}

/** The error for the card: what went wrong and what to do. */
export class UpdateError extends Error {}

async function getJson(url, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, { cache: 'no-cache' });
  } catch {
    throw new UpdateError('Couldn’t reach the update. Check your connection and try again.');
  }
  if (!res.ok) throw new UpdateError(`Couldn’t download the update (${res.status}). Try again later.`);
  try {
    return await res.json();
  } catch {
    throw new UpdateError('The download wasn’t a database file, so nothing was changed.');
  }
}

/**
 * Download the newest database and compare it with the one in use.
 * Returns { status: 'current' } or { status: 'update', next, info, changes,
 * names, overrides }. Nothing is saved until applyUpdate().
 */
export async function checkForUpdate(current, { edits = [], fetchImpl = globalThis.fetch?.bind(globalThis), base = DATA_URL } = {}) {
  if (!fetchImpl) throw new UpdateError('This browser can’t download the update.');
  const [colors, orca] = await Promise.all([getJson(`${base}brand-colors.json`, fetchImpl), getJson(`${base}orca-vendors.json`, fetchImpl)]);
  const bad = problemWith(colors, { builtInColors: countColors(current.colors) }) || orcaProblem(orca);
  if (bad) throw new UpdateError(`The downloaded database didn’t look right (${bad}), so nothing was changed.`);

  const next = { colors, orca, origin: 'downloaded' };
  const changes = diffColors(current.colors.brands, colors.brands);
  const names = diffNames(current.orca.vendors, orca.vendors);
  const different = changes.brands.size > 0 || changes.newBrands.length > 0 || changes.goneBrands.length > 0 || names.added.length > 0 || names.removed.length > 0;
  // Never swap in a database that is older than the one in use (a newer app build can carry a newer built-in copy)
  if (!different || colors.source.date < (current.colors.source?.date || '')) return { status: 'current' };
  return { status: 'update', next, info: describe(next), changes, names, overrides: overridesImpact(current, next, edits) };
}

/** Totals for "3 new brands, 118 new colors, 12 colors changed, 4 removed". */
export function summarize(changes) {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const c of changes.brands.values()) {
    added += c.added.length;
    removed += c.removed.length;
    changed += c.changed.length;
  }
  return { newBrands: changes.newBrands.length, goneBrands: changes.goneBrands.length, added, removed, changed };
}

// --- Keeping the downloaded copy (IndexedDB) ---

const DB_NAME = 'filascribe-color-database';
const STORE = 'database';
const RECORD = 'current';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The default place to keep the downloaded copy. Tests pass their own. */
export const deviceStorage = {
  read: () => run('readonly', (s) => s.get(RECORD)),
  write: (value) => run('readwrite', (s) => s.put(value, RECORD)),
  clear: () => run('readwrite', (s) => s.delete(RECORD)),
};

/**
 * The copy to use: the downloaded one if it is valid and newer than the
 * built-in one, else the built-in one. A broken stored copy is ignored.
 */
export async function pickSource(builtIn, storage = deviceStorage) {
  try {
    const saved = await storage.read();
    if (saved && !problemWith(saved.colors, { builtInColors: countColors(builtIn.colors) }) && !orcaProblem(saved.orca) && saved.colors.source.date > (builtIn.colors.source?.date || '')) {
      return { colors: saved.colors, orca: saved.orca, origin: 'downloaded' };
    }
  } catch {
    // No storage, or nothing saved
  }
  return { ...builtIn, origin: 'built-in' };
}

/** Keep a checked update on this device. */
export async function applyUpdate(next, storage = deviceStorage) {
  try {
    await storage.write({ colors: next.colors, orca: next.orca, savedAt: new Date().toISOString() });
  } catch {
    throw new UpdateError('Couldn’t save the update on this device, so nothing was changed.');
  }
}

/** Forget the downloaded copy and go back to the one built into the app. */
export async function useBuiltIn(storage = deviceStorage) {
  try {
    await storage.clear();
  } catch {
    throw new UpdateError('Couldn’t remove the downloaded copy. Try again.');
  }
}

// --- When it was last checked ---

export function loadChecked(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(CHECKED_KEY) || 'null');
    return v && typeof v.at === 'string' && !Number.isNaN(Date.parse(v.at)) ? v.at : '';
  } catch {
    return '';
  }
}

export function storeChecked(at = new Date().toISOString(), storage = globalThis.localStorage) {
  try {
    storage.setItem(CHECKED_KEY, JSON.stringify({ at }));
  } catch {
    // Storage unavailable: it just isn't remembered
  }
}
