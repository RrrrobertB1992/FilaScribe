// Corrections for colors the Open Filament Database has wrong (a hex of
// #000000 where a color has no real value, or a dual/tri/rainbow spool with
// only one of its colors). scripts/color-overrides.json lists each one: the
// brand, material, line and color name as the database spells them, the wrong
// value it has (`was`) and the right one (`hex`, one to five comma-separated
// colors). An override can also change the color's trait tags: `wasTraits` is
// what the database has now and `traits` what to put there instead.
//
// An override only applies while the database still has the wrong value, so
// once it is fixed upstream the override steps aside (and is reported).
//
// Used by scripts/build-brand-colors.js on every rebuild, and by
// `node scripts/build-brand-colors.js --apply-overrides <snapshot>` to patch
// a snapshot that is already built.

/**
 * Apply `overrides` to `brands` (the snapshot's brand list), in place.
 * Returns { applied, fixedUpstream, missing }: each a list of overrides.
 */
export function applyOverrides(brands, overrides) {
  const applied = [];
  const fixedUpstream = [];
  const missing = [];
  for (const o of overrides) {
    const brand = brands.find((b) => b.name === o.brand);
    const line = brand?.materials?.[o.material]?.find((l) => l.name === o.line);
    const color = line?.colors?.find((c) => c[0] === o.color && c[1] === (o.was ?? c[1]) && c[2] === (o.wasTraits ?? c[2]));
    if (color) {
      color[1] = String(o.hex).toUpperCase();
      if (o.traits !== undefined) color[2] = o.traits;
      applied.push(o);
      continue;
    }
    // Still there, but not the wrong value any more: fixed upstream (or changed to something else, which is left alone)
    if (line?.colors?.some((c) => c[0] === o.color)) fixedUpstream.push(o);
    else missing.push(o); // the color is gone or renamed
  }
  return { applied, fixedUpstream, missing };
}

export const describe = (o) => `${o.brand} ${o.material} ${o.line} ${o.color}`;
