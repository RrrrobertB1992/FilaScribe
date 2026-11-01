import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyOverrides } from '../scripts/color-overrides.js';
import snapshot from '../src/data/brand-colors.json' with { type: 'json' };

const overrides = JSON.parse(readFileSync(new URL('../scripts/color-overrides.json', import.meta.url), 'utf8'));

const make = (hex) => [
  { name: 'Acme', keys: ['acme'], materials: { PLA: [{ name: 'PLA', temps: [], traits: '', colors: [['White', hex, '', ''], ['Red', 'FF0000', '', '']] }] } },
];
const o = { brand: 'Acme', material: 'PLA', line: 'PLA', color: 'White', was: '000000', hex: 'ffffff' };

describe('color overrides', () => {
  it('replaces the wrong value, and only that color', () => {
    const brands = make('000000');
    const r = applyOverrides(brands, [o]);
    expect(r.applied).toEqual([o]);
    expect(brands[0].materials.PLA[0].colors).toEqual([['White', 'FFFFFF', '', ''], ['Red', 'FF0000', '', '']]);
  });

  it('steps aside once the database has a different value', () => {
    const brands = make('FAFAFA');
    const r = applyOverrides(brands, [o]);
    expect(r).toEqual({ applied: [], fixedUpstream: [o], missing: [] });
    expect(brands[0].materials.PLA[0].colors[0][1]).toBe('FAFAFA');
  });

  it('reports a color that is gone or renamed', () => {
    const brands = make('000000');
    brands[0].materials.PLA[0].colors[0][0] = 'Snow';
    expect(applyOverrides(brands, [o]).missing).toEqual([o]);
    expect(applyOverrides(make('000000'), [{ ...o, brand: 'Nobody' }]).missing).toHaveLength(1);
  });
});

describe('multi-color overrides', () => {
  const dual = (hex, traits) => [
    { name: 'Acme', keys: ['acme'], materials: { PLA: [{ name: 'Dual', temps: [], traits: '', colors: [['Red Gold', hex, traits, '']] }] } },
  ];
  const m = { brand: 'Acme', material: 'PLA', line: 'Dual', color: 'Red Gold', was: 'FF0000', hex: 'ff0000,ffd700' };

  it('fills in the missing colors', () => {
    const brands = dual('FF0000', '');
    expect(applyOverrides(brands, [m]).applied).toEqual([m]);
    expect(brands[0].materials.PLA[0].colors[0][1]).toBe('FF0000,FFD700');
  });

  it('leaves a color alone once the database lists its own', () => {
    const brands = dual('FF0000,FFC800', '');
    expect(applyOverrides(brands, [m]).fixedUpstream).toEqual([m]);
    expect(brands[0].materials.PLA[0].colors[0][1]).toBe('FF0000,FFC800');
  });

  it('only changes the tags when they are still what was seen', () => {
    const shift = { ...m, hex: 'FF0000', wasTraits: 'c,s', traits: 's' };
    const a = dual('FF0000', 'c,s');
    expect(applyOverrides(a, [shift]).applied).toEqual([shift]);
    expect(a[0].materials.PLA[0].colors[0].slice(1, 3)).toEqual(['FF0000', 's']);
    const b = dual('FF0000', 's'); // the database already dropped the tag
    expect(applyOverrides(b, [shift]).fixedUpstream).toEqual([shift]);
  });
});

describe('the override list', () => {
  it('is valid: one to five six-digit hexes, a real change from what the database has, a reason', () => {
    expect(overrides.length).toBeGreaterThan(0);
    const list = /^[0-9A-F]{6}(,[0-9A-F]{6}){0,4}$/;
    for (const x of overrides) {
      expect(x.hex).toMatch(list);
      expect(x.was).toMatch(list);
      expect(x.hex !== x.was || (x.traits !== undefined && x.traits !== x.wasTraits)).toBe(true);
      if (x.traits !== undefined) expect(typeof x.wasTraits).toBe('string'); // tag changes name what they replace
      expect(x.why).toBeTruthy();
    }
  });

  it('is applied to the bundled snapshot (and is not repeated)', () => {
    const keys = overrides.map((x) => [x.brand, x.material, x.line, x.color].join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    const copy = structuredClone(snapshot.brands);
    const r = applyOverrides(copy, overrides);
    expect(r.applied).toEqual([]); // nothing left to fix: they are in the snapshot already
    expect(r.missing).toEqual([]);
  });

  it('SUNLU Cream White and White are no longer black', () => {
    const sunlu = snapshot.brands.find((b) => b.name === 'SUNLU');
    const hex = (m, line, color) => sunlu.materials[m].find((l) => l.name === line).colors.find((c) => c[0] === color)[1];
    expect(hex('PLA', 'APLA', 'Cream White')).toBe('E6E2C7');
    expect(hex('ASA', 'ASA', 'White')).toBe('FFFFFF');
    expect(hex('TPU', 'TPU95A', 'White')).toBe('FFFFFF');
  });
});
