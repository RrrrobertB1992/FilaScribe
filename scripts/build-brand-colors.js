// Refreshes src/data/brand-colors.json, the copy of the brand colors built
// into the app, from the Open Filament Database's all-in-one download
// (https://api.openfilamentdatabase.org/json/all.json, MIT). The work is done
// by src/lib/ofdSnapshot.js, the same code the app runs for Check for updates.
//
// Usage: npm run update-colors
//        node scripts/build-brand-colors.js [all.json file or URL] [out-file]
//        node scripts/build-brand-colors.js --summary <snapshot-file>
//        node scripts/build-brand-colors.js --apply-overrides <snapshot-file>
//          (apply scripts/color-overrides.json to a snapshot that is already built)
//
// Run it before a release (or whenever asked) and send the result as a pull
// request. The output format is described in src/lib/ofdSnapshot.js.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { applyOverrides, describe } from './color-overrides.js';
import { API_URL, buildSnapshot } from '../src/lib/ofdSnapshot.js';

function summary(file) {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  let colors = 0;
  for (const b of d.brands) for (const lines of Object.values(b.materials)) for (const l of lines) colors += l.colors.length;
  return `${d.brands.length} brands, ${colors} colors (${String(d.source?.commit).slice(0, 10)}, ${d.source?.date})`;
}
const overrides = JSON.parse(readFileSync(new URL('./color-overrides.json', import.meta.url), 'utf8'));
function reportOverrides(r) {
  console.log(`Color overrides: ${r.applied.length} applied, ${r.fixedUpstream.length} already right or changed upstream, ${r.missing.length} not found`);
  for (const o of r.fixedUpstream) console.log(`  upstream changed, can be removed: ${describe(o)}`);
  for (const o of r.missing) console.log(`  not found (renamed or removed?): ${describe(o)}`);
}
if (process.argv[2] === '--summary') {
  console.log(summary(process.argv[3]));
  process.exit(0);
}
if (process.argv[2] === '--apply-overrides') {
  const file = process.argv[3];
  const d = JSON.parse(readFileSync(file, 'utf8'));
  reportOverrides(applyOverrides(d.brands, overrides));
  writeFileSync(file, JSON.stringify(d) + '\n');
  process.exit(0);
}

const from = process.argv[2] || `${API_URL}json/all.json`;
const outFile = process.argv[3] || 'src/data/brand-colors.json';

let all;
if (/^https?:/.test(from)) {
  console.log(`Downloading ${from}`);
  const res = await fetch(from);
  if (!res.ok) {
    console.error(`Couldn't download the database (${res.status}).`);
    process.exit(1);
  }
  all = await res.json();
} else {
  all = JSON.parse(readFileSync(from, 'utf8'));
}

const before = existsSync(outFile) ? summary(outFile) : '';
const built = buildSnapshot(all, overrides);
if (!built.snapshot.brands.length || built.snapshot.source.date === 'unknown') {
  console.error('The download has no brands or no date, so nothing was written.');
  process.exit(1);
}
reportOverrides(built.overrides);
writeFileSync(outFile, JSON.stringify(built.snapshot) + '\n');
if (before) console.log(`Before: ${before}`);
console.log(`After:  ${summary(outFile)}`);
