import { describe, it, expect } from 'vitest';
import * as OpenMode from '../src/lib/openMode.js';
import { memoryStorage, brokenStorage } from './storage.js';

describe('opening a card setting', () => {
  it('leaves the others until you choose', () => {
    expect(OpenMode.load(memoryStorage())).toBe('leave');
  });

  it('keeps Close the others, and nothing is stored for the default', () => {
    const s = memoryStorage();
    OpenMode.store('close', s);
    expect(OpenMode.load(s)).toBe('close');
    OpenMode.store('leave', s);
    expect(s.getItem(OpenMode.STORAGE_KEY)).toBeNull();
  });

  it('turns junk into the default', () => {
    for (const junk of ['x', '', 'CLOSE', 1, null, undefined, {}, ['close'], 'constructor']) {
      expect(OpenMode.clean(junk)).toBe('leave');
    }
    const s = memoryStorage();
    s.setItem(OpenMode.STORAGE_KEY, 'both');
    expect(OpenMode.load(s)).toBe('leave');
  });

  it('survives storage being unavailable', () => {
    expect(OpenMode.load(brokenStorage)).toBe('leave');
    expect(() => OpenMode.store('close', brokenStorage)).not.toThrow();
  });
});
