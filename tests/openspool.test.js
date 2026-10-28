import { describe, it, expect } from 'vitest';
import { emptyForm, build, parse, decode, validate, normalizeHex, encode } from '../src/lib/formats/openspool.js';

const form = (over) => ({ ...emptyForm('u1'), ...over });

describe('build', () => {
  it('writes the official example exactly', () => {
    const data = build({
      ...emptyForm('standard'),
      type: 'PLA', colors: ['FFAABB'], brand: 'Generic', minTemp: '220', maxTemp: '240',
    });
    expect(JSON.stringify(data)).toBe(JSON.stringify({
      protocol: 'openspool', version: '1.0', type: 'PLA', color_hex: 'FFAABB',
      brand: 'Generic', min_temp: '220', max_temp: '240',
    }));
  });

  it('leaves U1 fields out of the standard profile', () => {
    const data = build({ ...emptyForm('standard'), colors: ['FF0000', '00FF00'], subtype: 'Matte', colorType: '0' });
    expect(Object.keys(data)).toEqual(['protocol', 'version', 'type', 'color_hex', 'brand', 'min_temp', 'max_temp']);
  });

  it('matches the PrintTag-Web-Rrrrobert multi-color layout and key order', () => {
    const data = build(form({ colors: ['ff0000', '#00ff00', '00f'], colorType: '0', subtype: 'Silk' }));
    expect(Object.keys(data)).toEqual([
      'protocol', 'version', 'type', 'color_hex', 'additional_color_hexes', 'color_type',
      'brand', 'min_temp', 'max_temp', 'bed_min_temp', 'bed_max_temp', 'subtype',
    ]);
    expect(data.color_hex).toBe('FF0000');
    expect(data.additional_color_hexes).toEqual(['00FF00', '0000FF']);
    expect(data.color_type).toBe(0);
  });

  it('omits color_type for segments and for a single color', () => {
    expect(build(form({ colors: ['FF0000', '00FF00'], colorType: '1' }))).not.toHaveProperty('color_type');
    const one = build(form({ colors: ['FF0000'], colorType: '0' }));
    expect(one).not.toHaveProperty('color_type');
    expect(one).not.toHaveProperty('additional_color_hexes');
  });

  it('caps colors at 5', () => {
    const data = build(form({ colors: ['111111', '222222', '333333', '444444', '555555', '666666'] }));
    expect(data.additional_color_hexes).toHaveLength(4);
  });

  it('leaves empty optional fields and default alpha out', () => {
    const data = build(form({ brand: '', minTemp: '', maxTemp: '', bedMinTemp: '', bedMaxTemp: '', subtype: '', alpha: 'FF' }));
    expect(Object.keys(data)).toEqual(['protocol', 'version', 'type', 'color_hex']);
  });

  it('writes alpha, weight and diameter when set', () => {
    const data = build(form({ alpha: '80', weight: '1000', diameter: '1.75' }));
    expect(data.alpha).toBe('80');
    expect(data.weight).toBe('1000');
    expect(data.diameter).toBe('1.75');
  });
});

describe('validate', () => {
  it('passes the defaults', () => expect(validate(emptyForm())).toEqual([]));
  it('catches bad colors, temps and ranges', () => {
    const fields = validate(form({ colors: ['ZZZ'], minTemp: '230', maxTemp: '220', weight: '1.5' })).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['color1', 'maxTemp', 'weight']));
  });
  it('ignores extra colors in the standard profile', () => {
    expect(validate({ ...emptyForm('standard'), colors: ['FFFFFF', 'nope'] })).toEqual([]);
  });
});

describe('parse', () => {
  it('reads the official example as the standard profile', () => {
    const { form: f, unknownKeys } = parse({
      protocol: 'openspool', version: '1.0', type: 'PLA', color_hex: 'FFAABB', brand: 'Generic', min_temp: '220', max_temp: '240',
    });
    expect(f.profile).toBe('standard');
    expect(f.colors).toEqual(['FFAABB']);
    expect(unknownKeys).toEqual([]);
  });

  it('reads the U1 doc examples (numbers, # prefix, subtype)', () => {
    const { form: f } = parse({
      protocol: 'openspool', version: '1.0', brand: 'Generic', type: 'PLA', color_hex: '#FF0000',
      min_temp: 190, max_temp: 220, bed_min_temp: 50, bed_max_temp: 60,
    });
    expect(f.profile).toBe('u1');
    expect(f.colors).toEqual(['FF0000']);
    expect(f.minTemp).toBe('190');
    const { form: g } = parse({
      protocol: 'openspool', version: '1.0', type: 'PETG', subtype: 'Rapid', color_hex: 'AFAFAF',
      additional_color_hexes: ['EEFFEE', 'FF00FF'], alpha: 'FF', brand: 'Elegoo', min_temp: '230', max_temp: '260',
    });
    expect(g.subtype).toBe('Rapid');
    expect(g.colors).toEqual(['AFAFAF', 'EEFFEE', 'FF00FF']);
    expect(g.colorType).toBe('1');
  });

  it('reads color_type 0 as gradient, as number or string', () => {
    expect(parse({ protocol: 'openspool', color_hex: 'FFFFFF', additional_color_hexes: ['000000'], color_type: 0 }).form.colorType).toBe('0');
    expect(parse({ protocol: 'openspool', color_hex: 'FFFFFF', additional_color_hexes: ['000000'], color_type: '0' }).form.colorType).toBe('0');
  });

  it('reports undocumented fields', () => {
    const { unknownKeys } = parse({ protocol: 'openspool', type: 'PLA', color_hex: 'FFFFFF', spool_id: 4, lot_nr: 'A' });
    expect(unknownKeys).toEqual(['spool_id', 'lot_nr']);
  });

  it('rejects non-OpenSpool JSON', () => {
    expect(() => parse({ protocol: 'other' })).toThrow();
    expect(() => decode('not json')).toThrow();
  });

  it('round-trips through encode/decode', () => {
    const f = form({ colors: ['112233', '445566'], colorType: '0', subtype: 'Matte', brand: 'Polymaker', weight: '750' });
    const { bytes } = encode(f);
    const back = decode(bytes).form;
    expect(build(back)).toEqual(build(f));
  });
});

describe('normalizeHex', () => {
  it('expands and uppercases', () => {
    expect(normalizeHex('#abc')).toBe('AABBCC');
    expect(normalizeHex('a1b2c3')).toBe('A1B2C3');
    expect(normalizeHex('12345')).toBeNull();
  });
});
