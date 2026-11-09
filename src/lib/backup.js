// Exporting and importing JSON files, and the one-file backup of everything
// kept on the device (Settings → Backup).
//
// Saving a file: on the website it is downloaded; in the Android app the
// WebView can't save downloads, so the backup opens the share sheet (save to
// Files or Drive, or send it), and the smaller per-card exports are copied.
import { Capacitor } from '@capacitor/core';
import { shareText } from './nfc/native.js';
import * as Filaments from './filaments.js';
import * as SC from './savedColors.js';
import * as Manual from './manualColors.js';
import * as CustomChips from './customChips.js';
import * as BrandList from './brandList.js';
import * as MaterialList from './materialList.js';
import * as VariantList from './variantList.js';
import * as Defaults from './defaults.js';
import * as SuggestionCount from './suggestionCount.js';
import * as Closeness from './suggestionCloseness.js';
import * as Theme from './theme.js';
import * as MotionSpeed from './motionSpeed.js';
import * as OpenMode from './openMode.js';

function download(json, filename) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Save `data` as a .json file. Returns { ok, message }. */
export async function exportJson(data, filename) {
  const json = JSON.stringify(data, null, 2);
  if (Capacitor.isNativePlatform()) {
    try {
      await navigator.clipboard.writeText(json);
      return { ok: true, message: 'Copied. Paste it somewhere safe, or into a .json file.' };
    } catch {
      return { ok: false, message: 'Couldn’t copy it.' };
    }
  }
  download(json, filename);
  return { ok: true, message: '' };
}

/** The JSON in a picked file, or throws. */
export async function readJsonFile(file) {
  return JSON.parse(await file.text());
}

// --- The backup of everything ---

export const FORMAT = 'FilaScribe backup';
export const VERSION = 1;

/** A stand-in for localStorage, so each store's own `load` can clean a backup's contents. */
function memory() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}

/**
 * Everything kept on the device that the user would be sad to lose. The
 * downloaded color database and which cards are open aren't included: the
 * first can be fetched again and the second is only layout.
 */
export function snapshot(storage = globalThis.localStorage) {
  const customChips = CustomChips.load(storage);
  return {
    filaments: Filaments.load(storage),
    autoFilaments: Filaments.loadAuto(storage),
    savedColors: SC.load(storage),
    colorOverrides: Manual.load(storage),
    customChips,
    brands: BrandList.load(storage, customChips.brands),
    materials: MaterialList.load(storage, customChips.materials),
    hiddenVariants: VariantList.load(storage),
    defaults: Defaults.load(storage),
    closestColors: SuggestionCount.load(storage),
    closestCloseness: Closeness.load(storage),
    theme: Theme.load(storage),
    motionSpeed: MotionSpeed.load(storage),
    openMode: OpenMode.load(storage),
  };
}

/** Write a snapshot back to storage (every store keeps its own limits and cleaning). */
export function apply(data, storage = globalThis.localStorage) {
  Filaments.store(data.filaments, storage);
  Filaments.storeAuto(data.autoFilaments, storage);
  SC.store(data.savedColors, storage);
  Manual.store(data.colorOverrides, storage);
  CustomChips.store(data.customChips, storage);
  BrandList.store(data.brands, storage);
  MaterialList.store(data.materials, storage);
  VariantList.store(data.hiddenVariants, storage);
  Defaults.store(data.defaults, storage);
  SuggestionCount.store(data.closestColors, storage);
  Closeness.store(data.closestCloseness, storage);
  Theme.store(data.theme, storage);
  MotionSpeed.store(data.motionSpeed, storage);
  OpenMode.store(data.openMode, storage);
}

/** The file's contents for a snapshot. */
export const build = (data, now = new Date()) => ({ app: FORMAT, version: VERSION, made: now.toISOString(), data });

export const backupName = (now = new Date()) => `filascribe-backup-${now.toISOString().slice(0, 10)}.json`;

