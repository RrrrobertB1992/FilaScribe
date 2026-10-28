// Writes the tags for the reader-compatibility tests:
//   <out>/<n>.bin   a full NTAG215 memory image (540 bytes), as the U1 reads it
//   <out>/cases.json  what each reader should report, from the form entered
// Usage: node tests/compat/make-fixtures.js <out-dir> [random-count]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { build, validate, MIME_TYPE } from '../../src/lib/formats/openspool.js';
import { encodeMessage, mimeRecord, wrapTlv, maxMessageSize, NTAG } from '../../src/lib/ndef.js';
import { validForm, expectedFor } from '../arbitraries.js';
import { CASES } from './cases.js';

const out = process.argv[2] || 'tests/compat/out';
const randomCount = Number(process.argv[3] ?? 150);
mkdirSync(out, { recursive: true });

// Pages 0-3: UID (04 A1 B2 + BCC0, C3 D4 E5 80), BCC1/internal/lock bytes,
// then the NTAG215 capability container E1 10 3E 00. User memory starts at
// page 4 (504 bytes); pages 130-134 are configuration (20 bytes).
const HEADER = [0x04, 0xa1, 0xb2, 0x1f, 0xc3, 0xd4, 0xe5, 0x80, 0x00, 0x48, 0x00, 0x00, 0xe1, 0x10, 0x3e, 0x00];
const USER = NTAG.NTAG215.userBytes;

function image(message) {
  const mem = new Uint8Array(16 + USER + 20);
  mem.set(HEADER, 0);
  mem.set(wrapTlv(message), 16);
  return mem;
}

const entries = [];
function add(name, form) {
  const problems = validate(form);
  if (problems.length) throw new Error(`${name}: form doesn't validate: ${problems.map((p) => p.message).join(' ')}`);
  const json = build(form);
  const message = encodeMessage([mimeRecord(MIME_TYPE, new TextEncoder().encode(JSON.stringify(json)))]);
  if (message.length > maxMessageSize(USER)) return false;
  const file = `${String(entries.length).padStart(3, '0')}.bin`;
  writeFileSync(join(out, file), image(message));
  entries.push({ name, file, json, messageBytes: message.length, expect: expectedFor(form) });
  return true;
}

for (const c of CASES) {
  if (!add(c.name, c.form)) throw new Error(`${c.name}: doesn't fit on an NTAG215`);
}

// Random forms (fixed seed, so a failure can be reproduced); forms too big
// for an NTAG215 are skipped, as the app would refuse to write them.
const samples = fc.sample(validForm, { numRuns: randomCount * 2, seed: 20261027 });
let added = 0;
for (const form of samples) {
  if (added >= randomCount) break;
  if (add(`random #${added + 1}`, form)) added++;
}

writeFileSync(join(out, 'cases.json'), JSON.stringify(entries, null, 2));
console.log(`Wrote ${entries.length} tags (${CASES.length} named, ${added} random) to ${out}`);
