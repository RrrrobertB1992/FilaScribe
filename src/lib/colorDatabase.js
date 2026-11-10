// The Brand colors database in use: what it is (date, brands, colors), checking
// for a newer one, and keeping a downloaded copy on this device.
//
// The app ships with a snapshot (src/data/brand-colors.json), refreshed with
// `npm run update-colors` before a release. "Check for updates" downloads the
// Open Filament Database's all-in-one file straight from its API (API_URL,
// rebuilt when something changes), builds the same kind of snapshot from it on this device
// (ofdSnapshot.js), checks it is well formed, and shows what changed; "Update
// now" keeps it on this device (IndexedDB), where it is used instead of the
// built-in copy, as long as it is newer. Your saved colors and color overrides
// are never touched. The brand names (orca-vendors.json) are built in only.
//
// A downloaded update that isn't installed yet is kept too (the built colors,
// not the 17 MB file) until it is installed or a newer one replaces it, and
// the last build found to hold no color changes is remembered, so checking
// again doesn't download it again. At app start, bootPlan() says what to do.
import { diffColors } from './snapshotDiff.js';
import { withOrcaNames } from './brandColors.js';
import * as Manual from './manualColors.js';
import { API_URL, buildSnapshot } from './ofdSnapshot.js';

export { API_URL };
export const MAX_AGE_DAYS = 30;
// With "Update automatically" on, a database this old is updated at app start
export const AUTO_AGE_DAYS = 7;
// A download with fewer colors than this share of the built-in copy is refused
const MIN_SHARE = 0.5;
const CHECKED_KEY = 'filascribe-color-database-checked';
const SEEN_KEY = 'filascribe-color-database-seen';

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

/**
 * How old the database counts as: from the later of its own date and the last
 * time it was confirmed to be the newest (`confirmedAt`, an ISO time). A
 * database that is days old but is still the newest isn't out of date.
 */
export function ageSince(date, confirmedAt = '', now = new Date()) {
  const own = ageDays(date, now);
  if (own === null) return null;
  const t = Date.parse(confirmedAt);
  if (Number.isNaN(t)) return own;
  return Math.max(0, Math.min(own, Math.floor((now.getTime() - t) / DAY)));
}

export const isOld = (date, now = new Date(), confirmedAt = '') => {
  const age = ageSince(date, confirmedAt, now);
  return age !== null && age >= MAX_AGE_DAYS;
};

/**
 * What to do at app start. `pending` is whether a downloaded update is waiting.
 *   'install-pending'  an update is waiting and Update automatically is on
 *   'show-pending'     an update is waiting: say so (See changes / Update now)
 *   'auto-update'      Update automatically is on and the database is 7+ days old
 *   'offer-download'   it is off and the database is 30+ days old: offer the download
 *   'none'
 * Nothing here uses the network; the age (or the waiting update) decides.
 */
export function bootPlan({ age, auto, pending }) {
  if (pending) return auto ? 'install-pending' : 'show-pending';
  if (age === null || age === undefined) return 'none';
  if (auto && age >= AUTO_AGE_DAYS) return 'auto-update';
  if (!auto && age >= MAX_AGE_DAYS) return 'offer-download';
  return 'none';
}

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

async function get(url, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, { cache: 'no-cache' });
  } catch {
    throw new UpdateError('Couldn’t reach the update. Check your connection and try again.');
  }
  if (!res.ok) throw new UpdateError(`Couldn’t download the update (${res.status}). Try again later.`);
  return res;
}

// Parse the body, reporting how many bytes have arrived where the browser can stream it
async function readJson(res, onBytes) {
  try {
    if (!onBytes || !res.body?.pipeThrough || typeof TransformStream === 'undefined') return await res.json();
    let loaded = 0;
    const counted = res.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          loaded += chunk.byteLength;
          onBytes(loaded);
          controller.enqueue(chunk);
        },
      }),
    );
    return await new Response(counted).json();
  } catch {
    throw new UpdateError('The download wasn’t a database file, so nothing was changed.');
  }
}

/**
 * What the API's small manifest says about the big download: its date, its
 * size on the way (compressed) and its full size. Anything missing is null.
 */
