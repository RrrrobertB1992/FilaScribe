// Lists what changed between two Brand colors snapshots (and, optionally, two
// OrcaSlicer vendor lists) as Markdown for the monthly pull request: a
// summary line, then one collapsible section per brand.
//
// Usage: node scripts/snapshot-changes.js <old-colors> <new-colors> [<old-orca> <new-orca>]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { diffColors, diffNames } from '../src/lib/snapshotDiff.js';

// GitHub caps a PR description at 65,536 characters; stay well under it
const LIMIT = 60000;

export { diffColors, diffNames };

const count = (n, word) => (n ? `${n} ${word}` : '');
const join = (...parts) => parts.filter(Boolean).join(', ');
const hexes = (h) => (h ? `\`${h.replaceAll(',', ' ')}\`` : 'no color');
const tags = (t) => (t ? ` [${t}]` : '');
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);

function brandLines(d) {
  const sort = (a, b) => a.where.localeCompare(b.where) || a.name.localeCompare(b.name);
  const out = [];
  for (const c of d.added.sort(sort)) out.push(`- ➕ ${esc(c.where)}: ${esc(c.name)} ${hexes(c.hex)}`);
  for (const c of d.removed.sort(sort)) out.push(`- ➖ ${esc(c.where)}: ${esc(c.name)}`);
  for (const c of d.changed.sort(sort)) {
    const tagChange = c.oldTraits !== c.traits ? ` (tags${tags(c.oldTraits) || ' none'} →${tags(c.traits) || ' none'})` : '';
    out.push(`- ✏️ ${esc(c.where)}: ${esc(c.name)} ${c.oldHex !== c.hex ? `${hexes(c.oldHex)} → ${hexes(c.hex)}` : 'same colors'}${tagChange}`);
  }
  return out;
}

/** The Markdown section for the PR description. Empty string when nothing changed. */
export function renderChanges(colors, names, limit = LIMIT) {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const d of colors.brands.values()) {
    added += d.added.length;
    removed += d.removed.length;
    changed += d.changed.length;
  }
  const summary = [];
  const colorSummary = join(count(added, 'added'), count(removed, 'removed'), count(changed, 'changed'));
  if (colorSummary) summary.push(`**Colors:** ${colorSummary} in ${colors.brands.size} brand${colors.brands.size === 1 ? '' : 's'}`);
  if (colors.newBrands.length) summary.push(`**New brands:** ${colors.newBrands.map(esc).join(', ')}`);
  if (colors.goneBrands.length) summary.push(`**Brands gone:** ${colors.goneBrands.map(esc).join(', ')}`);
  const nameSummary = join(count(names.added.length, 'added'), count(names.removed.length, 'removed'));
  if (nameSummary) summary.push(`**Brand names (OrcaSlicer):** ${nameSummary}`);
  if (!summary.length) return '';

  const parts = ['### What changed', '', summary.join('  \n'), '', '➕ new color · ➖ removed · ✏️ color or tags changed', ''];
  let size = parts.join('\n').length;
  let skipped = 0;
  const brands = [...colors.brands].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [brand, d] of brands) {
    const head = `<summary><b>${esc(brand)}</b>: ${join(count(d.added.length, 'added'), count(d.removed.length, 'removed'), count(d.changed.length, 'changed'))}</summary>`;
    const section = `<details>\n${head}\n\n${brandLines(d).join('\n')}\n\n</details>\n`;
    if (size + section.length > limit) { skipped++; continue; }
    parts.push(section);
    size += section.length;
  }
  if (skipped) parts.push(`_${skipped} more brand${skipped === 1 ? '' : 's'} not listed: the list got too long for a description. See the Files changed tab._`, '');
  if (names.added.length || names.removed.length) {
    const lines = [...names.added.map((n) => `- ➕ ${esc(n)}`), ...names.removed.map((n) => `- ➖ ${esc(n)}`)];
    parts.push(`<details>\n<summary><b>Brand names (OrcaSlicer)</b>: ${nameSummary}</summary>\n\n${lines.join('\n')}\n\n</details>\n`);
  }
  return parts.join('\n');
}

const read = (f) => JSON.parse(readFileSync(f, 'utf8'));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [oldColors, newColors, oldOrca, newOrca] = process.argv.slice(2);
  if (!oldColors || !newColors) {
    console.error('Usage: node scripts/snapshot-changes.js <old-colors> <new-colors> [<old-orca> <new-orca>]');
    process.exit(1);
  }
  const colors = diffColors(read(oldColors).brands, read(newColors).brands);
  const names = oldOrca && newOrca ? diffNames(read(oldOrca).vendors, read(newOrca).vendors) : { added: [], removed: [] };
  process.stdout.write(renderChanges(colors, names));
}
