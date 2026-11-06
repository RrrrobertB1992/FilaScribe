import { describe, it, expect } from 'vitest';
import { toLab, parseHex, deltaE2000, compare, closeness, nearest, MAX_DELTA } from '../src/lib/colorMatch.js';

const tile = (name, ...colors) => ({ name, info: { colors } });

describe('colour math', () => {
  it('reads hex colors, with or without # and in short form', () => {
    expect(parseHex('FF8000')).toEqual([255, 128, 0]);
    expect(parseHex('#f80')).toEqual([255, 136, 0]);
    expect(parseHex('nope')).toBe(null);
    expect(parseHex('')).toBe(null);
    expect(parseHex(undefined)).toBe(null);
  });

  it('converts to Lab', () => {
    const [l, a, b] = toLab('FFFFFF');
    expect(l).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
    expect(toLab('000000')[0]).toBeCloseTo(0, 5);
    const red = toLab('FF0000');
    expect(red[0]).toBeCloseTo(53.24, 1);
    expect(red[1]).toBeCloseTo(80.09, 1);
  });

  // Reference pairs from Sharma, Wu and Dalal (2005), the CIEDE2000 test data
  it('matches the published CIEDE2000 test data', () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000([50, 3.1571, -77.2803], [50, 0, -82.7485])).toBeCloseTo(2.8615, 3);
    expect(deltaE2000([50, 2.8361, -74.02], [50, 0, -82.7485])).toBeCloseTo(3.4412, 3);
    expect(deltaE2000([50, 2.5, 0], [50, 0, -2.5])).toBeCloseTo(4.3065, 3);
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3);
  });

  it('is zero for the same color and the same both ways', () => {
    expect(deltaE2000(toLab('C4452F'), toLab('C4452F'))).toBe(0);
    const ab = deltaE2000(toLab('C4452F'), toLab('2F45C4'));
    expect(deltaE2000(toLab('2F45C4'), toLab('C4452F'))).toBeCloseTo(ab, 10);
  });
});

describe('same color family', () => {
  it('matches a nearby shade of the same color', () => {
    expect(compare('C4452F', 'C64A30').ok).toBe(true);
    expect(compare('C4452F', 'BD3B2A').ok).toBe(true);
    expect(compare('1E64C8', '2468CC').ok).toBe(true);
  });

  it('does not match orange with red', () => {
    expect(compare('FF0000', 'FF8C00').ok).toBe(false);
    expect(compare('C4452F', 'E8702A').ok).toBe(false);
    expect(compare('E53935', 'FB8C00').ok).toBe(false);
  });

  it('does not match pink with red', () => {
    expect(compare('FF0000', 'FF69B4').ok).toBe(false);
    expect(compare('FF0000', 'FFB6C1').ok).toBe(false);
    expect(compare('C4452F', 'F4A6B8').ok).toBe(false);
  });

  it('keeps the other families apart too', () => {
    expect(compare('FFD700', 'FFA500').ok).toBe(false); // yellow, orange
    expect(compare('00FF00', '00FF99').ok).toBe(false); // green, mint
    expect(compare('0000FF', '8000FF').ok).toBe(false); // blue, violet
    expect(compare('0000FF', '00BFFF').ok).toBe(false); // blue, sky blue
  });

  it('matches greys with greys and not with colors', () => {
    expect(compare('808080', '858585').ok).toBe(true);
    expect(compare('FFFFFF', 'F5F5F5').ok).toBe(true);
    expect(compare('000000', '0A0A0A').ok).toBe(true);
    expect(compare('808080', 'C0392B').ok).toBe(false);
    expect(compare('808080', '4A90E2').ok).toBe(false);
  });

  it('does not match far colors even in the same family', () => {
    expect(compare('FF0000', '400000').ok).toBe(false);
    expect(compare('FFFFFF', '808080').ok).toBe(false);
    expect(compare('FFFFFF', '000000').ok).toBe(false);
  });

  it('never matches something that is not a color', () => {
    expect(compare('FF0000', 'zzz')).toEqual({ delta: Infinity, ok: false });
    expect(compare('', 'FF0000').ok).toBe(false);
  });

  it('keeps its limit to a loose but fixed distance', () => {
    expect(MAX_DELTA).toBeGreaterThanOrEqual(10);
    expect(MAX_DELTA).toBeLessThanOrEqual(15);
  });
});

describe('closeness', () => {
  it('labels how close', () => {
    expect(closeness(['C4452F'], ['C64A30']).label).toBe('Very close');
    const near = closeness(['C4452F'], ['D1583B']);
    expect(near).not.toBe(null);
    expect(near.label).toBe('Close');
  });

  it('compares gradients and segments color by color, in order', () => {
    expect(closeness(['FF0000', '0000FF'], ['FA0505', '0505FA'])).not.toBe(null);
    expect(closeness(['FF0000', '0000FF'], ['0000FF', 'FF0000'])).toBe(null); // other way round
    expect(closeness(['FF0000', '0000FF'], ['FA0505', 'FF8C00'])).toBe(null); // one part off
  });

  it('only compares colors with the same number of parts', () => {
    expect(closeness(['FF0000'], ['FF0000', '0000FF'])).toBe(null);
    expect(closeness(['FF0000', '0000FF'], ['FF0000'])).toBe(null);
    expect(closeness([], [])).toBe(null);
  });
});

describe('nearest', () => {
  const tiles = [
    tile('Fire Red', 'BD3B2A'),
    tile('Red', 'C64A30'),
    tile('Coral', 'D1583B'),
    tile('Orange', 'E8702A'),
    tile('Pink', 'F4A6B8'),
    tile('Blue', '1E64C8'),
    tile('Duo', 'C64A30', '1E64C8'),
  ];

  it('lists the nearest first, only from the same family', () => {
    const r = nearest(tiles, ['C4452F'], 5);
    expect(r.map((x) => x.tile.name)).toEqual(['Red', 'Fire Red', 'Coral']);
    expect(r[0].delta).toBeLessThan(r[1].delta);
    expect(r[1].delta).toBeLessThan(r[2].delta);
  });

  it('stops at the limit', () => {
    expect(nearest(tiles, ['C4452F'], 2).map((x) => x.tile.name)).toEqual(['Red', 'Fire Red']);
    expect(nearest(tiles, ['C4452F'], 1)).toHaveLength(1);
  });

  it('gives nothing when the limit is 0', () => {
    expect(nearest(tiles, ['C4452F'], 0)).toEqual([]);
  });

  it('gives nothing when nothing is close', () => {
    expect(nearest(tiles, ['7A3FB8'], 3)).toEqual([]);
    expect(nearest([], ['C4452F'], 3)).toEqual([]);
  });

  it('only offers multi-color tiles for multi-color colors', () => {
    expect(nearest(tiles, ['C4452F', '1E64C8'], 3).map((x) => x.tile.name)).toEqual(['Duo']);
  });

  it('skips tiles whose colors are not valid', () => {
    expect(nearest([tile('Bad', 'zzz'), tile('Red', 'C64A30')], ['C4452F'], 3).map((x) => x.tile.name)).toEqual(['Red']);
    expect(nearest(tiles, ['zzz'], 3)).toEqual([]);
  });
});
