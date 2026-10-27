import { describe, it, expect } from 'vitest';
import * as SC from '../src/lib/savedColors.js';

const K = 'Polymaker|PLA';

describe('saved colors', () => {
  it('saves newest first and merges variants for the same colors', () => {
    let all = SC.save({}, K, ['111111'], '1', 'Matte');
    all = SC.save(all, K, ['222222'], '1', '');
    all = SC.save(all, K, ['111111'], '1', 'Silk');
    const list = SC.entriesFor(all, K);
    expect(list.map((e) => e.colors[0])).toEqual(['111111', '222222']);
    expect(list[0].variants).toEqual(['Matte', 'Silk']);
  });

  it('keeps gradient and segments of the same colors apart', () => {
    let all = SC.save({}, K, ['111111', '222222'], '0', '');
    all = SC.save(all, K, ['111111', '222222'], '1', '');
    expect(SC.entriesFor(all, K)).toHaveLength(2);
    expect(SC.entryId(SC.entriesFor(all, K)[1])).toBe('111111,222222~gradient');
  });

  it('removes a variant, then the row when none are left', () => {
    let all = SC.save({}, K, ['111111'], '1', 'Matte');
    all = SC.save(all, K, ['111111'], '1', 'Silk');
    all = SC.removeVariant(all, K, '111111', 'Matte');
    expect(SC.entriesFor(all, K)[0].variants).toEqual(['Silk']);
    all = SC.removeVariant(all, K, '111111', 'Silk');
    expect(all[K]).toBeUndefined();
  });

  it('replaces colors in place, or merges into a matching row', () => {
    let all = SC.save({}, K, ['111111'], '1', 'A');
    all = SC.save(all, K, ['222222'], '1', 'B');
    all = SC.rename(all, K, '111111', ' Black ');
    let r = SC.replaceColors(all, K, '111111', ['333333'], '1');
    expect(r.id).toBe('333333');
    expect(SC.entriesFor(r.all, K)[1]).toMatchObject({ colors: ['333333'], name: 'Black' });
    r = SC.replaceColors(r.all, K, '333333', ['222222'], '1');
    const list = SC.entriesFor(r.all, K);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'Black', variants: ['B', 'A'] });
  });

  it('imports a PrintTag-Web-Rrrrobert export and skips bad data', () => {
    const exported = {
      'Generic|PETG': [{ colors: ['aabbcc', 'nothex'], name: 'Sky', variants: ['Basic'] }],
      'bad key': [{ colors: ['000000'] }],
      'Generic|PLA': 'nope',
    };
    const { all, added } = SC.importInto({}, exported);
    expect(added).toBe(1);
    expect(Object.keys(all)).toEqual(['Generic|PETG']);
    expect(all['Generic|PETG'][0].colors).toEqual(['AABBCC']);
    const again = SC.importInto(all, { 'Generic|PETG': [{ colors: ['AABBCC'], name: '', variants: ['Matte'] }] });
    expect(again.added).toBe(0);
    expect(again.all['Generic|PETG'][0].variants).toEqual(['Basic', 'Matte']);
  });

  it('loads and stores through a storage object', () => {
    const mem = { v: null, getItem() { return this.v; }, setItem(_, v) { this.v = v; } };
    SC.store(SC.save({}, K, ['111111'], '1', ''), mem);
    expect(SC.load(mem)[K]).toHaveLength(1);
    mem.v = '{broken';
    expect(SC.load(mem)).toEqual({});
  });
});
