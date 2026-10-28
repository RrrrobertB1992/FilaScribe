import { describe, it, expect } from 'vitest';
import * as BC from '../src/lib/brandColors.js';
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

describe('brand colors: finding lines', () => {
  it('matches brands loosely and not at all for Generic or unknown brands', () => {
    expect(BC.findBrand(DB, 'ACME').name).toBe('Acme 3D');
    expect(BC.findBrand(DB, 'Acme-3D').name).toBe('Acme 3D');
    expect(BC.findBrand(DB, 'Generic')).toBeNull();
    expect(BC.findBrand(DB, '')).toBeNull();
    expect(BC.linesFor(DB, { brand: 'Nobody', type: 'PLA' })).toMatchObject({ lines: [], total: 0 });
  });

  it('narrows lines by the variant: name, finish trait, and more specific variants', () => {
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Basic' }))).toEqual(['PLA Basic', 'PLA Basic Gradient']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Matte' }))).toEqual(['PLA Matte', 'Velvet PLA']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'Silk' }))).toEqual(['PLA Silk+']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'HF' }))).toEqual(['High Speed PLA']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'TPU', variant: '95A' }))).toEqual(['TPU 95A']);
    expect(names(BC.linesFor(DB, { brand: 'Acme', type: 'TPU', variant: '95A HF' }))).toEqual(['TPU 95A HF']);
  });

  it('no variant shows the lines that fit no variant chip', () => {
    const r = BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: '' });
    expect(r.filter).toBe('none');
    expect(names(r)).toEqual(['PLA Galaxy']);
  });

  it('a variant that fits nothing says so, and Show all lists every line', () => {
    const r = BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'SnapSpeed' });
    expect(r).toMatchObject({ lines: [], filter: 'nomatch', total: 7 });
    expect(BC.linesFor(DB, { brand: 'Acme', type: 'PLA', variant: 'SnapSpeed', showAll: true }).lines).toHaveLength(7);
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

  it('suggests the most specific variant for a line', () => {
    const pla = DB.brands[0].materials.PLA;
    expect(BC.suggestedVariant(pla[2])).toBe('Matte');
    expect(BC.suggestedVariant(pla[5])).toBe('');
    expect(BC.suggestedVariant(DB.brands[0].materials.TPU[1])).toBe('95A HF');
  });

  it('finds a tag’s colors, including alternate hex values', () => {
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA' }, ['000000']).entry[0]).toBe('Black');
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA' }, ['fefefe']).entry[0]).toBe('Jade White');
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA' }, ['FF0000', 'FFFF00']).entry[0]).toBe('Sunset');
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA' }, ['123456'])).toBeNull();
    // the same white in two lines: the variant's line wins
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA', variant: 'Matte' }, ['FFFFFF']).line.name).toBe('PLA Matte');
    expect(BC.findColor(DB, { brand: 'Acme', type: 'PLA', variant: 'Basic' }, ['FFFFFF']).line.name).toBe('PLA Basic');
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
    expect(q('Bambu Lab', 'PLA', '')).not.toContain('PLA Basic');
  });
});
