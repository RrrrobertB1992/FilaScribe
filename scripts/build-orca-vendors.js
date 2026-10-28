// Builds src/data/orca-vendors.json: the filament vendor names OrcaSlicer's
// bundled filament profiles use ("filament_vendor"), from an OrcaSlicer
// checkout (https://github.com/SoftFever/OrcaSlicer, AGPL-3.0; only the
// names are taken). FilaScribe writes these names as the tag's brand so it
// matches the slicer.
//
// Usage: node scripts/build-orca-vendors.js <orca-checkout> [out-file]
//        node scripts/build-orca-vendors.js --same <file-a> <file-b>
//          (exit 0 if they list the same vendors, ignoring the source commit)
//
// Output: { source: { repo, commit, date }, vendors: ["Bambu Lab", "eSUN", ...] }
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

if (process.argv[2] === '--same') {
  const vendors = (f) => JSON.stringify(JSON.parse(readFileSync(f, 'utf8')).vendors);
  process.exit(vendors(process.argv[3]) === vendors(process.argv[4]) ? 0 : 1);
}

const root = process.argv[2];
const outFile = process.argv[3] || 'src/data/orca-vendors.json';
if (!root) {
  console.error('Usage: node scripts/build-orca-vendors.js <orca-checkout> [out-file]');
  process.exit(1);
}

// Placeholders, not brands
const SKIP = new Set(['generic', 'other']);

const profiles = join(root, 'resources', 'profiles');
const found = new Map(); // normalized -> { name, count }
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.json')) {
      let data;
      try {
        data = JSON.parse(readFileSync(p, 'utf8'));
      } catch {
        continue;
      }
      let v = data.filament_vendor;
      if (Array.isArray(v)) v = v[0];
      if (typeof v !== 'string' || !v.trim()) continue;
      v = v.trim();
      const key = norm(v);
      if (!key || SKIP.has(key)) continue;
      // The most used spelling wins if profiles disagree
      const counts = found.get(key) || new Map();
      counts.set(v, (counts.get(v) || 0) + 1);
      found.set(key, counts);
    }
  }
}

for (const vendor of readdirSync(profiles)) {
  const filament = join(profiles, vendor, 'filament');
  if (existsSync(filament)) walk(filament);
}

const vendors = [...found.values()]
  .map((counts) => [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0])
  .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

let commit = '';
let date = '';
try {
  commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  date = execFileSync('git', ['-C', root, 'log', '-1', '--format=%cs'], { encoding: 'utf8' }).trim();
} catch {
  // not a git checkout
}

writeFileSync(outFile, JSON.stringify({ source: { repo: 'SoftFever/OrcaSlicer', commit, date }, vendors }, null, 1) + '\n');
console.log(`${vendors.length} vendors -> ${outFile}`);
