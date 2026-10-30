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

describe('the override list', () => {
  it('is valid: six-digit hexes, a different value from the wrong one, a reason', () => {
    expect(overrides.length).toBeGreaterThan(0);
    for (const x of overrides) {
      expect(x.hex).toMatch(/^[0-9A-F]{6}$/);
      expect(x.was).toMatch(/^[0-9A-F]{6}$/);
      expect(x.hex).not.toBe(x.was);
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
