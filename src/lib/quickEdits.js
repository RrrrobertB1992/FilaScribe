// Quick edits on Read & update: change the weight or the nozzle temperatures
// with one tap, and list what changed since the tag was read. These work on
// the form's own text fields, so the cards below always agree with them.

/** The fields the card edits, with the words and limits used on screen. */
export const FIELDS = {
  weight: { label: 'Weight', unit: 'g', max: 99999, start: 1000 },
  minTemp: { label: 'Nozzle min', unit: '°C', max: 500, start: 200 },
  maxTemp: { label: 'Nozzle max', unit: '°C', max: 500, start: 200 },
};

const whole = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) : null);

/**
 * The text a field gets after a tap of `delta` (negative to go down).
 * An empty or invalid field starts from the field's `start` on the first
 * tap up, and a tap down leaves it alone. Stays between 0 and the field's max.
 */
export function bump(field, current, delta) {
  const { max, start } = FIELDS[field];
  const n = whole(current);
  if (n === null) return delta > 0 ? String(start) : String(current ?? '');
  return String(Math.min(max, Math.max(0, n + delta)));
}

/** The values to come back to: what the tag held when it was read. */
export const snapshot = (form) => Object.fromEntries(Object.keys(FIELDS).map((f) => [f, String(form[f] ?? '')]));

/**
 * What changed since `before` (a snapshot): [{ field, label, now, was }],
 * `now` and `was` as shown ("750 g", "not set").
 */
export function changes(before, form) {
  const show = (f, v) => (String(v ?? '').trim() === '' ? 'not set' : `${String(v).trim()} ${FIELDS[f].unit}`);
  return Object.keys(FIELDS)
    .filter((f) => String(form[f] ?? '').trim() !== String(before?.[f] ?? '').trim())
    .map((f) => ({ field: f, label: FIELDS[f].label, now: show(f, form[f]), was: show(f, before?.[f]) }));
}
