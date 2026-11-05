// Writing several tags from one form in a row (Create): how many tags this
// spool has had, and whether the tag just written is the one before it. The
// series belongs to one tag's content: change the form and it starts again.
// Kept in memory only; nothing here is saved on the device.

/** The ids the phone reports look like "04:A1:B2…" or "04a1b2…"; compare them as plain hex. */
export const cleanUid = (uid) => String(uid || '').replace(/[^0-9a-f]/gi, '').toUpperCase();

/**
 * Count one more written tag.
 * - `series`: what record() returned last time, or null at the start.
 * - `uid`: the tag's id, or '' when the phone can't say (Web NFC).
 * - `key`: what was written. Another key means a new series.
 * Returns { series, repeat }. `repeat` is true when `uid` is the same tag as
 * the last one: it was written again, but it isn't counted.
 */
export function record(series, uid, key) {
  const id = cleanUid(uid);
  const same = series && series.key === key;
  const prev = same ? series : { key, count: 0, lastUid: '' };
  const repeat = !!id && id === prev.lastUid;
  return {
    series: repeat ? prev : { key, count: prev.count + 1, lastUid: id },
    repeat,
  };
}

/** The series while it still matches what's on the form (null once the form changed). */
export const current = (series, key) => (series && series.key === key && series.count > 0 ? series : null);

/** "1 tag written for this spool" */
export const label = (count) => `${count} ${count === 1 ? 'tag' : 'tags'} written for this spool`;
