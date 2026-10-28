import { describe, it, expect } from 'vitest';
import * as Defaults from '../src/lib/defaults.js';
import * as Theme from '../src/lib/theme.js';
import { emptyForm } from '../src/lib/formats/openspool.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('defaults for new tags', () => {
  it('starts from the built-in form when nothing is saved', () => {
    expect(Defaults.load(memory())).toEqual({});
    expect(Defaults.newForm({})).toEqual(emptyForm('u1'));
  });

  it('keeps everything but the colors from a form', () => {
    const form = { ...emptyForm('standard'), brand: 'Polymaker', type: 'PETG', minTemp: '230', colors: ['FF0000'], colorType: '0' };
    const d = Defaults.fromForm(form);
    expect(d).toMatchObject({ profile: 'standard', brand: 'Polymaker', type: 'PETG', minTemp: '230' });
    expect(d).not.toHaveProperty('colors');
    const next = Defaults.newForm(d);
    expect(next).toMatchObject({ profile: 'standard', brand: 'Polymaker', type: 'PETG', minTemp: '230', colors: ['FFFFFF'] });
  });

  it('stores, clears and ignores junk', () => {
    const s = memory();
    Defaults.store({ brand: 'Zephyr' }, s);
    expect(Defaults.load(s)).toEqual({ brand: 'Zephyr' });
    Defaults.store({}, s);
    expect(s.getItem(Defaults.STORAGE_KEY)).toBeNull();
    s.setItem(Defaults.STORAGE_KEY, JSON.stringify({ profile: 'nope', brand: 3, type: 'ABS', colors: ['000000'] }));
    expect(Defaults.load(s)).toEqual({ type: 'ABS' });
    s.setItem(Defaults.STORAGE_KEY, 'not json');
    expect(Defaults.load(s)).toEqual({});
  });
});

describe('theme', () => {
  it('follows the system unless light or dark is saved', () => {
    const s = memory();
    expect(Theme.load(s)).toBe('system');
    Theme.store('dark', s);
    expect(Theme.load(s)).toBe('dark');
    Theme.store('system', s);
    expect(s.getItem(Theme.STORAGE_KEY)).toBeNull();
    s.setItem(Theme.STORAGE_KEY, 'purple');
    expect(Theme.load(s)).toBe('system');
  });

  it('sets data-theme only for light or dark', () => {
    const root = { dataset: {} };
    Theme.apply('dark', root);
    expect(root.dataset.theme).toBe('dark');
    Theme.apply('system', root);
    expect(root.dataset).not.toHaveProperty('theme');
  });
});
