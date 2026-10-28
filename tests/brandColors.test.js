import { describe, it, expect } from 'vitest';
import * as BC from '../src/lib/brandColors.js';
import { VARIANTS } from '../src/lib/catalog.js';
import snapshot from '../src/data/brand-colors.json' with { type: 'json' };

const line = (name, traits = '', colors = [['White', 'FFFFFF', '', '']], temps = [200, 220, 55, 60]) => ({ name, temps, traits, colors });
const DB = {
  source: {},
  brands: [
    {
      name: 'Acme 3D',
      keys: ['acme', 'acme3d'],
      materials: {
        PLA: [
          line('PLA Basic', '', [['Jade White', 'FFFFFF', '', 'FEFEFE'], ['Black', '000000', '', '']]),
          line('PLA Basic Gradient', 'g', [['Sunset', 'FF0000,FFFF00', 'g', '']]),
          line('PLA Matte', 'm'),
          line('Velvet PLA', 'm'), // matte only by its trait
          line('PLA Silk+', 's', [['Gold', 'D4AF37', 's', '']]),
          line('PLA Galaxy'),
          line('PLA-CF', 'cf', [['Black', '111111', 'cf', '']]),
          line('High Speed PLA', 'h'),
        ],
        TPU: [line('TPU 95A'), line('TPU 95A HF', 'h')],
        PA6: [line('PA6 Nylon'), line('PA6-CF', 'cf')],
      },
    },
  ],
};
const names = (r) => r.lines.map((l) => l.name);

describe('brand colors: groups', () => {
  it('matches brands loosely and not at all for Generic or unknown brands', () => {
    expect(BC.findBrand(DB, 'ACME').name).toBe('Acme 3D');
    expect(BC.findBrand(DB, 'Acme-3D').name).toBe('Acme 3D');
    expect(BC.findBrand(DB, 'Generic')).toBeNull();
    expect(BC.findBrand(DB, '')).toBeNull();
    expect(BC.linesFor(DB, { brand: 'Nobody', type: 'PLA' })).toMatchObject({ lines: [], total: 0 });
  });

  it('puts each line in one group: name first, finish before multi-color, HF after finishes', () => {
    const g = (name, traits = '') => BC.groupOf({ name, traits });
    expect(g('PLA Basic')).toBe('Basic');
    expect(g('PLA Basic Gradient')).toBe('Basic');
    expect(g('PLA+ 2.0')).toBe('Basic');
    expect(g('PLA Wood')).toBe('Wood');
    expect(g('Real Wood Fiber PLA')).toBe('Wood');
    expect(g('Silk PLA+ Dual-Color')).toBe('Silk');
    expect(g('High Speed Matte PLA')).toBe('Matte');
    expect(g('High Speed PLA')).toBe('HF');
    expect(g('PLA Rainbow')).toBe('Multi-color');
    expect(g('PLA Burnt Titanium Triple Color')).toBe('Multi-color');
    expect(g('PLA Luminous')).toBe('Glow');
    expect(g('PLA Twinkling')).toBe('Galaxy');
    expect(g('PLA Metal')).toBe('Metallic');
    expect(g('Neon Panchroma PLA')).toBe('Fluorescent');
    expect(g('Transparent Clear PLA')).toBe('Translucent');
    expect(g('Temperature Color Change PLA')).toBe('Color change');
    expect(g('Breakaway Support for PLA')).toBe('Support');
    expect(g('TPU 95A HF')).toBe('95A HF');
    expect(g('TPU 95A')).toBe('95A');
    expect(g('Velvet PLA', 'm')).toBe('Matte'); // finish tag when the name says nothing
    expect(g('Plain Thing')).toBe('Basic');
  });

  it('every group is a variant chip', () => {
    expect(BC.GROUPS).toEqual(VARIANTS.filter(Boolean));
    for (const name of ['PLA Wood', 'PLA Silk', 'PLA Rainbow', 'High Speed PLA', 'PLA Galaxy', 'x']) {
      expect(VARIANTS).toContain(BC.groupOf({ name, traits: '' }));
    }
  });

  it('a variant chip shows its group; no variant shows Basic', () => {
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Basic' }))).toEqual(['PLA Basic', 'PLA Basic Gradient']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Matte' }))).toEqual(['PLA Matte', 'Velvet PLA']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Silk' }))).toEqual(['PLA Silk+']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'HF' }))).toEqual(['High Speed PLA']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Galaxy' }))).toEqual(['PLA Galaxy']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'TPU', variant: '95A' }))).toEqual(['TPU 95A']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'TPU', variant: '95A HF' }))).toEqual(['TPU 95A HF']);
    const none = BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: '' });
    expect(none).toMatchObject({ filter: 'basic', group: 'Basic' });
    expect(names(none)).toEqual(['PLA Basic', 'PLA Basic Gradient']);
  });

  it('a Custom variant matches line names', () => {
    expect(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Velvet' })).toMatchObject({ filter: 'name' });
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'velvet' }))).toEqual(['Velvet PLA']);
  });

  it('a group with no lines says so, and Show all lists every line', () => {
    const r = BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Wood' });
    expect(r).toMatchObject({ lines: [], filter: 'nomatch', group: 'Wood', total: 7 });
    expect(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Wood', showAll: true }).lines).toHaveLength(7);
  });

  it('fiber materials use the base material’s fiber lines, and the base leaves them out', () => {
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA-CF', showAll: true }))).toEqual(['PLA-CF']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', showAll: true }))).not.toContain('PLA-CF');
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PA', showAll: true }))).toEqual(['PA6 Nylon']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PA-CF', showAll: true }))).toEqual(['PA6-CF']);
  });

  it('reads color entries, including gradients', () => {
    const grad = BC.colorInfo(DB.brands[0].materials.PLA[1].colors[0]);
    expect(grad).toMatchObject({ name: 'Sunset', colors: ['FF0000', 'FFFF00'], gradient: true });
    expect(BC.colorInfo(['Duo', 'FF0000,0000FF', 'c', '']).gradient).toBe(false);
  });

  it('suggests the line’s group as the variant', () => {
    const pla = DB.brands[0].materials.PLA;
    expect(BC.suggestedVariant(pla[2])).toBe('Matte');
    expect(BC.suggestedVariant(pla[5])).toBe('Galaxy');
    expect(BC.suggestedVariant(DB.brands[0].materials.TPU[1])).toBe('95A HF');
  });

  it('finds a tag’s colors, including alternate hex values', () => {
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA' }, ['000000']).entry[0]).toBe('Black');
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA' }, ['fefefe']).entry[0]).toBe('Jade White');
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA' }, ['FF0000', 'FFFF00']).entry[0]).toBe('Sunset');
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA' }, ['123456'])).toBeNull();
    // the same white in two lines: the variant's group wins
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA', variant: 'Matte' }, ['FFFFFF']).line.name).toBe('PLA Matte');
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA', variant: 'Basic' }, ['FFFFFF']).line.name).toBe('PLA Basic');
    expect(BC.findColor(snapshot, { brand: 'Bambu Lab', type: 'PLA', variant: 'Basic' }, ['FFFFFF']).entry[0]).toBe('Jade White'); // not Aero's White
  });
});

