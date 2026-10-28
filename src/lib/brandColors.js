// Brand colors: named colors per brand and material, from a bundled snapshot
// of the Open Filament Database (src/data/brand-colors.json, built by
// scripts/build-brand-colors.js).
//
// Every filament line belongs to one group, and the groups are the variant
// chips (Basic, Matte, Silk, HF, ... Wood, Galaxy, Glow, Multi-color ...):
//  - a variant chip shows its group; no variant shows Basic
//  - each brand only gets chips for the groups it has, named with its own
//    word where it uses one ("Metal", "Luminous", "Transparent")
//  - within a group, look-alike colors (same name, nearly the same shade)
//    from different lines are shown once
//  - a Custom variant shows the lines whose name contains it
//  - "show all" shows every original line, nothing merged

import { VARIANTS } from './catalog.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s) => String(s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const traitSet = (codes) => new Set(codes ? codes.split(',') : []);

// FilaScribe material chips that the database files elsewhere
const MATERIAL_ALIASES = {
  PA: { materials: ['PA6', 'PA11'] },
  'PLA-CF': { materials: ['PLA'], fiber: 'cf' },
  'PETG-CF': { materials: ['PETG'], fiber: 'cf' },
  'PA-CF': { materials: ['PA6', 'PA11', 'PA12'], fiber: 'cf' },
};

// Line name -> group, first match wins. Finishes come before Multi-color, so
// "Silk PLA+ Dual-Color" is Silk (the subtype the U1 would use); HF comes
// after the finishes, so "High Speed Matte PLA" is Matte.
const GROUP_RULES = [
  ['95A HF', /\b95a\b.*\bhf\b|\bhf\b.*\b95a\b/],
  ['95A', /\b95a\b/],
  ['Support', /\bsupport\b|breakaway|soluble/],
  ['SnapSpeed', /snapspeed/],
  ['Wood', /wood/],
  ['Marble', /marble|stone|granite|\brock\b/],
  ['Glow', /glow|luminous|phosphor/],
  ['Galaxy', /galaxy|sparkle|glitter|twinkl|starry|\bstar\b/],
  ['Metallic', /\bmetal|metallic/],
  ['Silk', /silk|satin/],
  ['Matte', /matte/],
  ['Color change', /temperature|colou?r.?chang|chameleon|thermo/],
  ['Fluorescent', /fluor|neon|\buv\b/],
  ['Translucent', /translucent|transparent|\bclear\b|crystal/],
  ['Basic', /\bbasic\b/],
  ['HF', /\bhf\b|high.?speed|rapid|hyper|\bspeed\b/],
  ['Multi-color', /rainbow|gradient|multi.?colou?r|dual|tri.?colou?r|triple|\btri\b|four.?colou?r|quadruple|coextru/],
];
// Fallbacks from the database's finish tags when the name says nothing
const TRAIT_GROUPS = [['w', 'Glow'], ['s', 'Silk'], ['m', 'Matte'], ['t', 'Translucent'], ['h', 'HF'], ['g', 'Multi-color'], ['c', 'Multi-color']];

/** The variant chips that are also groups (every chip except "None"). */
export const GROUPS = VARIANTS.filter(Boolean);

/** The group (a variant chip) a line belongs to. */
export function groupOf(line) {
  const name = line.name.toLowerCase().replace(/[-_]/g, ' ');
  for (const [group, re] of GROUP_RULES) if (re.test(name)) return group;
  const t = traitSet(line.traits);
  for (const [code, group] of TRAIT_GROUPS) if (t.has(code)) return group;
  return 'Basic';
}

