// Turns the Open Filament Database's all-in-one download
// (https://api.openfilamentdatabase.org/json/all.json, MIT) into the small
// brand colors snapshot FilaScribe uses, and applies the corrections in
// scripts/color-overrides.json.
//
// One builder for both copies: the app runs it on the phone when you tap
// Check for updates, and scripts/build-brand-colors.js runs it to refresh the
// copy built into the app. No file access here, so it works in both places.
//
// all.json is flat lists joined by id:
//   { version: "2026.11.09", generated_at, brands: [{ id, name, slug }],
//     materials: [{ id, brand_id, material }],
//     filaments: [{ id, brand_id, material_id, name, discontinued, min_print_temperature, ... }],
//     variants: [{ filament_id, name, color_hex, color_hexes, hex_variants, traits, discontinued }],
//     sizes, stores, purchase_links (not used) }
//
// Snapshot (kept small):
// {
//   source: { repo, commit, date },
//   brands: [ { name, keys: [normalized names], materials: {
//     "<MATERIAL>": [ { name, temps: [nozzleMin, nozzleMax, bedMin, bedMax],
//                       traits: "m,s",          // traits every color in the line has
//                       colors: [ [name, "HEX1,HEX2", "g,m", "ALTHEX,..."] ] } ] } } ]
// }
// Discontinued colors and lines, and lines with no colors, are left out.
import { applyOverrides } from '../../scripts/color-overrides.js';

export const API_URL = 'https://api.openfilamentdatabase.org/';

// Database trait -> short code. Only traits FilaScribe uses are kept.
const TRAITS = {
  gradual_color_change: 'g', // colors blend along the strand -> Gradient
  coextruded: 'c', // side-by-side colors (dual/tri color)
  matte: 'm',
  silk: 's',
  high_flow: 'h',
  translucent: 't',
  transparent: 't',
  glow: 'w',
  contains_carbon_fiber: 'cf',
  contains_glass_fiber: 'gf',
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const hexes = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)).map((h) => h.slice(1).toUpperCase());
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const list = (v) => (Array.isArray(v) ? v.filter((e) => e && typeof e === 'object') : []);
// A fixed locale, so the phone and the build script sort alike whatever the language setting
const byText = (a, b) => a.localeCompare(b, 'en');

function traitCodes(traits) {
  const codes = new Set();
  for (const [k, on] of Object.entries(traits || {})) if (on && TRAITS[k]) codes.add(TRAITS[k]);
  return [...codes].sort();
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

/** The download's date as YYYY-MM-DD ("2026.11.09", or the day it was generated). */
export function datasetDate(all) {
  const v = typeof all?.version === 'string' && /^\d{4}\.\d{2}\.\d{2}$/.test(all.version) ? all.version.replaceAll('.', '-') : '';
  if (v) return v;
  return typeof all?.generated_at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(all.generated_at) ? all.generated_at.slice(0, 10) : '';
}

/**
 * Build the snapshot from a parsed all.json. Returns { snapshot, colors,
 * overrides: { applied, fixedUpstream, missing } }. Throws if `all` isn't the
 * database download at all; a download that is merely thin is left for the
 * caller's own checks.
 */
export function buildSnapshot(all, overrides = []) {
  if (!all || typeof all !== 'object' || !Array.isArray(all.brands) || !Array.isArray(all.filaments) || !Array.isArray(all.variants)) {
    throw new Error('not the Open Filament Database download');
  }
  const materialName = new Map(list(all.materials).map((m) => [m.id, m.material]));
  const linesOf = groupBy(list(all.filaments), 'brand_id');
  const colorsOf = groupBy(list(all.variants), 'filament_id');
  const brands = [];
  let colorCount = 0;

  for (const brand of list(all.brands)) {
    if (!brand.name) continue;
    // Lines grouped by material, in the order the database lists them
    const byMaterial = new Map();
    for (const line of linesOf.get(brand.id) || []) {
      if (line.discontinued || !line.name) continue;
      const colors = [];
      for (const v of colorsOf.get(line.id) || []) {
        if (v.discontinued || !v.name) continue;
        const main = hexes(v.color_hexes?.length ? v.color_hexes : v.color_hex);
        if (!main.length) continue;
        colors.push([String(v.name), main.join(','), traitCodes(v.traits).join(','), hexes(v.hex_variants).join(',')]);
      }
      if (!colors.length) continue;
      colors.sort((a, b) => byText(a[0], b[0]));
      // Line traits: those every color has (plus any set on the line itself)
      const per = colors.map((c) => new Set(c[2] ? c[2].split(',') : []));
      const common = [...per[0]].filter((t) => per.every((s) => s.has(t)));
      const lineTraits = [...new Set([...common, ...traitCodes(line.traits)])].sort();
      const material = String(materialName.get(line.material_id) || line.material || '').toUpperCase();
      if (!material) continue;
      if (!byMaterial.has(line.material_id)) byMaterial.set(line.material_id, { material, lines: [] });
      byMaterial.get(line.material_id).lines.push({
        name: String(line.name),
        temps: [num(line.min_print_temperature), num(line.max_print_temperature), num(line.min_bed_temperature), num(line.max_bed_temperature)],
        traits: lineTraits.join(','),
        colors,
      });
      colorCount += colors.length;
    }
    const materials = {};
    for (const { material, lines } of byMaterial.values()) {
      lines.sort((a, b) => byText(a.name, b.name));
      materials[material] = (materials[material] || []).concat(lines);
    }
    if (!Object.keys(materials).length) continue;
    // Names to match a FilaScribe brand against: the database's name and id,
    // with a trailing "3D" dropped ("eSUN 3D" -> esun)
    const keys = new Set([norm(brand.name), norm(brand.slug || '')].filter(Boolean));
    for (const k of [...keys]) if (k.endsWith('3d') && k.length > 4) keys.add(k.slice(0, -2));
    brands.push({ name: String(brand.name), keys: [...keys].sort(), materials });
  }

  const report = applyOverrides(brands, overrides);
  const snapshot = {
    // `commit` is the database's own version name; older snapshots carried a git commit there
    source: { repo: API_URL, commit: String(all.version || all.generated_at || 'unknown'), date: datasetDate(all) || 'unknown' },
    brands,
  };
  return { snapshot, colors: colorCount, overrides: report };
}
