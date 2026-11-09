import { describe, it, expect } from 'vitest';
import snapshot from '../src/data/brand-colors.json' with { type: 'json' };
import { buildSnapshot, datasetDate } from '../src/lib/ofdSnapshot.js';
import { toAll } from './ofdFixture.js';

// A small download in the database's own shape
const all = () => ({
  version: '2026.12.01',
  generated_at: '2026-12-01T22:35:25Z',
  brands: [
    { id: 'b1', name: 'eSUN 3D', slug: 'esun_3d' },
    { id: 'b2', name: 'Empty Brand', slug: 'empty' },
  ],
  materials: [
    { id: 'm1', brand_id: 'b1', material: 'PLA' },
    { id: 'm2', brand_id: 'b1', material: 'petg' },
  ],
  filaments: [
    { id: 'f2', brand_id: 'b1', material_id: 'm1', name: 'Silk', discontinued: false, min_print_temperature: 200.4, max_print_temperature: 230 },
    { id: 'f1', brand_id: 'b1', material_id: 'm1', name: 'Basic', discontinued: false, min_print_temperature: 190, max_print_temperature: 220, min_bed_temperature: 45, max_bed_temperature: 60 },
    { id: 'f3', brand_id: 'b1', material_id: 'm2', name: 'Old Line', discontinued: true },
    { id: 'f4', brand_id: 'b1', material_id: 'm2', name: 'No Colors', discontinued: false },
  ],
  variants: [
    { filament_id: 'f1', name: 'White', color_hex: '#ffffff', discontinued: false },
    { filament_id: 'f1', name: 'Black', color_hex: '#000000', discontinued: false, hex_variants: ['#111111'] },
    { filament_id: 'f1', name: 'Gone', color_hex: '#123456', discontinued: true },
    { filament_id: 'f1', name: 'Broken', color_hex: 'red', discontinued: false },
    { filament_id: 'f2', name: 'Sunset', color_hex: '#FF0000', color_hexes: ['#FF0000', '#00FF00'], traits: { silk: true, gradual_color_change: true, recycled: true }, discontinued: false },
    { filament_id: 'f2', name: 'Gold', color_hex: '#D4AF37', traits: { silk: true, matte: false }, discontinued: false },
    { filament_id: 'f3', name: 'Red', color_hex: '#FF0000', discontinued: false },
  ],
  sizes: [{ id: 's1', variant_id: 'v1', filament_weight: 1000 }],
});

describe('building the snapshot from the database download', () => {
  it('groups colors by brand, material and line, the way the app reads them', () => {
    const { snapshot: s, colors } = buildSnapshot(all());
    expect(s.source).toEqual({ repo: 'https://api.openfilamentdatabase.org/', commit: '2026.12.01', date: '2026-12-01' });
    expect(colors).toBe(4);
    expect(s.brands).toEqual([
      {
        name: 'eSUN 3D',
        keys: ['esun', 'esun3d'],
        materials: {
          PLA: [
            { name: 'Basic', temps: [190, 220, 45, 60], traits: '', colors: [['Black', '000000', '', '111111'], ['White', 'FFFFFF', '', '']] },
            { name: 'Silk', temps: [200, 230, null, null], traits: 's', colors: [['Gold', 'D4AF37', 's', ''], ['Sunset', 'FF0000,00FF00', 'g,s', '']] },
          ],
        },
      },
    ]);
  });

  it('applies the corrections, and says which no longer fit', () => {
    const fix = { brand: 'eSUN 3D', material: 'PLA', line: 'Basic', color: 'Black', was: '000000', hex: '0A0A0A' };
    const stale = { ...fix, color: 'White', was: '000000', hex: 'FEFEFE' };
    const r = buildSnapshot(all(), [fix, stale]);
    expect(r.snapshot.brands[0].materials.PLA[0].colors[0]).toEqual(['Black', '0A0A0A', '', '111111']);
    expect(r.snapshot.brands[0].materials.PLA[0].colors[1][1]).toBe('FFFFFF');
    expect(r.overrides.applied).toEqual([fix]);
    expect(r.overrides.fixedUpstream).toEqual([stale]);
  });

  it('gives the built-in snapshot back from a download made of it', () => {
    const again = buildSnapshot(toAll(snapshot)).snapshot;
    const plain = (brands) => brands.map(({ name, materials }) => ({ name, materials }));
    expect(plain(again.brands)).toEqual(plain(snapshot.brands));
    expect(again.source.date).toBe(snapshot.source.date);
  });

  it('refuses a file that is not the download, and survives junk inside one', () => {
    for (const junk of [null, [], 'x', {}, { brands: [] }, { brands: {}, filaments: [], variants: [] }]) expect(() => buildSnapshot(junk)).toThrow();
    const messy = all();
    messy.brands.push(null, 7, { id: 'b9' });
    messy.filaments.push(null, { brand_id: 'b1' });
    messy.variants.push(null, { filament_id: 'f1' }, { filament_id: 'f1', name: 'No Hex' });
    messy.materials = 'nope';
    expect(buildSnapshot(messy).snapshot.brands).toHaveLength(0); // no material names, so nothing to file the lines under
  });

  it('reads the date from the version, or from when it was generated', () => {
    expect(datasetDate({ version: '2026.11.09' })).toBe('2026-11-09');
    expect(datasetDate({ version: 'nightly', generated_at: '2026-11-09T22:35:25Z' })).toBe('2026-11-09');
    expect(datasetDate({})).toBe('');
  });
});
