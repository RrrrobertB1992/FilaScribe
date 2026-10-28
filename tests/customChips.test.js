import { describe, it, expect } from 'vitest';
import * as CC from '../src/lib/customChips.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

describe('custom chips', () => {
  it('saves brands and materials once, skipping built-in chips and blanks', () => {
    let c = CC.load(memory());
    c = CC.add(c, 'brand', ' Zephyr ', { builtIn: ['Generic'] });
    c = CC.add(c, 'brand', 'Zephyr');
    c = CC.add(c, 'brand', 'Generic', { builtIn: ['Generic'] });
    c = CC.add(c, 'brand', '   ');
    c = CC.add(c, 'material', 'PLA+', { builtIn: ['PLA'] });
    expect(c.brands).toEqual(['Zephyr']);
    expect(c.materials).toEqual(['PLA+']);
    const same = CC.add(c, 'material', 'PLA+');
    expect(same).toBe(c);
  });

  it('keeps variants per brand + material', () => {
    let c = CC.add(CC.load(memory()), 'variant', 'Rapid', { brand: 'Elegoo', type: 'PETG' });
    expect(CC.variantsFor(c, 'Elegoo', 'PETG')).toEqual(['Rapid']);
    expect(CC.variantsFor(c, 'Elegoo', 'PLA')).toEqual([]);
    expect(CC.add(c, 'variant', 'X', { brand: '', type: 'PLA' })).toBe(c); // no brand: nowhere to keep it
    c = CC.remove(c, 'variant', 'Rapid', { brand: 'Elegoo', type: 'PETG' });
    expect(c.variants).toEqual({});
  });

  it('removes, stores and loads', () => {
    const s = memory();
    let c = CC.add(CC.add(CC.load(s), 'brand', 'A'), 'brand', 'B');
    c = CC.remove(c, 'brand', 'A');
    CC.store(c, s);
    expect(CC.load(s).brands).toEqual(['B']);
    expect(CC.remove(c, 'brand', 'nope')).toBe(c);
  });

  it('keeps at most MAX per list, dropping the oldest', () => {
    let c = CC.load(memory());
    for (let i = 0; i < CC.MAX + 5; i++) c = CC.add(c, 'material', `M${i}`);
    expect(c.materials).toHaveLength(CC.MAX);
    expect(c.materials[0]).toBe('M5');
  });

  it('ignores junk in storage', () => {
    const s = memory();
    s.setItem(CC.STORAGE_KEY, JSON.stringify({ brands: ['ok', 3, '', 'x'.repeat(50)], materials: 'nope', variants: { bad: ['a'], 'B|T': ['v', null] } }));
    expect(CC.load(s)).toEqual({ brands: ['ok'], materials: [], variants: { 'B|T': ['v'] } });
    s.setItem(CC.STORAGE_KEY, 'not json');
    expect(CC.load(s)).toEqual({ brands: [], materials: [], variants: {} });
  });

  it('shows yours after the built-in chips', () => {
    expect(CC.withSaved(['', 'Basic'], ['Rapid', 'Basic'])).toEqual(['', 'Basic', 'Rapid']);
  });
});
