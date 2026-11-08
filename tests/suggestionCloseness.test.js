import { describe, it, expect } from 'vitest';
import * as Closeness from '../src/lib/suggestionCloseness.js';
import { memoryStorage, brokenStorage } from './storage.js';

describe('how close setting', () => {
  it('is Normal until you choose', () => {
    expect(Closeness.load(memoryStorage())).toBe('normal');
  });

  it('keeps Strict and Loose, and nothing is stored for the default', () => {
    const s = memoryStorage();
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
    const s = memoryStorage();
    s.setItem(Closeness.STORAGE_KEY, 'very');
    expect(Closeness.load(s)).toBe('normal');
  });

  it('survives storage being unavailable', () => {
    expect(Closeness.load(brokenStorage)).toBe('normal');
    expect(() => Closeness.store('loose', brokenStorage)).not.toThrow();
  });
});