// The words brands use for each group, most specific first. A brand whose
// lines in a group all use one of these words gets that word as its chip
// (Bambu "PLA Metal" -> "Metal"); otherwise the chip is the group name.
const SYNONYMS = {
  Metallic: ['Metallic', 'Metal'],
  Galaxy: ['Galaxy', 'Sparkle', 'Twinkling', 'Glitter', 'Starry', 'Stars'],
  Glow: ['Glow', 'Luminous'],
  Translucent: ['Translucent', 'Transparent', 'Clear', 'Crystal'],
  Fluorescent: ['Fluorescent', 'Neon', 'UV'],
  Marble: ['Marble', 'Stone', 'Granite', 'Rock'],
  Silk: ['Silk', 'Satin'],
  HF: ['HF', 'High Speed', 'Rapid', 'Hyper'],
  'Multi-color': ['Rainbow', 'Gradient', 'Dual-Color', 'Tri-Color', 'Multi-Color'],
  'Color change': ['Chameleon', 'Color Change'],
};
const plain = (s) => ` ${String(s).toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()} `;
const SYNONYM_GROUP = new Map(
  Object.entries(SYNONYMS).flatMap(([g, ws]) => ws.map((w) => [norm(w), g])),
);

/** The brand's own word for a line's group, or null if its name uses none. */
function wordFor(line, group) {
  const name = plain(line.name);
  return (SYNONYMS[group] || []).find((w) => name.includes(plain(w))) || null;
}

/** The group a variant (chip, synonym or Custom text) stands for, or null. */
function groupKey(v) {
  const n = norm(v);
  if (!n) return null;
  return GROUPS.find((g) => norm(g) === n) || SYNONYM_GROUP.get(n) || null;
}

/**
 * The variant chips for a brand + material: '' (None), then one chip per
 * group the brand has, in the usual order, named with the brand's own word
 * where it has one. Brands or materials not in the database get the full
 * default list.
 */
export function variantChoices(db, brand, type) {
  const lines = db ? linesForMaterial(db, brand, type) : [];
  if (!lines.length) return VARIANTS;
  const byGroup = new Map();
  for (const l of lines) {
    const g = groupOf(l);
    if (!byGroup.has(g)) byGroup.set(g, new Set());
    const w = wordFor(l, g);
    byGroup.get(g).add(w ?? g);
  }
  const labels = GROUPS.filter((g) => byGroup.has(g)).map((g) => {
    const words = [...byGroup.get(g)];
    return words.length === 1 ? words[0] : g;
  });
  return ['', ...labels];
}

/**
 * The variant to keep when the brand or material changes: the same chip if
 * the new brand has it, the new brand's word for the same group ("Metal" ->
 * "Metallic"), or one of `keep` (variants saved colors use for the new brand
 * + material); otherwise '' (None).
 */
export function carryVariant(db, variant, brand, type, keep = []) {
  const v = String(variant ?? '').trim();
  if (!v) return '';
  const choices = variantChoices(db, brand, type);
  if (choices.includes(v) || keep.includes(v)) return v;
  const group = groupKey(v);
  return (group && choices.find((c) => c && groupKey(c) === group)) || '';
}

/** The database brand for a FilaScribe brand name, or null. */
export function findBrand(db, brand) {
  const key = norm(brand);
  if (!key || !db) return null;
  return db.brands.find((b) => b.keys.includes(key)) || null;
}

/** Every line for a brand + material (FilaScribe names), before grouping. */
export function linesForMaterial(db, brand, type) {
  const b = findBrand(db, brand);
  if (!b) return [];
  const t = String(type ?? '').trim().toUpperCase();
  const alias = MATERIAL_ALIASES[t];
  const fiberOf = (l) => (traitSet(l.traits).has('cf') || /\bcf\b|carbon/i.test(l.name.replace(/-/g, ' ')) ? 'cf'
    : traitSet(l.traits).has('gf') || /\bgf\b|glass fib/i.test(l.name.replace(/-/g, ' ')) ? 'gf' : null);
  const lines = alias ? alias.materials.flatMap((m) => b.materials[m] || []) : b.materials[t] || [];
  if (alias?.fiber) return lines.filter((l) => fiberOf(l) === alias.fiber);
  // A plain material leaves out its carbon/glass fiber lines when they have their own chip
  return MATERIAL_ALIASES[`${t}-CF`] ? lines.filter((l) => !fiberOf(l)) : lines;
}

/** Does a line's name contain this (Custom) variant? */
export function lineMatchesVariant(line, variant) {
  const want = words(variant);
  if (!want.length) return false;
  const name = new Set(words(line.name.replace(/\+/g, ' plus ')));
  return want.every((w) => name.has(w));
}

