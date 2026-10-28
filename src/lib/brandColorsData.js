// Loads the brand-colors snapshot once, as its own chunk, for everything that
// needs it (brand names, the Material and Variant chips, the Brand colors
// panel), with OrcaSlicer's vendor names applied.
import { withOrcaNames } from './brandColors.js';
import orca from '../data/orca-vendors.json';

let loading = null;

export function loadBrandColors() {
  loading ??= import('../data/brand-colors.json')
    .then((m) => withOrcaNames(m.default, orca.vendors))
    .catch(() => withOrcaNames({ brands: [], source: {} }, orca.vendors));
  return loading;
}
