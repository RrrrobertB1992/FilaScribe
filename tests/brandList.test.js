import { describe, it, expect } from 'vitest';
import * as BL from '../src/lib/brandList.js';
import { BRANDS } from '../src/lib/catalog.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

describe('brand list', () => {
  it('starts with the built-in brands, plus brands saved as chips before', () => {
    expect(BL.load(memory())).toEqual(BRANDS.filter((b) => b !== 'Generic'));
    expect(BL.load(memory(), ['Zephyr', 'SUNLU'])).toEqual([...BL.DEFAULT, 'Zephyr']);
  });

  it('Generic is always first and never stored or removed', () => {
    expect(BL.chipsFor(['SUNLU'])).toEqual(['Generic', 'SUNLU']);
    expect(BL.add(['SUNLU'], 'Generic')).toEqual(['SUNLU']);
    expect(BL.isShown([], 'Generic')).toBe(true);
  });

  it('turns brands on and off, keeping the order they were turned on', () => {
    let s = ['SUNLU'];
    s = BL.add(s, ' Elegoo ');
    s = BL.toggle(s, 'Kingroon');
    expect(s).toEqual(['SUNLU', 'Elegoo', 'Kingroon']);
    s = BL.toggle(s, 'SUNLU');
    expect(s).toEqual(['Elegoo', 'Kingroon']);
    expect(BL.add(s, 'Elegoo')).toBe(s);
    expect(BL.remove(s, 'nope')).toBe(s);
  });

  it('stores what Settings chose, even an empty list', () => {
    const st = memory();
    BL.store([], st);
    expect(BL.load(st, ['Zephyr'])).toEqual([]);
    BL.store(['Elegoo', 'Elegoo', '', 3, 'Generic'], st);
    expect(BL.load(st)).toEqual(['Elegoo']);
  });

  it('falls back to the default on junk', () => {
    const st = memory();
    st.setItem(BL.STORAGE_KEY, 'not json');
    expect(BL.load(st)).toEqual(BL.DEFAULT);
    st.setItem(BL.STORAGE_KEY, JSON.stringify({ shown: 'nope' }));
    expect(BL.load(st)).toEqual(BL.DEFAULT);
  });
});
