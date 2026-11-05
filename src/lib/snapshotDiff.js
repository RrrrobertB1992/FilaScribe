// What changed between two Brand colors snapshots (brand lists), used by the
// monthly pull request (scripts/snapshot-changes.js) and by Settings > Color
// database when an update is available.

/** Every color in a snapshot's brand list as Map("brand|material|line|name" -> { brand, where, name, hex, traits }) */
function flatten(brands) {
  const map = new Map();
  for (const b of brands) {
    for (const [material, lines] of Object.entries(b.materials)) {
      for (const l of lines) {
        for (const [name, hex, traits] of l.colors) {
          const key = [b.name, material, l.name, name].join('|');
          map.set(key, { brand: b.name, where: `${material} · ${l.name}`, name, hex: hex || '', traits: traits || '' });
        }
      }
    }
  }
  return map;
}

/** { brands: Map(brand -> { added, removed, changed }), newBrands, goneBrands } */
export function diffColors(oldBrands, newBrands) {
  const before = flatten(oldBrands);
  const after = flatten(newBrands);
  const byBrand = new Map();
  const slot = (brand) => {
    if (!byBrand.has(brand)) byBrand.set(brand, { added: [], removed: [], changed: [] });
    return byBrand.get(brand);
  };
  for (const [key, c] of after) {
    const old = before.get(key);
    if (!old) slot(c.brand).added.push(c);
    else if (old.hex !== c.hex || old.traits !== c.traits) slot(c.brand).changed.push({ ...c, oldHex: old.hex, oldTraits: old.traits });
  }
  for (const [key, c] of before) if (!after.has(key)) slot(c.brand).removed.push(c);
  const oldNames = new Set(oldBrands.map((b) => b.name));
  const newNames = new Set(newBrands.map((b) => b.name));
  return {
    brands: byBrand,
    newBrands: [...newNames].filter((n) => !oldNames.has(n)).sort(),
    goneBrands: [...oldNames].filter((n) => !newNames.has(n)).sort(),
  };
}

export function diffNames(oldNames = [], newNames = []) {
  const a = new Set(oldNames);
  const b = new Set(newNames);
  return { added: newNames.filter((n) => !a.has(n)), removed: oldNames.filter((n) => !b.has(n)) };
}