/**
 * Lines to show for the form. Returns { lines, filter, group, total }:
 *  filter 'group'   a variant chip: the lines in its group
 *         'basic'   no variant: the Basic group
 *         'name'    a Custom variant: the lines whose name contains it
 *         'all'     showAll: every line
 *         'nomatch' nothing fits (lines is empty; total says how many exist)
 */
export function linesFor(db, { brand, type, variant = '', showAll = false }) {
  const all = linesForMaterial(db, brand, type);
  const total = all.length;
  if (showAll || !total) return { lines: all, filter: 'all', group: null, total };
  const v = String(variant ?? '').trim();
  const group = groupKey(v || 'Basic');
  if (group) {
    const lines = all.filter((l) => groupOf(l) === group);
    return lines.length ? { lines, filter: v ? 'group' : 'basic', group, total } : { lines: [], filter: 'nomatch', group, total };
  }
  const lines = all.filter((l) => lineMatchesVariant(l, v));
  return lines.length ? { lines, filter: 'name', group: null, total } : { lines: [], filter: 'nomatch', group: null, total };
}

/** A color entry as { name, colors: [hex], gradient, traits, alt: [hex] }. */
export function colorInfo(entry) {
  const [name, hex, traits, alt] = entry;
  const t = traitSet(traits);
  const colors = hex.split(',');
  return { name, colors, gradient: colors.length > 1 && t.has('g'), traits: t, alt: alt ? alt.split(',') : [] };
}

/** Stable id for a color in a line. */
export const colorId = (line, entry) => `${line.name}|${entry[0]}|${entry[1]}`;

function rgb(hex) {
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** Nearly the same shade: every color within a small RGB distance. */
export function lookAlike(a, b, limit = 40) {
  const x = a.split(','), y = b.split(',');
  if (x.length !== y.length) return false;
  return x.every((h, i) => {
    const [p, q] = [rgb(h), rgb(y[i])];
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= limit;
  });
}

/**
 * Tiles for these lines: { line, entry, id, info, alsoIn: [line names] }.
 * With merge, a color with the same name and nearly the same shade as one
 * already listed (from another line) is folded into it.
 */
export function tilesFor(lines, { merge = true } = {}) {
  const tiles = [];
  for (const line of lines) {
    for (const entry of line.colors) {
      if (merge) {
        const twin = tiles.find((t) => t.line !== line && norm(t.entry[0]) === norm(entry[0]) && lookAlike(t.entry[1], entry[1]));
        if (twin) {
          if (!twin.alsoIn.includes(line.name)) twin.alsoIn.push(line.name);
          continue;
        }
      }
      tiles.push({ line, entry, id: colorId(line, entry), info: colorInfo(entry), alsoIn: [] });
    }
  }
  return tiles;
}

/**
 * The variant chip for a line: its group, named the way variantChoices
 * names it for this brand + material (e.g. "Metal" for Bambu Lab PLA).
 */
export function suggestedVariant(line, db = null, brand = '', type = '') {
  const group = groupOf(line);
  if (!db) return group;
  return variantChoices(db, brand, type).find((c) => c && groupKey(c) === group) || group;
}

/**
 * Find a color matching these hex values among a brand + material's lines,
 * looking first in the lines the variant shows (several lines can share a
 * color such as pure white), starting with the line named after it. A single color also matches a color's
 * alternate hex values. Returns { line, entry } or null.
 */
export function findColor(db, { brand, type, variant = '' }, colors) {
  const want = colors.map((c) => c.toUpperCase()).join(',');
  // The variant's group, with the line named after the variant first ("PLA
  // Basic" before "PLA Aero" for a Basic tag), then every other line
  const group = linesFor(db, { brand, type, variant }).lines;
  const named = group.filter((l) => lineMatchesVariant(l, variant || 'Basic'));
  const preferred = [...named, ...group.filter((l) => !named.includes(l))];
  const ordered = [...preferred, ...linesForMaterial(db, brand, type).filter((l) => !preferred.includes(l))];
  for (const line of ordered) {
    for (const entry of line.colors) {
      if (entry[1] === want) return { line, entry };
      if (colors.length === 1 && entry[3] && entry[3].split(',').includes(want)) return { line, entry };
    }
  }
  return null;
}
