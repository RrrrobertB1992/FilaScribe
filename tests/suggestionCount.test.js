import { describe, it, expect } from 'vitest';
import * as Count from '../src/lib/suggestionCount.js';
import { memoryStorage, brokenStorage } from './storage.js';

describe('closest brand colors setting', () => {
  it('is 3 until you choose', () => {
    expect(Count.load(memoryStorage())).toBe(3);
  });

  it('keeps 0 (Off) to 5, and nothing is stored for the default', () => {
    const s = memoryStorage();
    for (const n of [0, 1, 2, 4, 5]) {
      Count.store(n, s);
      expect(Count.load(s)).toBe(n);
    }
    Count.store(3, s);
    expect(s.getItem(Count.STORAGE_KEY)).toBeNull();
  });

  it('turns junk into the default', () => {
    for (const junk of ['x', '-1', '6', '2.5', '', null, undefined, NaN, {}, [1, 2]]) {
      expect(Count.clean(junk)).toBe(junk === '' || junk === null ? 0 : 3);
    }
    const s = memoryStorage();
    s.setItem(Count.STORAGE_KEY, 'lots');
    expect(Count.load(s)).toBe(3);
  });

  it('survives storage being unavailable', () => {
    expect(Count.load(brokenStorage)).toBe(3);
    expect(() => Count.store(5, brokenStorage)).not.toThrow();
  });
});
