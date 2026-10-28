// OpenSpool tag format: one NDEF record, MIME type application/json.
//
// Sources, field by field (nothing else is written):
//  - OpenSpool spec, https://openspool.io/rfid.html:
//      protocol, version, type, color_hex, brand, min_temp, max_temp
//  - Snapmaker U1 extended firmware (paxx12), docs/design/openspool.md:
//      bed_min_temp, bed_max_temp, subtype, alpha, additional_color_hexes,
//      weight, diameter
//  - color_type: Rrrrobert's extension (pending in the U1 firmware and
//    OpenRFID PRs), using OrcaSlicer's filament_colour_type values. Only
//    0 (gradient) is written, and only with 2+ colors; when it's missing,
//    readers treat the colors as solid/segments.

export const MIME_TYPE = 'application/json';
export const PROTOCOL = 'openspool';
export const VERSION = '1.0';

/** Field sets. "standard" is the official spec; "u1" adds the U1 fields. */
export const PROFILES = {
  standard: { label: 'OpenSpool (standard)' },
  u1: { label: 'OpenSpool + Snapmaker U1 fields' },
};

/** Most extra colors after color_hex (the U1 doc and OpenRFID read up to 4). */
export const MAX_ADDITIONAL_COLORS = 4;
export const MAX_COLORS = MAX_ADDITIONAL_COLORS + 1;

/** OrcaSlicer filament_colour_type values. */
export const COLOR_TYPE_GRADIENT = '0';
export const COLOR_TYPE_SEGMENTS = '1';

// Keys this format knows. Anything else found on a tag is reported as
// unknown and is not written back.
const STANDARD_KEYS = ['protocol', 'version', 'type', 'color_hex', 'brand', 'min_temp', 'max_temp'];
const U1_KEYS = ['bed_min_temp', 'bed_max_temp', 'subtype', 'alpha', 'additional_color_hexes', 'weight', 'diameter'];
const EXTENSION_KEYS = ['color_type'];
const KNOWN_KEYS = new Set([...STANDARD_KEYS, ...U1_KEYS, ...EXTENSION_KEYS]);

/** A blank form, with PLA defaults. */
export function emptyForm(profile = 'u1') {
  return {
    profile,
    type: 'PLA',
    brand: 'Generic',
    colors: ['FFFFFF'],
    colorType: COLOR_TYPE_SEGMENTS,
    minTemp: '190',
    maxTemp: '220',
    bedMinTemp: '50',
    bedMaxTemp: '60',
    subtype: '',
    alpha: 'FF',
    weight: '',
    diameter: '',
  };
}

// --- Value helpers ---

/**
 * A tag value as text. Only strings and numbers count: anything else (an
 * object, array or boolean on a damaged or odd tag) reads as empty rather
 * than being converted, which could throw.
 */
function scalar(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

/** "#abc" / "abc" / "#aabbcc" -> "AABBCC", or null if it isn't a hex color. */
export function normalizeHex(value) {
  let v = scalar(value).trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(v)) v = v.split('').map((c) => c + c).join('');
  return /^[0-9A-F]{6}$/.test(v) ? v : null;
}

function normalizeAlpha(value) {
  const v = scalar(value).trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]$/.test(v)) return '0' + v;
  return /^[0-9A-F]{2}$/.test(v) ? v : null;
}

const str = (v) => scalar(v).trim();
const isInt = (v) => /^\d+$/.test(v);
const isDecimal = (v) => /^\d+(\.\d+)?$/.test(v);

/** Colors that will be written: color 1 plus the extra colors (U1 only). */
export function usedColors(form) {
  const colors = (form.colors || []).map(normalizeHex);
  const max = form.profile === 'u1' ? MAX_COLORS : 1;
  return colors.slice(0, max);
}

// --- Validation ---

/**
 * Problems that stop a write, as { field, message }. An empty list means
 * the form can be written.
 */
export function validate(form) {
  const errors = [];
  const u1 = form.profile === 'u1';
  const add = (field, message) => errors.push({ field, message });

  if (!str(form.type)) add('type', 'Pick a material type.');

  const colors = usedColors(form);
  colors.forEach((hex, i) => {
    if (!hex) add(`color${i + 1}`, `Color ${i + 1} isn't a valid hex color (use 3 or 6 hex digits).`);
  });

  const temp = (field, label) => {
    const v = str(form[field]);
    if (v && (!isInt(v) || Number(v) > 500)) add(field, `${label} must be a whole number from 0 to 500 °C.`);
    return v && isInt(v) ? Number(v) : null;
  };
  const range = (minField, maxField, label) => {
    const min = temp(minField, `${label} min`);
    const max = temp(maxField, `${label} max`);
    if (min !== null && max !== null && min > max) add(maxField, `${label} max is below ${label.toLowerCase()} min.`);
  };
  range('minTemp', 'maxTemp', 'Nozzle');

  if (u1) {
    range('bedMinTemp', 'bedMaxTemp', 'Bed');
    if (str(form.alpha) && !normalizeAlpha(form.alpha)) add('alpha', 'Transparency must be 2 hex digits (00–FF).');
    const w = str(form.weight);
    if (w && !isInt(w)) add('weight', 'Weight must be a whole number of grams.');
    const d = str(form.diameter);
    if (d && (!isDecimal(d) || Number(d) <= 0)) add('diameter', 'Diameter must be a number in mm, e.g. 1.75.');
  }
  return errors;
}

