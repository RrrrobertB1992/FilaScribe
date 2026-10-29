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
 * What each kind of variant is, in plain words, for the tiles in Settings →
 * Variants (someone new to filament can't guess CF or HT). Kinds that name
 * themselves (Matte, Silk, Wood, Glow...) have none.
 */
export const VARIANT_INFO = {
  Plus: 'Improved PLA, as in PLA+',
  SnapSpeed: 'Snapmaker’s fast-printing line',
  Support: 'Support material, to peel away or dissolve',
  HF: 'High speed, high flow',
  Fluorescent: 'Neon, very bright colors',
  'Multi-color': 'Several colors on one spool',
  'Color change': 'Changes color with temperature or light',
  Lightweight: 'Foamed, low density',
  Tough: 'Impact resistant, less brittle',
  CF: 'Carbon fiber (stiff, needs a hardened nozzle)',
  GF: 'Glass fiber (strong, needs a hardened nozzle)',
  FR: 'Flame retardant',
  ESD: 'Anti-static, for electronics',
  HT: 'High temperature, stays rigid near heat',
  Recycled: 'Made from recycled plastic',
};
