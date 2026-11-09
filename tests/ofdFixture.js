// Test help: the Open Filament Database download (all.json) and its manifest,
// made from a brand colors snapshot, so tests can serve "the API" from memory.
// buildSnapshot(toAll(snapshot)) gives the snapshot's brands back.
const TRAIT = { g: 'gradual_color_change', c: 'coextruded', m: 'matte', s: 'silk', h: 'high_flow', t: 'translucent', w: 'glow', cf: 'contains_carbon_fiber', gf: 'contains_glass_fiber' };
const traits = (codes) => (codes ? Object.fromEntries(codes.split(',').map((c) => [TRAIT[c], true])) : undefined);
const hexes = (list) => list.split(',').map((h) => `#${h}`);

export function toAll(snapshot) {
  const date = snapshot.source?.date || '';
  const all = { version: date.replaceAll('-', '.'), generated_at: `${date}T00:00:00Z`, brands: [], materials: [], filaments: [], variants: [], sizes: [], stores: [], purchase_links: [] };
  (snapshot.brands || []).forEach((b, bi) => {
    const brandId = `b${bi}`;
    all.brands.push({ id: brandId, name: b.name, slug: b.keys[0] });
    Object.entries(b.materials).forEach(([material, lines], mi) => {
      const materialId = `${brandId}m${mi}`;
      all.materials.push({ id: materialId, brand_id: brandId, material });
      lines.forEach((l, li) => {
        const lineId = `${materialId}l${li}`;
        const [min_print_temperature, max_print_temperature, min_bed_temperature, max_bed_temperature] = l.temps.map((t) => t ?? undefined);
        all.filaments.push({ id: lineId, brand_id: brandId, material_id: materialId, material, name: l.name, discontinued: false, traits: traits(l.traits), min_print_temperature, max_print_temperature, min_bed_temperature, max_bed_temperature });
        for (const c of l.colors) {
          const main = hexes(c[1]);
          all.variants.push({ filament_id: lineId, name: c[0], discontinued: false, color_hex: main[0], color_hexes: main.length > 1 ? main : undefined, traits: traits(c[2]), hex_variants: c[3] ? hexes(c[3]) : undefined });
        }
      });
    });
  });
  return all;
}

/** The API's manifest for a download: its date and sizes. */
export function manifestFor(all, { size = 17000000, gz = 3400000 } = {}) {
  return { dataset_version: all.version, generated_at: all.generated_at, artifacts: [{ path: 'json/all.json', size }, { path: 'json/all.json.gz', size: gz }] };
}
