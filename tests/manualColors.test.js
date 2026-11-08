import { describe, it, expect } from 'vitest';
import * as M from '../src/lib/manualColors.js';
import { colorInfo, findColor, linesForMaterial, tilesFor } from '../src/lib/brandColors.js';
import { memoryStorage } from './storage.js';

const memory = (value) => memoryStorage(value ? { [M.STORAGE_KEY]: value } : {});


const db = () => ({
  brands: [
    {
      name: 'Anycubic',
      keys: ['anycubic'],
      materials: {
        PLA: [
          { name: 'PLA Basic', temps: [], traits: '', colors: [['Black', '212721', '', ''], ['Red', 'C8102E', '', ''], ['Duo', '111111,222222', 'c', '']] },
          { name: 'PLA Matte', temps: [], traits: 'm', colors: [['Black', '1A1A1A', 'm', '']] },
        ],
        PETG: [{ name: 'PETG', temps: [], traits: '', colors: [['Black', '202020', '', '']] }],
      },
    },
    { name: 'Other', keys: ['other'], materials: { PLA: [{ name: 'PLA', temps: [], traits: '', colors: [['Black', '000000', '', '']] }] } },
  ],
});
const black = { brand: 'Anycubic', material: 'PLA', line: 'PLA Basic', color: 'Black', hex: '212121', was: '212721' };
const hexOf = (d, brand, material, line, color) => d.brands.find((b) => b.name === brand).materials[material].find((l) => l.name === line).colors.find((c) => c[0] === color);

