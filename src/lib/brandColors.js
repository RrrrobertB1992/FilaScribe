// Brand colors: named colors per brand, material and filament line, from a
// bundled snapshot of the Open Filament Database (src/data/brand-colors.json,
// built by scripts/build-brand-colors.js).
//
// Lines are narrowed down by the form's variant (subtype):
//  - a variant shows the lines whose name contains it, or whose colors all
//    have the matching finish (Matte, Silk, HF = high flow); lines that fit
//    a more specific variant (e.g. "95A HF" when "95A" is picked) are left out
//  - no variant shows the lines that fit none of the variant chips (Galaxy,
//    Wood, Translucent...), i.e. spools usually written without a subtype
//  - "show all" shows every line for the brand and material

import { VARIANTS } from './catalog.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s) => String(s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const traitSet = (codes) => new Set(codes ? codes.split(',') : []);

// Variant chips that a finish trait also counts as
const VARIANT_TRAIT = { matte: 'm', silk: 's', hf: 'h' };

// FilaScribe material chips that the database files elsewhere
const MATERIAL_ALIASES = {
  PA: { materials: ['PA6', 'PA11'] },
  'PLA-CF': { materials: ['PLA'], fiber: 'cf' },
  'PETG-CF': { materials: ['PETG'], fiber: 'cf' },
  'PA-CF': { materials: ['PA6', 'PA11', 'PA12'], fiber: 'cf' },
};

/** The database brand for a FilaScribe brand name, or null. */
export function findBrand(db, brand) {
  const key = norm(brand);
  if (!key || !db) return null;
  return db.brands.find((b) => b.keys.includes(key)) || null;
}

/** Every line for a brand + material (FilaScribe names), before variant filtering. */
export function linesForMaterial(db, brand, type) {
  const b = findBrand(db, brand);
  if (!b) return [];
  const t = String(type ?? '').trim().toUpperCase();
  const alias = MATERIAL_ALIASES[t];
  const fiberOf = (l) => (traitSet(l.traits).has('cf') || /\bcf\b/i.test(l.name.replace(/-/g, ' ')) ? 'cf'
    : traitSet(l.traits).has('gf') || /\bgf\b/i.test(l.name.replace(/-/g, ' ')) ? 'gf' : null);
  const lines = alias ? alias.materials.flatMap((m) => b.materials[m] || []) : b.materials[t] || [];
  if (alias?.fiber) return lines.filter((l) => fiberOf(l) === alias.fiber);
  // A plain material leaves out its carbon/glass fiber lines when they have their own chip
  return MATERIAL_ALIASES[`${t}-CF`] ? lines.filter((l) => !fiberOf(l)) : lines;
}

/** Does this line fit this variant (subtype)? */
export function lineMatchesVariant(line, variant) {
  const want = words(variant);
  if (!want.length) return false;
  const name = words(line.name.replace(/\+/g, ' plus '));
  const nameWords = new Set(name);
  const byName = want.every((w) => nameWords.has(w)) || (want.length === 1 && name.some((w) => w.startsWith(want[0]) && w.length - want[0].length <= 1));
  const trait = VARIANT_TRAIT[norm(variant)];
  return byName || (!!trait && traitSet(line.traits).has(trait));
}

/** Variant chips (non-empty) that are more specific than this one, e.g. "95A HF" for "95A". */
function moreSpecific(variant) {
  const want = words(variant);
  return VARIANTS.filter((v) => v && norm(v) !== norm(variant) && want.every((w) => words(v).includes(w)));
}

/**
 * Lines to show for the form. Returns { lines, filter, total } where filter
 * is 'variant' (narrowed by the variant), 'none' (no variant: lines that fit
 * no chip), 'all' (showAll), or 'nomatch' (the variant fits no line: lines
 * is empty and total says how many exist).
 */
export function linesFor(db, { brand, type, variant = '', showAll = false }) {
  const all = linesForMaterial(db, brand, type);
  const total = all.length;
  if (showAll || !total) return { lines: all, filter: 'all', total };
  const v = String(variant ?? '').trim();
  if (!v) {
    const chips = VARIANTS.filter(Boolean);
    const lines = all.filter((l) => !chips.some((c) => lineMatchesVariant(l, c)));
    return lines.length ? { lines, filter: 'none', total } : { lines: [], filter: 'nomatch', total };
  }
  const specific = moreSpecific(v);
  const lines = all.filter((l) => lineMatchesVariant(l, v) && !specific.some((s) => lineMatchesVariant(l, s)));
  return lines.length ? { lines, filter: 'variant', total } : { lines: [], filter: 'nomatch', total };
}

/** A color entry as { name, colors: [hex], gradient, traits, alt: [hex] }. */
export function colorInfo(entry) {
  const [name, hex, traits, alt] = entry;
  const t = traitSet(traits);
  const colors = hex.split(',');
  return { name, colors, gradient: colors.length > 1 && t.has('g'), traits: t, alt: alt ? alt.split(',') : [] };
}

/** The variant chip a line fits best (most specific), or '' if none. */
export function suggestedVariant(line) {
  const fits = VARIANTS.filter((v) => v && lineMatchesVariant(line, v));
  fits.sort((a, b) => words(b).length - words(a).length);
  return fits[0] || '';
}

/**
 * Find a color matching these hex values among a brand + material's lines,
 * looking first in the lines that fit the variant (several lines can share
 * a color such as pure white). A single color also matches a color's
 * alternate hex values. Returns { line, entry } or null.
 */
export function findColor(db, { brand, type, variant = '' }, colors) {
  const want = colors.map((c) => c.toUpperCase()).join(',');
  const preferred = linesFor(db, { brand, type, variant }).lines;
  const ordered = [...preferred, ...linesForMaterial(db, brand, type).filter((l) => !preferred.includes(l))];
  for (const line of ordered) {
    for (const entry of line.colors) {
      if (entry[1] === want) return { line, entry };
      if (colors.length === 1 && entry[3] && entry[3].split(',').includes(want)) return { line, entry };
    }
  }
  return null;
}

/** Stable id for a color in a line. */
export const colorId = (line, entry) => `${line.name}|${entry[0]}|${entry[1]}`;
