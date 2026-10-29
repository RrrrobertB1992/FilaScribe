// Palette choices for the form. Each palette also has a Custom option.

/** Material types with starting temperatures (°C) filled in when picked. */
export const MATERIALS = {
  PLA: { minTemp: 190, maxTemp: 220, bedMinTemp: 50, bedMaxTemp: 60 },
  PETG: { minTemp: 220, maxTemp: 250, bedMinTemp: 70, bedMaxTemp: 80 },
  ABS: { minTemp: 230, maxTemp: 260, bedMinTemp: 90, bedMaxTemp: 110 },
  ASA: { minTemp: 240, maxTemp: 270, bedMinTemp: 90, bedMaxTemp: 110 },
  TPU: { minTemp: 210, maxTemp: 230, bedMinTemp: 30, bedMaxTemp: 60 },
  PA: { minTemp: 240, maxTemp: 270, bedMinTemp: 70, bedMaxTemp: 90 },
  PA12: { minTemp: 240, maxTemp: 270, bedMinTemp: 70, bedMaxTemp: 90 },
  PC: { minTemp: 270, maxTemp: 310, bedMinTemp: 100, bedMaxTemp: 120 },
  PEEK: { minTemp: 360, maxTemp: 400, bedMinTemp: 120, bedMaxTemp: 150 },
  PVA: { minTemp: 190, maxTemp: 220, bedMinTemp: 50, bedMaxTemp: 60 },
  HIPS: { minTemp: 230, maxTemp: 250, bedMinTemp: 90, bedMaxTemp: 110 },
  PCTG: { minTemp: 220, maxTemp: 250, bedMinTemp: 70, bedMaxTemp: 80 },
  'PLA-CF': { minTemp: 190, maxTemp: 220, bedMinTemp: 50, bedMaxTemp: 60 },
  'PETG-CF': { minTemp: 230, maxTemp: 260, bedMinTemp: 70, bedMaxTemp: 80 },
  'PA-CF': { minTemp: 250, maxTemp: 280, bedMinTemp: 70, bedMaxTemp: 90 },
};

// Spelled as in OrcaSlicer's filament profiles (lib/brandColors.js
// canonicalBrand), so a chip, a typed brand and a read tag all write the
// name the slicer uses.
export const BRANDS = ['Generic', 'Bambu Lab', 'HATCHBOX', 'eSUN', 'Overture', 'SUNLU', 'Polymaker', 'Prusa Polymers', 'Snapmaker', 'JAYO'];

/**
 * Variants (the U1 "subtype"). '' means none: the field is left out. The
 * first ones match Snapmaker's filament names (plus "Plus" for PLA+ and the
 * like); the rest are common finishes.
 * Each one is also a Brand colors group (lib/brandColors.js).
 */
export const VARIANTS = [
  '', 'Basic', 'Plus', 'Matte', 'SnapSpeed', 'Silk', 'Support', 'HF', '95A', '95A HF',
  'Wood', 'Marble', 'Galaxy', 'Glow', 'Metallic', 'Multi-color', 'Fluorescent', 'Translucent', 'Color change',
];

export const COLOR_TYPES = [
  { value: '0', label: 'Gradient' },
  { value: '1', label: 'Segments' },
];

/**
 * What a kind of variant is, in a word or two, for the tiles in Settings →
 * Variants: the full name for the short ones (someone new to filament can't
 * guess CF or HT) and a plainer word where one helps (Neon). Kinds that name
 * themselves (Matte, Wood, Multi-color, Recycled...) have none.
 */
export const VARIANT_INFO = {
  Plus: 'PLA+',
  SnapSpeed: 'Fast printing',
  HF: 'High flow',
  Fluorescent: 'Neon',
  CF: 'Carbon fiber',
  GF: 'Glass fiber',
  FR: 'Flame retardant',
  ESD: 'Anti-static',
  HT: 'High temperature',
};
