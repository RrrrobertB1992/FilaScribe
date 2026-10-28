// Random but valid FilaScribe forms, for the fuzz/round-trip tests and the
// random reader-compatibility fixtures.
import fc from 'fast-check';
import { MATERIALS, BRANDS, VARIANTS } from '../src/lib/catalog.js';

const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => n.toString(16).padStart(6, '0').toUpperCase());

// Names a person might type: mostly plain text, sometimes accents or symbols.
// Leading/trailing spaces are trimmed by the app, so they're left out here.
const name = fc
  .oneof(
    { weight: 4, arbitrary: fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 24 }) },
    { weight: 1, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 12 }) },
  )
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const tempPair = fc.oneof(
  fc.constant(['', '']),
  fc.tuple(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 0, max: 500 })).map(([a, b]) => [String(Math.min(a, b)), String(Math.max(a, b))]),
  fc.integer({ min: 0, max: 500 }).map((t) => [String(t), '']),
);

export const validForm = fc
  .record({
    profile: fc.constantFrom('standard', 'u1'),
    type: fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...Object.keys(MATERIALS)) }, { weight: 1, arbitrary: name }),
    brand: fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...BRANDS) }, { weight: 1, arbitrary: name }, { weight: 1, arbitrary: fc.constant('') }),
    colors: fc.array(hex, { minLength: 1, maxLength: 5 }),
    colorType: fc.constantFrom('0', '1'),
    nozzle: tempPair,
    bed: tempPair,
    subtype: fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...VARIANTS) }, { weight: 1, arbitrary: name }),
    alpha: fc.oneof(fc.constant('FF'), fc.integer({ min: 0, max: 255 }).map((n) => n.toString(16).padStart(2, '0').toUpperCase())),
    weight: fc.oneof(fc.constant(''), fc.integer({ min: 1, max: 5000 }).map(String)),
    diameter: fc.constantFrom('', '1.75', '2.85', '3', '1.8'),
  })
  .map((r) => ({
    profile: r.profile,
    type: r.type,
    brand: r.brand,
    colors: r.colors,
    colorType: r.colorType,
    minTemp: r.nozzle[0],
    maxTemp: r.nozzle[1],
    bedMinTemp: r.bed[0],
    bedMaxTemp: r.bed[1],
    subtype: r.subtype,
    alpha: r.alpha,
    weight: r.weight,
    diameter: r.diameter,
  }));

/**
 * What a reader should end up with for this form, worked out from what was
 * entered (not from FilaScribe's own encoder), so the readers' tests check
 * the whole path from form to printer.
 */
export function expectedFor(form) {
  const u1 = form.profile === 'u1';
  const colors = (u1 ? form.colors.slice(0, 5) : form.colors.slice(0, 1)).map((c) => c.toUpperCase());
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
    brand: form.brand.trim() || null,
    type: form.type.trim(),
    subtype: u1 ? form.subtype.trim() || null : null,
    colors,
    gradient: u1 && colors.length > 1 && form.colorType === '0',
    minTemp: num(form.minTemp),
    maxTemp: num(form.maxTemp),
    bedMinTemp: u1 ? num(form.bedMinTemp) : null,
    bedMaxTemp: u1 ? num(form.bedMaxTemp) : null,
    weight: u1 ? num(form.weight) : null,
    diameter: u1 ? num(form.diameter) : null,
    alpha: u1 && form.alpha.toUpperCase() !== 'FF' ? form.alpha.toUpperCase() : null,
  };
}
