import { describe, it, expect } from 'vitest';
import * as Style from '../src/lib/swatchStyle.js';
import { memoryStorage, brokenStorage } from './storage.js';

const all = [
  ['circle', Style.circle, Style.CIRCLE_KEY, 'around', 'vertical'],
  ['tile', Style.tile, Style.TILE_KEY, 'angled', 'around'],
  ['tile circle size', Style.size, Style.SIZE_KEY, 'medium', 'large'],
];

describe.each(all)('swatch setting: %s', (_name, S, key, fallback, other) => {
  it('is the default until you choose', () => {
    expect(S.load(memoryStorage())).toBe(fallback);
  });

  it('keeps a choice, and stores nothing for the default', () => {
    const s = memoryStorage();
    S.store(other, s);
    expect(S.load(s)).toBe(other);
    S.store(fallback, s);
    expect(s.getItem(key)).toBeNull();
  });

  it('turns junk into the default', () => {
    for (const junk of ['x', '', 'AROUND', 1, null, undefined, {}, [other], 'constructor']) {
      expect(S.clean(junk)).toBe(fallback);
    }
    const s = memoryStorage();
    s.setItem(key, 'sparkle');
    expect(S.load(s)).toBe(fallback);
  });

  it('survives storage being unavailable', () => {
    expect(S.load(brokenStorage)).toBe(fallback);
    expect(() => S.store(other, brokenStorage)).not.toThrow();
  });
});
