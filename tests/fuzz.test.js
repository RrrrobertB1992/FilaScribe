// Fuzz and round-trip tests: thousands of random forms, records and broken
// bytes. fast-check prints a seed and the smallest failing input when a
// property fails, so it can be replayed with { seed, path }.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as OS from '../src/lib/formats/openspool.js';
import { encodeMessage, decodeMessage, mimeRecord, wrapTlv, unwrapTlv } from '../src/lib/ndef.js';
import * as SC from '../src/lib/savedColors.js';
import { validForm, expectedFor } from './arbitraries.js';

// FUZZ_RUNS=5000 npm test runs it harder (the weekly CI run does)
const RUNS = Number(process.env.FUZZ_RUNS) || 500;
const HEX = /^[0-9A-F]{6}$/;
const bytes = (max) => fc.uint8Array({ maxLength: max });

describe('OpenSpool round-trip', () => {
  it('every valid form validates, and survives write then read unchanged', () => {
    fc.assert(
      fc.property(validForm, (form) => {
        expect(OS.validate(form)).toEqual([]);
        const json = OS.build(form);
        const { bytes: payload } = OS.encode(form);
        const message = encodeMessage([mimeRecord(OS.MIME_TYPE, payload)]);
        const [record] = decodeMessage(message);
        const back = OS.decode(record.payload);
        expect(back.unknownKeys).toEqual([]);
        expect(OS.build(back.form)).toEqual(json);
        // reading and writing again changes nothing
        expect(OS.build(OS.parse(OS.build(back.form)).form)).toEqual(json);
      }),
      { numRuns: RUNS },
    );
  });

  it('what is written matches what was entered', () => {
    fc.assert(
      fc.property(validForm, (form) => {
        const json = OS.build(form);
        const e = expectedFor(form);
        expect(json.protocol).toBe('openspool');
        expect(json.version).toBe('1.0');
        expect(json.type).toBe(e.type);
        expect(json.brand ?? null).toBe(e.brand);
        expect(json.subtype ?? null).toBe(e.subtype);
        expect([json.color_hex, ...(json.additional_color_hexes || [])]).toEqual(e.colors);
        expect('color_type' in json).toBe(e.gradient);
        if (e.gradient) expect(json.color_type).toBe(0);
        const num = (v) => (v === undefined ? null : Number(v));
        expect(num(json.min_temp)).toBe(e.minTemp);
        expect(num(json.max_temp)).toBe(e.maxTemp);
        expect(num(json.bed_min_temp)).toBe(e.bedMinTemp);
        expect(num(json.bed_max_temp)).toBe(e.bedMaxTemp);
        expect(num(json.weight)).toBe(e.weight);
        expect(num(json.diameter)).toBe(e.diameter);
        expect(json.alpha ?? null).toBe(e.alpha);
        // nothing else is ever written
        const allowed = new Set(['protocol', 'version', 'type', 'color_hex', 'brand', 'min_temp', 'max_temp',
          'bed_min_temp', 'bed_max_temp', 'subtype', 'alpha', 'additional_color_hexes', 'weight', 'diameter', 'color_type']);
        expect(Object.keys(json).filter((k) => !allowed.has(k))).toEqual([]);
        if (form.profile === 'standard') {
          expect(Object.keys(json).every((k) => ['protocol', 'version', 'type', 'color_hex', 'brand', 'min_temp', 'max_temp'].includes(k))).toBe(true);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('any OpenSpool JSON, however odd, loads into a form that can be written', () => {
    const known = ['type', 'color_hex', 'brand', 'min_temp', 'max_temp', 'bed_min_temp', 'bed_max_temp', 'subtype',
      'alpha', 'additional_color_hexes', 'weight', 'diameter', 'color_type', 'version'];
    const oddValue = fc.oneof(fc.jsonValue({ maxDepth: 2 }), fc.string(), fc.array(fc.string(), { maxLength: 8 }));
    const tag = fc
      .record(Object.fromEntries(known.map((k) => [k, oddValue])), { requiredKeys: [] })
      .chain((r) => fc.dictionary(fc.string({ maxLength: 8 }), fc.jsonValue({ maxDepth: 1 }), { maxKeys: 3 }).map((extra) => ({ ...extra, ...r, protocol: 'openspool' })));
    fc.assert(
      fc.property(tag, (data) => {
        const { form, unknownKeys } = OS.parse(data);
        expect(Array.isArray(unknownKeys)).toBe(true);
        expect(form.colors.length).toBeGreaterThanOrEqual(1);
        expect(form.colors.length).toBeLessThanOrEqual(OS.MAX_COLORS);
        form.colors.forEach((c) => expect(c).toMatch(HEX));
        const problems = OS.validate(form);
        if (!problems.length) {
          const json = OS.build(form);
          expect(json.protocol).toBe('openspool');
          expect(json.color_hex).toMatch(HEX);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('non-OpenSpool JSON and broken text are refused with a clear error', () => {
    fc.assert(
      fc.property(fc.oneof(fc.jsonValue(), fc.string()), (v) => {
        const text = typeof v === 'string' ? v : JSON.stringify(v);
        let data = null;
        try { data = JSON.parse(text); } catch { /* not JSON */ }
        if (OS.isOpenSpool(data)) return; // a real OpenSpool object by chance
        expect(() => OS.decode(text)).toThrow(/OpenSpool|JSON/);
      }),
      { numRuns: RUNS },
    );
  });
});

describe('NDEF', () => {
  const record = fc.record({
    tnf: fc.integer({ min: 1, max: 5 }),
    type: fc.string({ unit: 'binary-ascii', maxLength: 40 }).map((s) => s.replace(/[^\x20-\x7e]/g, 'x')),
    id: fc.string({ unit: 'binary-ascii', maxLength: 8 }).map((s) => s.replace(/[^\x20-\x7e]/g, 'x')),
    payload: bytes(700),
  });

  it('any records round-trip, short or long', () => {
    fc.assert(
      fc.property(fc.array(record, { minLength: 1, maxLength: 4 }), (records) => {
        const back = decodeMessage(encodeMessage(records));
        expect(back).toHaveLength(records.length);
        back.forEach((r, i) => {
          expect(r.tnf).toBe(records[i].tnf);
          expect(r.type).toBe(records[i].type);
          expect(r.id).toBe(records[i].id);
          expect([...r.payload]).toEqual([...records[i].payload]);
        });
      }),
      { numRuns: RUNS },
    );
  });

  it('random bytes never crash the NDEF reader', () => {
    fc.assert(
      fc.property(bytes(600), (b) => {
        try {
          const recs = decodeMessage(b);
          expect(Array.isArray(recs)).toBe(true);
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
          expect(e.message).toMatch(/NDEF/);
        }
        const found = unwrapTlv(b);
        expect(found === null || found instanceof Uint8Array).toBe(true);
      }),
      { numRuns: RUNS * 4 },
    );
  });

  it('a damaged OpenSpool tag is refused or read, never crashes', () => {
    const damage = fc.tuple(validForm, fc.array(fc.tuple(fc.nat(), fc.integer({ min: 0, max: 255 })), { maxLength: 6 }), fc.option(fc.nat()));
    fc.assert(
      fc.property(damage, ([form, flips, cut]) => {
        const msg = encodeMessage([mimeRecord(OS.MIME_TYPE, OS.encode(form).bytes)]);
        const bad = new Uint8Array(wrapTlv(msg));
        for (const [pos, val] of flips) bad[pos % bad.length] = val;
        const mem = cut === null ? bad : bad.slice(0, cut % (bad.length + 1));
        try {
          const inner = unwrapTlv(mem);
          if (!inner) return;
          for (const r of decodeMessage(inner)) {
            if (r.type === OS.MIME_TYPE) OS.decode(r.payload);
          }
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
          expect(e.message).toMatch(/NDEF|JSON|OpenSpool/);
        }
      }),
      { numRuns: RUNS * 2 },
    );
  });
});

describe('saved colors', () => {
  const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => n.toString(16).padStart(6, '0').toUpperCase());
  const key = fc.constantFrom('Polymaker|PLA', 'Generic|PETG', 'Elegoo|PLA+');
  const colors = fc.array(fc.constantFrom('111111', '222222', '333333'), { minLength: 1, maxLength: 3 });
  const op = fc.oneof(
    fc.record({ kind: fc.constant('save'), key, colors, style: fc.constantFrom('0', '1'), variant: fc.constantFrom('', 'Matte', 'Silk') }),
    fc.record({ kind: fc.constant('removeEntry'), key, pick: fc.nat() }),
    fc.record({ kind: fc.constant('removeVariant'), key, pick: fc.nat(), variant: fc.constantFrom('', 'Matte', 'Silk') }),
    fc.record({ kind: fc.constant('rename'), key, pick: fc.nat(), name: fc.string({ maxLength: 10 }) }),
    fc.record({ kind: fc.constant('replace'), key, pick: fc.nat(), colors, style: fc.constantFrom('0', '1') }),
    fc.record({ kind: fc.constant('clear'), key }),
  );

  function check(all) {
    for (const [k, list] of Object.entries(all)) {
      expect(k).toContain('|');
      expect(list.length).toBeGreaterThan(0);
      const ids = list.map(SC.entryId);
      expect(new Set(ids).size).toBe(ids.length); // no duplicate rows
      for (const e of list) {
        expect(e.colors.length).toBeGreaterThan(0);
        e.colors.forEach((c) => expect(c).toMatch(HEX));
        expect(Array.isArray(e.variants)).toBe(true);
        if (e.colors.length === 1) expect(e).not.toHaveProperty('colorType');
      }
    }
  }

  it('any sequence of actions keeps the list consistent', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 30 }), (ops) => {
        let all = {};
        for (const o of ops) {
          const list = SC.entriesFor(all, o.key);
          const id = list.length && o.pick !== undefined ? SC.entryId(list[o.pick % list.length]) : 'none';
          if (o.kind === 'save') all = SC.save(all, o.key, o.colors, o.style, o.variant);
          if (o.kind === 'removeEntry') all = SC.removeEntry(all, o.key, id);
          if (o.kind === 'removeVariant') all = SC.removeVariant(all, o.key, id, o.variant);
          if (o.kind === 'rename') all = SC.rename(all, o.key, id, o.name);
          if (o.kind === 'replace') all = SC.replaceColors(all, o.key, id, o.colors, o.style).all;
          if (o.kind === 'clear') all = SC.clearKey(all, o.key);
          check(all);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('importing anything never throws and keeps only valid rows', () => {
    const exported = fc.dictionary(
      fc.oneof(key, fc.string({ maxLength: 6 })),
      fc.oneof(
        fc.array(fc.record({ colors: fc.array(fc.oneof(hex, fc.string({ maxLength: 7 }), fc.jsonValue({ maxDepth: 1 })), { maxLength: 4 }), name: fc.oneof(fc.string(), fc.integer()), variants: fc.oneof(fc.array(fc.oneof(fc.string(), fc.jsonValue({ maxDepth: 1 }))), fc.string()), colorType: fc.constantFrom('0', '1', 3) }, { requiredKeys: [] }), { maxLength: 4 }),
        fc.jsonValue({ maxDepth: 2 }),
      ),
      { maxKeys: 4 },
    );
    fc.assert(
      fc.property(fc.oneof(exported, fc.jsonValue()), (incoming) => {
        const { all, added } = SC.importInto({}, incoming);
        expect(added).toBeGreaterThanOrEqual(0);
        check(all);
        // importing the same thing again adds nothing new
        expect(SC.importInto(all, incoming).added).toBe(0);
      }),
      { numRuns: RUNS },
    );
  });
});
