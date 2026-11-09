import { describe, it, expect } from 'vitest';
import * as Speed from '../src/lib/motionSpeed.js';
import { memoryStorage, brokenStorage } from './storage.js';

describe('animation speed setting', () => {
  it('is Normal until you choose', () => {
    expect(Speed.load(memoryStorage())).toBe('normal');
  });

  it('keeps Fast and Slow, and nothing is stored for the default', () => {
    const s = memoryStorage();
    for (const level of ['fast', 'slow']) {
      Speed.store(level, s);
      expect(Speed.load(s)).toBe(level);
    }
    Speed.store('normal', s);
    expect(s.getItem(Speed.STORAGE_KEY)).toBeNull();
  });

  it('is 0.2 s for Fast, 0.4 s for Normal and 0.6 s for Slow', () => {
    expect(Speed.msFor('fast')).toBe(200);
    expect(Speed.msFor('normal')).toBe(400);
    expect(Speed.msFor('slow')).toBe(600);
  });

  it('turns junk into the default', () => {
    for (const junk of ['x', '', 'FAST', 3, null, undefined, {}, ['slow'], 'constructor', '__proto__']) {
      expect(Speed.clean(junk)).toBe('normal');
      expect(Speed.msFor(junk)).toBe(400);
    }
    const s = memoryStorage();
    s.setItem(Speed.STORAGE_KEY, 'warp');
    expect(Speed.load(s)).toBe('normal');
  });

  it('survives storage being unavailable', () => {
    expect(Speed.load(brokenStorage)).toBe('normal');
    expect(() => Speed.store('slow', brokenStorage)).not.toThrow();
  });
});
