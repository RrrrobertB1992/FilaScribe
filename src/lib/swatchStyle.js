// How a spool's colors are drawn (Settings → Appearance), three choices kept
// on the device. Each is stored only when it isn't the default.
//   circle: round swatches (spool preview, color slots, closest colors, My filaments, Settings)
//   tile:   the Brand and Saved color tiles; 'around' draws a circle on every tile
//   size:   how big that circle is on a tile (small = as tall as a color box, medium = half a
//           tile wide, large = the full tile width); only used when tile is 'around'
export const CIRCLE_KEY = 'filascribe-swatch-circle';
export const TILE_KEY = 'filascribe-swatch-tile';
export const SIZE_KEY = 'filascribe-swatch-tile-size';

function choice(key, list, fallback) {
  const clean = (value) => (typeof value === 'string' && list.includes(value) ? value : fallback);
  return {
    list,
    fallback,
    clean,
    load(storage = globalThis.localStorage) {
      try {
        const v = storage.getItem(key);
        return v === null ? fallback : clean(v);
      } catch {
        return fallback;
      }
    },
    store(value, storage = globalThis.localStorage) {
      try {
        if (clean(value) === fallback) storage.removeItem(key);
        else storage.setItem(key, clean(value));
      } catch {
        // Storage unavailable: the choice lasts until the page closes
      }
    },
  };
}

export const circle = choice(CIRCLE_KEY, ['vertical', 'angled', 'around'], 'around');
export const tile = choice(TILE_KEY, ['vertical', 'angled', 'around'], 'angled');
export const size = choice(SIZE_KEY, ['small', 'medium', 'large'], 'medium');
