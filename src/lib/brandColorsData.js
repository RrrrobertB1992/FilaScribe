// Loads the brand-colors database once, as its own chunk, for everything that
// needs it (brand names, the Material and Variant chips, the Brand colors
// panel), with OrcaSlicer's vendor names applied.
//
// The database is the one built into the app, or a newer one downloaded in
// Settings > Color database (see colorDatabase.js). `info` says which, and
// its date and totals.
import { withOrcaNames } from './brandColors.js';
import { describe, pickSource } from './colorDatabase.js';
import orca from '../data/orca-vendors.json';

let sourcePromise = null;
let loading = null;

const empty = () => ({ colors: { brands: [], source: {} }, orca, origin: 'built-in' });

/** The raw snapshot and OrcaSlicer names in use: { colors, orca, origin } */
export function loadSource() {
  sourcePromise ??= import('../data/brand-colors.json')
    .then((m) => pickSource({ colors: m.default, orca }))
    .catch(empty);
  return sourcePromise;
}

export function loadBrandColors() {
  loading ??= loadSource().then((s) => ({ ...withOrcaNames(s.colors, s.orca.vendors), info: describe(s) }));
  return loading;
}

/** After the downloaded copy was saved or removed: load again from the start. */
export function reloadBrandColors() {
  sourcePromise = null;
  loading = null;
  return loadBrandColors();
}