export function readManifest(manifest) {
  const v = manifest?.dataset_version;
  const date = typeof v === 'string' && /^\d{4}\.\d{2}\.\d{2}$/.test(v) ? v.replaceAll('.', '-') : null;
  const size = (path) => {
    const n = Array.isArray(manifest?.artifacts) ? manifest.artifacts.find((a) => a?.path === path)?.size : null;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  // When the files were built; the same build means the same data
  const g = manifest?.generated_at;
  const built = typeof g === 'string' && g.length > 0 && g.length < 64 ? g : null;
  return { date, built, wire: size('json/all.json.gz'), total: size('json/all.json') };
}

/**
 * Download the newest database and compare it with the one in use.
 * Returns { status: 'current' } or { status: 'update', next, info, changes,
 * overrides }. Nothing is saved until applyUpdate().
 *
 * The small manifest is read first: when it shows nothing newer, the big file
 * isn't downloaded at all. Nor is it when the manifest's build is the one
 * `seen` already found to hold no color changes, or the one `pending` (an
 * update downloaded earlier: { colors, built }) was made from. `onProgress` gets { stage: 'download', loaded,
 * total, wire } (sizes may be null) and then { stage: 'build' }.
 */
export async function checkForUpdate(current, { edits = [], fetchImpl = globalThis.fetch?.bind(globalThis), base = API_URL, onProgress = () => {}, seen = '', pending = null } = {}) {
  if (!fetchImpl) throw new UpdateError('This browser can’t download the update.');
  const inUse = current.colors.source?.date || '';

  // The manifest only saves a download, so the check carries on without it
  let about = { date: null, built: null, wire: null, total: null };
  try {
    about = readManifest(await (await get(`${base}manifest.json`, fetchImpl)).json());
  } catch {
    // No manifest: download the database and compare
  }
  if (about.date && about.date <= inUse) return { status: 'current' };
  if (about.built && seen && about.built === seen) return { status: 'current', built: about.built };

  // An update downloaded earlier is used when it is the newest there is (or when that can't be told)
  if (pending && (!about.built || about.built === pending.built)) {
    const update = makeUpdate(current, pending.colors, pending.built || about.built, edits);
    if (update) return { ...update, fromCache: true };
  }

  onProgress({ stage: 'download', loaded: 0, total: about.total, wire: about.wire });
  const res = await get(`${base}json/all.json`, fetchImpl);
  const all = await readJson(res, (loaded) => onProgress({ stage: 'download', loaded, total: about.total, wire: about.wire }));

  onProgress({ stage: 'build' });
  // Loaded only now: the corrections aren't needed until an update is checked
  const { default: corrections } = await import('../../scripts/color-overrides.json');
  let colors;
  try {
    colors = buildSnapshot(all, corrections).snapshot;
  } catch {
    throw new UpdateError('The download wasn’t a database file, so nothing was changed.');
  }
  const bad = problemWith(colors, { builtInColors: countColors(current.colors) });
  if (bad) throw new UpdateError(`The downloaded database didn’t look right (${bad}), so nothing was changed.`);

  return makeUpdate(current, colors, about.built, edits) || { status: 'current', built: about.built || undefined };
}

// The update that `colors` would make, or null when it changes nothing or is older than what is in use
// (a newer app build can carry a newer built-in copy)
function makeUpdate(current, colors, built, edits) {
  const next = { colors, orca: current.orca, origin: 'downloaded' };
  const changes = diffColors(current.colors.brands, colors.brands);
  const different = changes.brands.size > 0 || changes.newBrands.length > 0 || changes.goneBrands.length > 0;
  if (!different || colors.source.date < (current.colors.source?.date || '')) return null;
  return { status: 'update', next, info: describe(next), changes, overrides: overridesImpact(current, next, edits), built: built || undefined };
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
const PENDING = 'pending';

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

const place = (record) => ({
  read: () => run('readonly', (s) => s.get(record)),
  write: (value) => run('readwrite', (s) => s.put(value, record)),
  clear: () => run('readwrite', (s) => s.delete(record)),
});

/** The default place to keep the downloaded copy. Tests pass their own. */
export const deviceStorage = place(RECORD);
/** The default place to keep an update that is downloaded but not installed. */
export const pendingStorage = place(PENDING);

/**
 * The copy to use: the downloaded one if it is valid and newer than the
 * built-in one, else the built-in one. A broken stored copy is ignored.
 */
export async function pickSource(builtIn, storage = deviceStorage) {
  try {
    const saved = await storage.read();
    if (saved && !problemWith(saved.colors, { builtInColors: countColors(builtIn.colors) }) && saved.colors.source.date > (builtIn.colors.source?.date || '')) {
      // The brand names always come from the app (a copy saved by an older version also held names; they are ignored)
      return { colors: saved.colors, orca: builtIn.orca, origin: 'downloaded' };
    }
  } catch {
    // No storage, or nothing saved
  }
  return { ...builtIn, origin: 'built-in' };
}

/** Keep a checked update on this device. It is no longer waiting once it is in use. */
export async function applyUpdate(next, storage = deviceStorage, pendingStore = pendingStorage) {
  try {
    await storage.write({ colors: next.colors, savedAt: new Date().toISOString() });
  } catch {
    throw new UpdateError('Couldn’t save the update on this device, so nothing was changed.');
  }
  await clearPending(pendingStore);
}

// --- An update downloaded but not installed yet ---

/** Keep a downloaded update to use later. Not being able to is fine: it is downloaded again when needed. */
export async function savePending(update, storage = pendingStorage) {
  try {
    await storage.write({ colors: update.next.colors, built: update.built || '', savedAt: new Date().toISOString() });
  } catch {
    // Not kept
  }
}

export async function clearPending(storage = pendingStorage) {
  try {
    await storage.clear();
  } catch {
    // Nothing to clear, or no storage
  }
}

/**
 * The waiting update as { status: 'update', ... } (what checkForUpdate gives),
 * or null. One that is broken, that changes nothing, or that the app already
 * has something as new as (a newer built-in copy, or it was installed some
 * other way) is forgotten.
 */
export async function loadPending(current, { edits = [], storage = pendingStorage } = {}) {
  let saved;
  try {
    saved = await storage.read();
  } catch {
    return null;
  }
  if (!saved) return null;
  const ok = saved.colors && !problemWith(saved.colors, { builtInColors: countColors(current.colors) }) && saved.colors.source.date > (current.colors.source?.date || '');
  const update = ok ? makeUpdate(current, saved.colors, typeof saved.built === 'string' ? saved.built : '', edits) : null;
  if (!update) await clearPending(storage);
  return update;
}

/**
 * checkForUpdate() that also remembers what it learns: an update is kept as
 * the waiting one, and a build with no color changes (or the newest database
 * already in use) isn't looked at again. Failures are thrown as before.
 */
export async function checkAndRemember(current, { pendingStore = pendingStorage, local = globalThis.localStorage, ...options } = {}) {
  const seen = loadSeen(local);
  const waiting = await loadPending(current, { edits: options.edits, storage: pendingStore });
  const result = await checkForUpdate(current, { ...options, seen: seen.built, pending: waiting && { colors: waiting.next.colors, built: waiting.built } });
  if (result.status === 'update') {
    if (!result.fromCache) await savePending(result, pendingStore);
  } else {
    // The newest there is: the database counts as new from now
    storeSeen({ built: result.built || seen.built, at: new Date().toISOString() }, local);
    if (result.built) await clearPending(pendingStore); // an update from an older build that is no longer wanted
  }
  return result;
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

// --- The last build found to hold nothing new, and when the database was last the newest ---

/** { built, at }: the last build with no color changes, and the last time the database was confirmed current. */
export function loadSeen(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(SEEN_KEY) || 'null');
    return {
      built: v && typeof v.built === 'string' && v.built.length < 64 ? v.built : '',
      at: v && typeof v.at === 'string' && !Number.isNaN(Date.parse(v.at)) ? v.at : '',
    };
  } catch {
    return { built: '', at: '' };
  }
}

export function storeSeen({ built = '', at = new Date().toISOString() } = {}, storage = globalThis.localStorage) {
  try {
    storage.setItem(SEEN_KEY, JSON.stringify({ built, at }));
  } catch {
    // Storage unavailable: it just isn't remembered
  }
}
