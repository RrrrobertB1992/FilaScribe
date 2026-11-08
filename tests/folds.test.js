import { describe, it, expect } from 'vitest';
import * as Folds from '../src/lib/folds.js';
import { memoryStorage, brokenStorage } from './storage.js';

const memory = (value) => memoryStorage(value ? { [Folds.STORAGE_KEY]: value } : {});


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
    expect(Folds.isOpen('filament', true, brokenStorage)).toBe(true);
    expect(() => Folds.set('filament', false, brokenStorage)).not.toThrow();
  });
});
