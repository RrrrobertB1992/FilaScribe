import { describe, it, expect } from 'vitest';
import * as F from '../src/lib/filaments.js';
import { emptyForm } from '../src/lib/formats/openspool.js';
import { memoryStorage } from './storage.js';

const form = (over = {}) => ({ ...emptyForm('u1'), brand: 'Elegoo', type: 'PLA', subtype: 'Silk', colors: ['2A49C7'], ...over });

describe('My filaments', () => {
  it('makes an entry from the form, and nothing when it is not complete', () => {
    const e = F.fromForm(form(), 'Blue');
    expect(e).toMatchObject({ profile: 'u1', brand: 'Elegoo', type: 'PLA', subtype: 'Silk', colors: ['2A49C7'], colorName: 'Blue', minTemp: '190', bedMinTemp: '50' });
    expect(F.fromForm(form({ brand: '  ' }))).toBeNull();
    expect(F.fromForm(form({ type: '' }))).toBeNull();
    expect(F.fromForm(form({ colors: ['nope'] }))).toBeNull();
  });

  it('leaves the U1-only fields off an OpenSpool entry, and keeps just its first color', () => {
    const e = F.fromForm(form({ profile: 'openspool', colors: ['111111', 'D4AF37'] }));
    expect(e.subtype).toBe('');
    expect(e.bedMinTemp).toBe('');
    expect(e.colors).toEqual(['111111']);
  });

  it('keeps the same spool only once, whatever its color is called', () => {
    const a = F.fromForm(form(), 'Blue');
    const b = F.fromForm(form(), 'Royal');
    let list = F.add([], a);
    expect(F.add(list, b)).toBe(list);
    list = F.add(list, F.fromForm(form({ maxTemp: '230' })));
    expect(list).toHaveLength(2);
    expect(list[0].maxTemp).toBe('230'); // newest first
    expect(F.add(list, null)).toBe(list);
  });

  it('tells a gradient from segments', () => {
    const seg = F.fromForm(form({ colors: ['111111', 'D4AF37'], colorType: '1' }));
    const grad = F.fromForm(form({ colors: ['111111', 'D4AF37'], colorType: '0' }));
    expect(F.keyOf(seg)).not.toBe(F.keyOf(grad));
  });

  it('removes one and fills the form from one', () => {
    const e = F.fromForm(form({ colors: ['111111', 'D4AF37'], colorType: '0' }));
    expect(F.remove([e], e)).toEqual([]);
    expect(F.toForm(e)).toMatchObject({ brand: 'Elegoo', subtype: 'Silk', colors: ['111111', 'D4AF37'], colorType: '0', minTemp: '190' });
  });

  it('keeps and loads the list, and ignores damaged storage', () => {
    const s = memoryStorage();
    const list = F.add([], F.fromForm(form(), 'Blue'));
    F.store(list, s);
    expect(F.load(s)).toEqual(list);
    F.store([], s);
    expect(F.load(s)).toEqual([]);
    expect(F.load(memoryStorage({ [F.STORAGE_KEY]: 'not json' }))).toEqual([]);
    expect(F.load(memoryStorage({ [F.STORAGE_KEY]: '[{"brand":"A"},{"brand":"B","type":"PLA","colors":["#abcdef"]}]' }))).toHaveLength(1);
  });

  it('remembers the automatic-save choice', () => {
    const s = memoryStorage();
    expect(F.loadAuto(s)).toBe(false);
    F.storeAuto(true, s);
    expect(F.loadAuto(s)).toBe(true);
    F.storeAuto(false, s);
    expect(F.loadAuto(s)).toBe(false);
  });

  it('names rough colors', () => {
    const n = F.basicColorName;
    expect([n('FFFFFF'), n('F4F4F4'), n('000000'), n('202020'), n('808080'), n('D40000'), n('0070FF'), n('00A650'), n('FFD500'), n('7B2FBE'), n('FF8C00'), n('C0C0C0')]).toEqual(
      ['white', 'white', 'black', 'black', 'grey', 'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'silver'],
    );
  });

  it('labels a color by its own name, else a rough word per color', () => {
    expect(F.colorLabel(F.fromForm(form(), 'Blue'))).toBe('Blue');
    expect(F.colorLabel(F.fromForm(form({ colors: ['FFFFFF'] })))).toBe('White');
    expect(F.colorLabel(F.fromForm(form({ colors: ['000000', 'D4AF37'] })))).toBe('Black & Yellow');
  });

  it('knows a color you picked yourself from one the database named', () => {
    expect(F.isCustom(F.fromForm(form()))).toBe(true);
    expect(F.isCustom(F.fromForm(form(), 'Blue'))).toBe(false);
  });

  it('searches by every word: brand, material, variant, color name, rough color, hex', () => {
    const list = [
      F.fromForm(form({ colors: ['FFFFFF'] })),
      F.fromForm(form({ brand: 'Polymaker', subtype: '', colors: ['E8E8E8'] }), 'Cotton White'),
      F.fromForm(form({ colors: ['2A49C7'] }), 'Blue'),
    ];
    expect(F.search(list, '')).toBe(list);
    expect(F.search(list, 'white').map((e) => e.brand)).toEqual(['Elegoo', 'Polymaker']);
    expect(F.search(list, 'elegoo silk').length).toBe(2);
    expect(F.search(list, 'elegoo blue').length).toBe(1);
    expect(F.search(list, '#2a49c7').length).toBe(1);
    expect(F.search(list, 'nothing')).toEqual([]);
  });

  it('imports an exported list, newest first, skipping what is already there', () => {
    const a = F.fromForm(form({ maxTemp: '221' }));
    const b = F.fromForm(form({ maxTemp: '222' }));
    const have = F.add([], a);
    const r = F.importInto(have, [b, a]);
    expect(r.added).toBe(1);
    expect(r.list.map((e) => e.maxTemp)).toEqual(['222', '221']);
    expect(() => F.importInto(have, { x: 1 })).toThrow();
    expect(() => F.importInto(have, [{ nope: true }])).toThrow();
    expect(F.importInto(have, []).added).toBe(0);
  });

  it('keeps a name, note and pin without changing which spool it is, and cleans them', () => {
    const e = F.fromForm(form());
    const list = F.add(F.add([], F.fromForm(form({ maxTemp: '221' }))), e);
    const next = F.update(list, e, { name: '  Everyday  ', note: 'x'.repeat(300), pinned: true });
    expect(next[0]).toMatchObject({ name: 'Everyday', pinned: true });
    expect(next[0].note).toHaveLength(F.NOTE_MAX);
    expect(F.keyOf(next[0])).toBe(F.keyOf(e));
    expect(F.has(next, e)).toBe(true);
    // Clearing them leaves the fields out; unpinning drops the flag
    const cleared = F.update(next, e, { name: '', note: '', pinned: false });
    expect(cleared[0]).toEqual(e);
    // Pinned first, otherwise the saved order
    expect(F.ordered(next).map((x) => x.maxTemp)).toEqual([e.maxTemp, '221']);
    // Searchable by name and note; survives storage; junk is dropped
    expect(F.search(next, 'everyday')).toHaveLength(1);
    const storage = memoryStorage();
    F.store(next, storage);
    expect(F.load(storage)[0]).toMatchObject({ name: 'Everyday', pinned: true });
    expect(F.load(memoryStorage({ [F.STORAGE_KEY]: JSON.stringify([{ ...e, name: 5, note: {}, pinned: 'yes' }]) }))[0]).toEqual(e);
  });

  it('sorts by brand, material or last used, pinned first, and remembers the choice', () => {
    const mk = (brand, type, extra = {}) => ({ ...F.fromForm(form({ brand, type, subtype: '' })), ...extra });
    // Saved order (newest first)
    const list = [mk('Sunlu', 'PLA'), mk('Elegoo', 'PETG', { used: 50 }), mk('anycubic', 'PLA', { used: 90 }), mk('Polymaker', 'ABS', { pinned: true })];
    const names = (sort) => F.ordered(list, sort).map((e) => e.brand);
    expect(names('newest')).toEqual(['Polymaker', 'Sunlu', 'Elegoo', 'anycubic']);
    expect(names('brand')).toEqual(['Polymaker', 'anycubic', 'Elegoo', 'Sunlu']);
    expect(names('material')).toEqual(['Polymaker', 'Elegoo', 'anycubic', 'Sunlu']);
    // Never written ones stay below, in the saved order
    expect(names('used')).toEqual(['Polymaker', 'anycubic', 'Elegoo', 'Sunlu']);
    expect(names('junk')).toEqual(names('newest'));
    expect(list[0].brand).toBe('Sunlu');

    // Writing a tag stamps a saved filament only, without changing which spool it is
    const stamped = F.markUsed(list, list[0], 1234);
    expect(stamped[0].used).toBe(1234);
    expect(F.keyOf(stamped[0])).toBe(F.keyOf(list[0]));
    expect(F.markUsed(list, mk('Nobody', 'PLA'), 1)).toBe(list);
    const storage = memoryStorage();
    F.store(stamped, storage);
    expect(F.load(storage)[0].used).toBe(1234);
    expect(F.load(memoryStorage({ [F.STORAGE_KEY]: JSON.stringify([{ ...list[0], used: 'yesterday' }]) }))[0].used).toBeUndefined();

    expect(F.loadSort(storage)).toBe('newest');
    F.storeSort('used', storage);
    expect(F.loadSort(storage)).toBe('used');
    F.storeSort('newest', storage);
    expect(storage.getItem(F.SORT_KEY)).toBeNull();
    expect(F.loadSort(memoryStorage({ [F.SORT_KEY]: 'sideways' }))).toBe('newest');
  });
});