// --- Building ---

/**
 * The JSON object to write. Assumes validate(form) passed. Empty optional
 * fields are left out; values follow the spec examples (temperatures as
 * strings, colors as 6 hex digits without '#').
 */
export function build(form) {
  const u1 = form.profile === 'u1';
  const colors = usedColors(form);
  const data = {
    protocol: PROTOCOL,
    version: VERSION,
    type: str(form.type),
    color_hex: colors[0],
  };

  if (u1 && colors.length > 1) {
    data.additional_color_hexes = colors.slice(1);
    if (form.colorType === COLOR_TYPE_GRADIENT) data.color_type = 0;
  }

  const set = (key, value) => {
    const v = str(value);
    if (v) data[key] = v;
  };
  set('brand', form.brand);
  set('min_temp', form.minTemp);
  set('max_temp', form.maxTemp);

  if (u1) {
    set('bed_min_temp', form.bedMinTemp);
    set('bed_max_temp', form.bedMaxTemp);
    set('subtype', form.subtype);
    // FF (opaque) is the documented default, so it's left out
    const alpha = normalizeAlpha(form.alpha);
    if (alpha && alpha !== 'FF') data.alpha = alpha;
    set('weight', form.weight);
    set('diameter', form.diameter);
  }
  return data;
}

/** JSON text and bytes for the NDEF record payload. */
export function encode(form) {
  const json = JSON.stringify(build(form));
  return { json, bytes: new TextEncoder().encode(json) };
}

// --- Parsing ---

/** True if this parsed JSON value is an OpenSpool payload. */
export function isOpenSpool(data) {
  return !!data && typeof data === 'object' && !Array.isArray(data) && data.protocol === PROTOCOL;
}

/**
 * Turn a tag's JSON into a form. Returns { form, unknownKeys, notes }.
 * unknownKeys lists fields that aren't in the documented spec; they're
 * shown to the user and dropped on the next write.
 */
export function parse(data) {
  if (!isOpenSpool(data)) throw new Error('Not an OpenSpool tag (protocol isn’t "openspool").');

  const notes = [];
  const unknownKeys = Object.keys(data).filter((k) => !KNOWN_KEYS.has(k));
  const usesU1 = Object.keys(data).some((k) => U1_KEYS.includes(k) || EXTENSION_KEYS.includes(k));

  const form = emptyForm(usesU1 ? 'u1' : 'standard');
  form.type = str(data.type) || 'PLA';
  form.brand = str(data.brand);

  const main = normalizeHex(data.color_hex);
  if (!main && data.color_hex !== undefined) notes.push(`color_hex "${str(data.color_hex) || JSON.stringify(data.color_hex)}" isn't a valid color; using white.`);
  const extra = Array.isArray(data.additional_color_hexes) ? data.additional_color_hexes : [];
  if (extra.length > MAX_ADDITIONAL_COLORS) {
    notes.push(`The tag has ${extra.length} extra colors; only the first ${MAX_ADDITIONAL_COLORS} are kept.`);
  }
  form.colors = [main || 'FFFFFF', ...extra.slice(0, MAX_ADDITIONAL_COLORS).map((h) => normalizeHex(h) || 'FFFFFF')];
  form.colorType = scalar(data.color_type) === '0' ? COLOR_TYPE_GRADIENT : COLOR_TYPE_SEGMENTS;

  form.minTemp = str(data.min_temp);
  form.maxTemp = str(data.max_temp);
  form.bedMinTemp = str(data.bed_min_temp);
  form.bedMaxTemp = str(data.bed_max_temp);
  form.subtype = str(data.subtype);
  form.alpha = normalizeAlpha(data.alpha) || 'FF';
  form.weight = str(data.weight);
  form.diameter = str(data.diameter);

  if (data.version !== undefined && str(data.version) !== VERSION) {
    notes.push(`The tag says version "${str(data.version) || JSON.stringify(data.version)}"; it will be written back as "${VERSION}".`);
  }
  return { form, unknownKeys, notes };
}

/** Parse a record payload (bytes or text). */
export function decode(payload) {
  const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The tag’s JSON record isn’t valid JSON.');
  }
  return { raw: data, ...parse(data) };
}
