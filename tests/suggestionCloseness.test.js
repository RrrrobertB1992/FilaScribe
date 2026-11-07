import { describe, it, expect } from 'vitest';
import * as Closeness from '../src/lib/suggestionCloseness.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const broken = {
  getItem() { throw new Error('no storage'); },
  setItem() { throw new Error('no storage'); },
  removeItem() { throw new Error('no storage'); },
};

describe('how close setting', () => {
  it('is Normal until you choose', () => {
    expect(Closeness.load(memory())).toBe('normal');
  });

  it('keeps Strict and Loose, and nothing is stored for the default', () => {
    const s = memory();
    for (const level of ['strict', 'loose']) {
      Closeness.store(level, s);
      expect(Closeness.load(s)).toBe(level);
    }
    Closeness.store('normal', s);
    expect(s.getItem(Closeness.STORAGE_KEY)).toBeNull();
  });

  it('has the limits Strict 8, Normal 12 and Loose 18', () => {
    expect(Closeness.limitFor('strict')).toBe(8);
    expect(Closeness.limitFor('normal')).toBe(12);
    expect(Closeness.limitFor('loose')).toBe(18);
  });

  it('turns junk into the default', () => {
    for (const junk of ['x', '', 'STRICT', 3, null, undefined, {}, ['loose'], 'constructor', '__proto__']) {
      expect(Closeness.clean(junk)).toBe('normal');
      expect(Closeness.limitFor(junk)).toBe(12);
    }
    const s = memory();
    s.setItem(Closeness.STORAGE_KEY, 'very');
    expect(Closeness.load(s)).toBe('normal');
  });

  it('survives storage being unavailable', () => {
    expect(Closeness.load(broken)).toBe('normal');
    expect(() => Closeness.store('loose', broken)).not.toThrow();
  });
});