describe('brand colors: variant chips per brand', () => {
  const brandDb = (lines) => ({ source: {}, brands: [{ name: 'Acme', keys: ['acme'], materials: { PLA: lines } }] });

  it('only lists the groups the brand has, in the usual order, with None first', () => {
    expect(BC.variantChoices(DB, 'Acme', 'PLA')).toEqual(['', 'Basic', 'Matte', 'Silk', 'High Speed', 'Galaxy']); // its HF line is "High Speed PLA"
    expect(BC.variantChoices(DB, 'Acme', 'TPU')).toEqual(['', '95A', '95A HF']);
  });

  it('falls back to the full default list for unknown brands, materials, or no data', () => {
    expect(BC.variantChoices(DB, 'Generic', 'PLA')).toBe(VARIANTS);
    expect(BC.variantChoices(DB, 'Acme', 'ASA')).toBe(VARIANTS);
    expect(BC.variantChoices(null, 'Acme', 'PLA')).toBe(VARIANTS);
  });

  it('uses the brand’s own word when its lines in a group agree on one', () => {
    const db = brandDb([line('PLA Metal'), line('PLA Luminous'), line('Transparent Clear PLA'), line('Neon PLA')]);
    expect(BC.variantChoices(db, 'Acme', 'PLA')).toEqual(['', 'Luminous', 'Metal', 'Neon', 'Transparent']);
  });

  it('keeps the group name when lines use different words, or none', () => {
    const db = brandDb([line('PLA Galaxy'), line('PLA Sparkle'), line('Velvet PLA', 'm')]);
    expect(BC.variantChoices(db, 'Acme', 'PLA')).toEqual(['', 'Matte', 'Galaxy']);
  });

  it('a brand word picks its group, as a chip or typed as Custom', () => {
    const db = brandDb([line('PLA Metal'), line('PLA Basic')]);
    expect(names(BC.linesFor(db, { brand: 'Acme', type: 'PLA', variant: 'Metal' }))).toEqual(['PLA Metal']);
    expect(names(BC.linesFor(db, { brand: 'Acme', type: 'PLA', variant: 'metallic' }))).toEqual(['PLA Metal']);
    expect(BC.suggestedVariant(db.brands[0].materials.PLA[0], db, 'Acme', 'PLA')).toBe('Metal');
    expect(BC.suggestedVariant(db.brands[0].materials.PLA[0])).toBe('Metallic'); // without data: the group name
  });

  it('real brands', () => {
    const chips = (b, m) => BC.variantChoices(snapshot, b, m);
    expect(chips('Bambu Lab', 'PLA')).toContain('Metal');
    expect(chips('Bambu Lab', 'PLA')).not.toContain('SnapSpeed');
    expect(chips('Bambu Lab', 'PLA')).not.toContain('Metallic');
    expect(chips('Snapmaker', 'PLA')).toContain('SnapSpeed');
    expect(chips('Bambu Lab', 'PETG')).toEqual(['', 'Basic', 'Matte', 'HF', 'Translucent']);
    expect(chips('SUNLU', 'PLA')).toContain('Transparent');
    // every chip shown has colors
    for (const [b, m] of [['Bambu Lab', 'PLA'], ['SUNLU', 'PLA'], ['eSun', 'PLA'], ['Polymaker', 'PLA']]) {
      for (const v of chips(b, m).filter(Boolean)) {
        expect(BC.linesFor(snapshot, { brand: b, type: m, variant: v }).lines.length, `${b} ${m} ${v}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('brand colors: merging look-alikes', () => {
  const lineA = line('PLA Wood', '', [['Walnut', '5C4033', '', ''], ['Pine', 'E3C08D', '', '']]);
  const lineB = line('Real Wood Fiber PLA', '', [['walnut', '604236', '', ''], ['Pine', '3A5F0B', '', ''], ['Oak', 'B5835A', '', '']]);

  it('folds same-name, near-same-shade colors from another line into one tile', () => {
    const tiles = BC.tilesFor([lineA, lineB]);
    expect(tiles.map((t) => t.entry[0])).toEqual(['Walnut', 'Pine', 'Pine', 'Oak']); // the second Pine is a different shade
    expect(tiles[0].alsoIn).toEqual(['Real Wood Fiber PLA']);
    expect(tiles[1].alsoIn).toEqual([]);
  });

  it('keeps everything with merge off (Show all), and never merges within one line', () => {
    expect(BC.tilesFor([lineA, lineB], { merge: false })).toHaveLength(5);
    const same = line('X', '', [['Red', 'FF0000', '', ''], ['Red', 'FE0000', '', '']]);
    expect(BC.tilesFor([same])).toHaveLength(2);
  });

  it('compares every color of multi-color spools', () => {
    expect(BC.lookAlike('FF0000,0000FF', 'FA0505,0505FA')).toBe(true);
    expect(BC.lookAlike('FF0000,0000FF', 'FF0000,00FF00')).toBe(false);
    expect(BC.lookAlike('FF0000', 'FF0000,0000FF')).toBe(false);
  });
});

describe('the bundled snapshot', () => {
  it('is well formed', () => {
    expect(snapshot.source.repo).toContain('open-filament-database');
    expect(snapshot.brands.length).toBeGreaterThan(50);
    const HEX = /^[0-9A-F]{6}$/;
    for (const b of snapshot.brands) {
      expect(b.keys.length).toBeGreaterThan(0);
      for (const [material, lines] of Object.entries(b.materials)) {
        expect(material).toBe(material.toUpperCase());
        for (const l of lines) {
          expect(l.temps).toHaveLength(4);
          l.temps.forEach((t) => expect(t === null || Number.isInteger(t)).toBe(true));
          expect(l.colors.length).toBeGreaterThan(0);
          for (const [name, hex, , alt] of l.colors) {
            expect(name.length).toBeGreaterThan(0);
            hex.split(',').forEach((h) => expect(h).toMatch(HEX));
            if (alt) alt.split(',').forEach((h) => expect(h).toMatch(HEX));
          }
        }
      }
    }
  });

  it('has the brands FilaScribe lists (except Generic)', async () => {
    const { BRANDS } = await import('../src/lib/catalog.js');
    const missing = BRANDS.filter((b) => b !== 'Generic' && !BC.findBrand(snapshot, b));
    expect(missing).toEqual([]);
  });

  it('narrows real brands as expected', () => {
    const q = (brand, type, variant) => names(BC.linesFor(snapshot, { brand, type, variant }));
    expect(q('Bambu Lab', 'PLA', 'Basic')).toContain('PLA Basic');
    expect(q('Bambu Lab', 'PLA', 'Matte')).toEqual(['PLA Matte']);
    expect(q('Bambu Lab', 'PETG', 'HF')).toEqual(['PETG HF']);
    expect(q('Snapmaker', 'PLA', 'SnapSpeed')).toEqual(['SnapSpeed PLA']);
    expect(q('Bambu Lab', 'PLA', '')).toContain('PLA Basic'); // no variant = Basic
    expect(q('SUNLU', 'PLA', 'Wood')).toEqual(['PLA Wood', 'Real Wood Fiber PLA']);
    expect(q('SUNLU', 'PLA', 'Silk')).toContain('Silk PLA+ Dual-Color');
  });
});
