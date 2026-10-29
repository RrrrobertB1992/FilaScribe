import { describe, it, expect } from 'vitest';
import * as ML from '../src/lib/materialList.js';
import { MATERIALS } from '../src/lib/catalog.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

describe('material list', () => {
  it('starts with a short common set, plus materials saved as chips before', () => {
    expect(ML.load(memory())).toEqual(['PLA', 'PETG', 'ABS']);
    expect(ML.load(memory(), ['PLA+', 'PETG'])).toEqual(['PLA', 'PETG', 'ABS', 'PLA+']);
  });

  it('turns materials on and off, keeping the order they were turned on', () => {
    let s = ['PLA'];
    s = ML.add(s, ' PEEK ');
    s = ML.add(s, 'Zephyr Pro');
    expect(s).toEqual(['PLA', 'PEEK', 'Zephyr Pro']);
    expect(ML.add(s, 'PEEK')).toBe(s);
    expect(ML.add(s, '')).toBe(s);
    expect(ML.add(s, 'x'.repeat(41))).toBe(s);
    s = ML.remove(s, 'PLA');
    expect(s).toEqual(['PEEK', 'Zephyr Pro']);
    expect(ML.remove(s, 'nope')).toBe(s);
  });

  it('stores what Settings chose, even an empty list', () => {
    const st = memory();
    ML.store([], st);
    expect(ML.load(st, ['PLA+'])).toEqual([]);
    ML.store(['PETG', 'PETG', '', 3, 'PLA+'], st);
    expect(ML.load(st)).toEqual(['PETG', 'PLA+']);
  });

  it('falls back to the default on junk', () => {
    const st = memory();
    st.setItem(ML.STORAGE_KEY, 'not json');
    expect(ML.load(st)).toEqual(ML.DEFAULT);
    st.setItem(ML.STORAGE_KEY, JSON.stringify({ shown: 'nope' }));
    expect(ML.load(st)).toEqual(ML.DEFAULT);
  });

  it('lists the built-in materials that are not shown, in the usual order', () => {
    expect(ML.hidden(['PLA', 'PETG', 'ABS'])).toEqual(Object.keys(MATERIALS).filter((m) => !['PLA', 'PETG', 'ABS'].includes(m)));
    expect(ML.hidden(Object.keys(MATERIALS))).toEqual([]);
  });
});

describe('material row', () => {
  const shown = ['PLA', 'PETG', 'ABS', 'PLA+'];

  it('shows the materials the brand makes, in the order shown', () => {
    expect(ML.rowFor(shown, Object.keys(MATERIALS))).toEqual(shown);
    expect(ML.rowFor(shown, ['PLA', 'PETG', 'TPU'])).toEqual(['PLA', 'PETG', 'PLA+']);
  });

  it('keeps your own materials for every brand', () => {
    expect(ML.rowFor(['Zephyr Pro'], ['PLA'])).toEqual(['Zephyr Pro']);
  });

  it('adds the selected built-in material at the end when it is hidden', () => {
    const all = Object.keys(MATERIALS);
    expect(ML.rowFor(shown, all, 'PEEK')).toEqual([...shown, 'PEEK']);
    expect(ML.rowFor(shown, all, 'PETG')).toEqual(shown); // already there
    expect(ML.rowFor(shown, all, 'PLA++')).toEqual(shown); // Custom stays in the box
    // a brand that doesn't make it: the brand's list decides (materialChoices adds a read one)
    expect(ML.rowFor(shown, ['PLA'], 'PEEK')).toEqual(['PLA', 'PLA+']);
    expect(ML.rowFor(shown, ['PLA', 'PEEK'], 'PEEK')).toEqual(['PLA', 'PLA+', 'PEEK']);
  });

  it('can be empty', () => {
    expect(ML.rowFor([], Object.keys(MATERIALS))).toEqual([]);
  });
});

describe('Other… for materials', () => {
  it('suggests hidden built-in materials that start with what is typed', () => {
    const shown = ['PLA', 'PETG', 'ABS'];
    expect(ML.suggest(shown, 'pe')).toEqual(['PEEK', 'PETG-CF']);
    expect(ML.suggest(shown, 'pee')).toEqual(['PEEK']);
    expect(ML.suggest(shown, 'P')).toEqual(['PA', 'PA12', 'PC', 'PEEK', 'PVA', 'PCTG']); // 6 at most
    expect(ML.suggest(shown, 'P', 20)).toHaveLength(9);
    expect(ML.suggest(shown, 'P', 3)).toHaveLength(3);
    expect(ML.suggest(shown, 'PLA')).toEqual(['PLA-CF']); // PLA itself is already shown
    expect(ML.suggest(shown, '')).toEqual([]);
    expect(ML.suggest(shown, 'zz')).toEqual([]);
  });

  it('turns a typed built-in name into its spelling', () => {
    expect(ML.canonical('peek')).toBe('PEEK');
    expect(ML.canonical(' pla-cf ')).toBe('PLA-CF');
    expect(ML.canonical('PLA+')).toBe('PLA+');
    expect(ML.canonical('')).toBe('');
  });
});