/** The snapshot inside a backup file, cleaned by the stores, or throws when it isn't a FilaScribe backup. */
export function parse(file) {
  if (!file || typeof file !== 'object' || file.app !== FORMAT || !file.data || typeof file.data !== 'object' || Array.isArray(file.data)) {
    throw new Error('Not a FilaScribe backup');
  }
  if (!Number.isInteger(file.version) || file.version < 1 || file.version > VERSION) throw new Error('Newer backup');
  const d = file.data;
  const mem = memory();
  const put = (key, value) => {
    if (value !== undefined) mem.setItem(key, JSON.stringify(value));
  };
  put(Filaments.STORAGE_KEY, d.filaments);
  put(SC.STORAGE_KEY, d.savedColors);
  put(Manual.STORAGE_KEY, d.colorOverrides);
  put(CustomChips.STORAGE_KEY, d.customChips);
  put(BrandList.STORAGE_KEY, Array.isArray(d.brands) ? { shown: d.brands } : undefined);
  put(MaterialList.STORAGE_KEY, Array.isArray(d.materials) ? { shown: d.materials } : undefined);
  put(VariantList.STORAGE_KEY, Array.isArray(d.hiddenVariants) ? { hidden: d.hiddenVariants } : undefined);
  put(Defaults.STORAGE_KEY, d.defaults);
  if (d.closestColors !== undefined) mem.setItem(SuggestionCount.STORAGE_KEY, String(d.closestColors));
  if (typeof d.closestCloseness === 'string') mem.setItem(Closeness.STORAGE_KEY, d.closestCloseness);
  if (typeof d.theme === 'string') mem.setItem(Theme.STORAGE_KEY, d.theme);
  if (typeof d.motionSpeed === 'string') mem.setItem(MotionSpeed.STORAGE_KEY, d.motionSpeed);
  if (typeof d.openMode === 'string') mem.setItem(OpenMode.STORAGE_KEY, d.openMode);
  if (d.autoFilaments === true) mem.setItem(Filaments.AUTO_KEY, '1');
  return snapshot(mem);
}

const chipCount = (c) => c.brands.length + c.materials.length + Object.values(c.variants).reduce((n, l) => n + l.length, 0);

/** Your chips from both, nothing lost (the oldest go if a list is full). */
export function mergeChips(a, b) {
  const union = (x, y) => [...new Set([...x, ...y])].slice(-CustomChips.MAX);
  const variants = { ...a.variants };
  for (const [key, list] of Object.entries(b.variants)) variants[key] = union(variants[key] || [], list);
  return { brands: union(a.brands, b.brands), materials: union(a.materials, b.materials), variants };
}

/** Everything in `current` plus what's new in `incoming`; the settings come from `incoming`. */
export function merge(current, incoming) {
  return {
    ...incoming,
    filaments: Filaments.importInto(current.filaments, incoming.filaments).list,
    savedColors: SC.importInto(current.savedColors, incoming.savedColors).all,
    colorOverrides: Manual.importInto(current.colorOverrides, incoming.colorOverrides).edits,
    customChips: mergeChips(current.customChips, incoming.customChips),
  };
}

const savedRows = (all) => Object.values(all).reduce((n, l) => n + l.length, 0);

/** What the lists hold: [{ label, total }]. */
export const totals = (d) => [
  { label: 'My filaments', total: d.filaments.length },
  { label: 'Saved colors', total: savedRows(d.savedColors) },
  { label: 'Color overrides', total: d.colorOverrides.length },
  { label: 'Your chips', total: chipCount(d.customChips) },
];

/** What a backup holds and how much of it is new: [{ label, total, added }]. */
export function summary(current, incoming) {
  const chipsAfter = mergeChips(current.customChips, incoming.customChips);
  const added = [
    incoming.filaments.length ? Filaments.importInto(current.filaments, incoming.filaments).added : 0,
    SC.importInto(current.savedColors, incoming.savedColors).added,
    incoming.colorOverrides.length ? Manual.importInto(current.colorOverrides, incoming.colorOverrides).added : 0,
    chipCount(chipsAfter) - chipCount(current.customChips),
  ];
  return totals(incoming).map((r, i) => ({ ...r, added: added[i] }));
}

/** Save a backup file: downloaded on the website, the share sheet in the app. Returns { ok, message }. */
export async function saveBackup(data = snapshot(), now = new Date()) {
  const json = JSON.stringify(build(data, now), null, 2);
  const name = backupName(now);
  if (Capacitor.isNativePlatform()) {
    try {
      await shareText(name, json);
      return { ok: true, message: '' };
    } catch {
      return { ok: false, message: 'Couldn’t open the share sheet.' };
    }
  }
  download(json, name);
  return { ok: true, message: '' };
}