describe('color overrides', () => {
  it('replace the hex of that color only, and remember the database hex', () => {
    const out = M.apply(db(), [black]);
    expect(hexOf(out, 'Anycubic', 'PLA', 'PLA Basic', 'Black')).toEqual(['Black', '212121', '', '', '212721']);
    expect(hexOf(out, 'Anycubic', 'PLA', 'PLA Basic', 'Red')[1]).toBe('C8102E');
    expect(hexOf(out, 'Anycubic', 'PLA', 'PLA Matte', 'Black')[1]).toBe('1A1A1A'); // another line
    expect(hexOf(out, 'Anycubic', 'PETG', 'PETG', 'Black')[1]).toBe('202020'); // another material
    expect(hexOf(out, 'Other', 'PLA', 'PLA', 'Black')[1]).toBe('000000'); // another brand
  });

  it('leave the original database untouched and share what they do not change', () => {
    const original = db();
    const out = M.apply(original, [black]);
    expect(hexOf(original, 'Anycubic', 'PLA', 'PLA Basic', 'Black')[1]).toBe('212721');
    expect(out.brands[1]).toBe(original.brands[1]);
    expect(M.apply(original, [])).toBe(original);
  });

  it('can cover every line that has a color of that name, and a line of its own wins', () => {
    const all = { ...black, line: M.ALL_LINES, hex: '222222' };
    let out = M.apply(db(), [all]);
    expect(hexOf(out, 'Anycubic', 'PLA', 'PLA Basic', 'Black')[1]).toBe('222222');
    expect(hexOf(out, 'Anycubic', 'PLA', 'PLA Matte', 'Black')[1]).toBe('222222');
    expect(hexOf(out, 'Anycubic', 'PETG', 'PETG', 'Black')[1]).toBe('202020');
    out = M.apply(db(), [all, black]);
    expect(hexOf(out, 'Anycubic', 'PLA', 'PLA Basic', 'Black')[1]).toBe('212121');
    expect(hexOf(out, 'Anycubic', 'PLA', 'PLA Matte', 'Black')[1]).toBe('222222');
  });

  it('change each color of a dual spool', () => {
    const out = M.apply(db(), [{ brand: 'Anycubic', material: 'PLA', line: 'PLA Basic', color: 'Duo', hex: '111111,333333', was: '111111,222222' }]);
    expect(hexOf(out, 'Anycubic', 'PLA', 'PLA Basic', 'Duo')[1]).toBe('111111,333333');
  });

  it('win even when the database has been corrected since (the color is still replaced)', () => {
    const fixed = db();
    hexOf(fixed, 'Anycubic', 'PLA', 'PLA Basic', 'Black')[1] = '202020';
    expect(hexOf(M.apply(fixed, [black]), 'Anycubic', 'PLA', 'PLA Basic', 'Black')[1]).toBe('212121');
  });

  it('show on the color as original and new, and the old hex still finds it', () => {
    const out = M.apply(db(), [black]);
    const entry = hexOf(out, 'Anycubic', 'PLA', 'PLA Basic', 'Black');
    expect(colorInfo(entry)).toMatchObject({ colors: ['212121'], original: ['212721'] });
    expect(colorInfo(hexOf(db(), 'Anycubic', 'PLA', 'PLA Basic', 'Black')).original).toBeNull();
    expect(findColor(out, { brand: 'Anycubic', type: 'PLA' }, ['212721']).entry[0]).toBe('Black'); // a tag written before
    expect(findColor(out, { brand: 'Anycubic', type: 'PLA' }, ['212121']).entry[0]).toBe('Black');
    const tile = tilesFor(linesForMaterial(out, 'Anycubic', 'PLA').slice(0, 1))[0];
    expect(tile.info.name).toBe('Black');
  });

  it('are set, replaced and dropped', () => {
    let edits = M.set([], black);
    expect(edits).toHaveLength(1);
    edits = M.set(edits, { ...black, hex: '222222' });
    expect(edits).toHaveLength(1);
    expect(edits[0].hex).toBe('222222');
    expect(M.set(edits, { ...black, hex: '212721' })).toEqual([]); // back to the database's own hex
    expect(M.remove(edits, black)).toEqual([]);
    expect(M.set(edits, { ...black, hex: 'nope' })).toBe(edits);
    expect(M.set(edits, { ...black, hex: '222222,333333' })).toBe(edits); // the number of colors can't change
  });

  it('for every line replace the single-line ones for that color', () => {
    let edits = M.set([], black);
    edits = M.set(edits, { ...black, line: 'PLA Matte', was: '1A1A1A', hex: '181818' });
    edits = M.set(edits, { ...black, line: M.ALL_LINES, hex: '222222' });
    expect(edits.map((e) => e.line)).toEqual([M.ALL_LINES]);
  });

  it('say how each stands against the database', () => {
    const edits = [black, { ...black, color: 'Red', was: 'C8102E', hex: 'FF0000' }, { ...black, color: 'Gone', was: '000000', hex: '111111' }];
    const changed = db();
    hexOf(changed, 'Anycubic', 'PLA', 'PLA Basic', 'Red')[1] = 'D00000'; // the database moved on
    const r = M.report(changed, edits);
    expect(r.map((x) => x.state)).toEqual(['ok', 'changed', 'missing']);
    expect(r[1].dbNow).toBe('D00000');
    // Works on a database that already has the overrides applied, too
    expect(M.report(M.apply(db(), edits), edits).map((x) => x.state)).toEqual(['ok', 'ok', 'missing']);
  });

  it('are kept and loaded, ignoring damaged storage', () => {
    const s = memory();
    M.store([black], s);
    expect(M.load(s)).toEqual([black]);
    M.store([], s);
    expect(M.load(s)).toEqual([]);
    expect(M.load(memory('not json'))).toEqual([]);
    expect(M.load(memory('[{"brand":"A"},{"brand":"Anycubic","material":"PLA","line":"L","color":"C","hex":"#abcdef","was":"123456"}]'))).toHaveLength(1);
  });

  it('import an exported list, adding what is new', () => {
    const other = { ...black, color: 'Red', was: 'C8102E', hex: 'FF0000' };
    const r = M.importInto([black], [other, black]);
    expect(r.added).toBe(1);
    expect(r.edits).toHaveLength(2);
    expect(() => M.importInto([], { x: 1 })).toThrow();
    expect(() => M.importInto([], [{ nope: 1 }])).toThrow();
    expect(M.importInto([black], []).added).toBe(0);
  });
});
