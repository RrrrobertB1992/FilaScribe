import { describe, it, expect } from 'vitest';
import * as Folds from '../src/lib/folds.js';

const memory = (initial) => {
  const m = new Map(initial ? [[Folds.STORAGE_KEY, initial]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

describe('Create screen cards', () => {
  it('use their default until the person opens or closes them', () => {
    const s = memory();
    expect(Folds.isOpen('filament', true, s)).toBe(true);
    expect(Folds.isOpen('temps', false, s)).toBe(false);
  });

  it('remember each card on its own', () => {
    const s = memory();
    Folds.set('filament', false, s);
    Folds.set('temps', true, s);
    expect(Folds.isOpen('filament', true, s)).toBe(false);
    expect(Folds.isOpen('temps', false, s)).toBe(true);
    expect(Folds.isOpen('colors', true, s)).toBe(true);
  });

  it('ignore damaged storage', () => {
    expect(Folds.load(memory('not json'))).toEqual({});
    expect(Folds.load(memory('[1,2]'))).toEqual({});
    expect(Folds.load(memory('{"a":true,"b":"yes"}'))).toEqual({ a: true });
  });

  it('keep working when storage is unavailable', () => {
    const broken = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
    expect(Folds.isOpen('filament', true, broken)).toBe(true);
    expect(() => Folds.set('filament', false, broken)).not.toThrow();
  });
});
