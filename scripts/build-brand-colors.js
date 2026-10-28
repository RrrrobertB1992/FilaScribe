// Builds src/data/brand-colors.json from an Open Filament Database checkout
// (https://github.com/OpenFilamentCollective/open-filament-database, MIT).
//
// Usage: node scripts/build-brand-colors.js <ofd-checkout> [out-file]
//        node scripts/build-brand-colors.js --summary <snapshot-file>
//        node scripts/build-brand-colors.js --same <snapshot-a> <snapshot-b>
//          (exit 0 if they hold the same colors, ignoring the source commit)
//
// Output (kept small; loaded only when Brand colors is opened):
// {
//   source: { repo, commit, date },
//   brands: [ { name, keys: [normalized names], materials: {
//     "<MATERIAL>": [ { name, temps: [nozzleMin, nozzleMax, bedMin, bedMax],
//                       traits: "m,s",          // traits every color in the line has
//                       colors: [ [name, "HEX1,HEX2", "g,m", "ALTHEX,..."] ] } ] } } ]
// }
// Discontinued colors and lines with no colors are left out.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function summary(file) {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  let colors = 0;
  for (const b of d.brands) for (const lines of Object.values(b.materials)) for (const l of lines) colors += l.colors.length;
  return `${d.brands.length} brands, ${colors} colors (${String(d.source?.commit).slice(0, 7)}, ${d.source?.date})`;
}
const withoutSource = (file) => {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  delete d.source;
  return JSON.stringify(d);
};
if (process.argv[2] === '--summary') {
  console.log(summary(process.argv[3]));
  process.exit(0);
}
if (process.argv[2] === '--same') {
  process.exit(withoutSource(process.argv[3]) === withoutSource(process.argv[4]) ? 0 : 1);
}

const root = process.argv[2];
const outFile = process.argv[3] || 'src/data/brand-colors.json';
if (!root) {
  console.error('Usage: node scripts/build-brand-colors.js <ofd-checkout> [out-file]');
  process.exit(1);
}

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

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const dirs = (p) => readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const hexes = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)).map((h) => h.slice(1).toUpperCase());
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

function traitCodes(traits) {
  const codes = new Set();
  for (const [k, on] of Object.entries(traits || {})) if (on && TRAITS[k]) codes.add(TRAITS[k]);
  return [...codes].sort();
}

const data = join(root, 'data');
const brands = [];
let colorCount = 0;

for (const brandDir of dirs(data)) {
  const brandFile = join(data, brandDir, 'brand.json');
  if (!existsSync(brandFile)) continue;
  const brand = readJson(brandFile);
  const materials = {};

  for (const matDir of dirs(join(data, brandDir))) {
    const matFile = join(data, brandDir, matDir, 'material.json');
    if (!existsSync(matFile)) continue;
    const material = String(readJson(matFile).material || matDir).toUpperCase();
    const lines = [];

    for (const lineDir of dirs(join(data, brandDir, matDir))) {
      const lineFile = join(data, brandDir, matDir, lineDir, 'filament.json');
      if (!existsSync(lineFile)) continue;
      const line = readJson(lineFile);
      if (line.discontinued) continue;
      const colors = [];
      for (const colorDir of dirs(join(data, brandDir, matDir, lineDir))) {
        const vFile = join(data, brandDir, matDir, lineDir, colorDir, 'variant.json');
        if (!existsSync(vFile)) continue;
        const v = readJson(vFile);
        if (v.discontinued) continue;
        const main = hexes(v.color_hex);
        if (!main.length || !v.name) continue;
        colors.push([v.name, main.join(','), traitCodes(v.traits).join(','), hexes(v.hex_variants).join(',')]);
      }
      if (!colors.length) continue;
      colors.sort((a, b) => a[0].localeCompare(b[0]));
      // Line traits: those every color has (plus any set on the line itself)
      const per = colors.map((c) => new Set(c[2] ? c[2].split(',') : []));
      const common = [...per[0]].filter((t) => per.every((s) => s.has(t)));
      const lineTraits = [...new Set([...common, ...traitCodes(line.traits)])].sort();
      lines.push({
        name: line.name,
        temps: [num(line.min_print_temperature), num(line.max_print_temperature), num(line.min_bed_temperature), num(line.max_bed_temperature)],
        traits: lineTraits.join(','),
        colors,
      });
      colorCount += colors.length;
    }
    if (lines.length) {
      lines.sort((a, b) => a.name.localeCompare(b.name));
      materials[material] = (materials[material] || []).concat(lines);
    }
  }
  if (!Object.keys(materials).length) continue;
  // Names to match a FilaScribe brand against: the database's name and id,
  // with a trailing "3D" dropped ("eSUN 3D" -> esun)
  const keys = new Set([norm(brand.name), norm(brand.id || brandDir), norm(brandDir)]);
  for (const k of [...keys]) if (k.endsWith('3d') && k.length > 4) keys.add(k.slice(0, -2));
  brands.push({ name: brand.name, keys: [...keys].sort(), materials });
}

let commit = 'unknown', date = 'unknown';
try {
  commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD']).toString().trim();
  date = execFileSync('git', ['-C', root, 'log', '-1', '--format=%cs']).toString().trim();
} catch { /* not a git checkout */ }

const out = {
  source: { repo: 'https://github.com/OpenFilamentCollective/open-filament-database', commit, date },
  brands,
};
writeFileSync(outFile, JSON.stringify(out) + '\n');
console.log(`Wrote ${brands.length} brands, ${colorCount} colors to ${outFile} (${commit.slice(0, 7)}, ${date})`);
