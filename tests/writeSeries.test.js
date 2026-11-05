import { describe, it, expect } from 'vitest';
import * as WriteSeries from '../src/lib/writeSeries.js';

const KEY = '{"type":"PLA"}';

describe('write several tags in a row', () => {
  it('counts each tag written from the same form', () => {
    let s = null;
    for (const uid of ['04A1', '04A2', '04A3']) ({ series: s } = WriteSeries.record(s, uid, KEY));
    expect(s.count).toBe(3);
    expect(WriteSeries.current(s, KEY).count).toBe(3);
  });

  it('starts again when what is written changes', () => {
    const first = WriteSeries.record(null, '04A1', KEY).series;
    const next = WriteSeries.record(first, '04A2', '{"type":"PETG"}');
    expect(next.series.count).toBe(1);
    expect(next.repeat).toBe(false);
    // And the old series no longer shows for the new form
    expect(WriteSeries.current(first, '{"type":"PETG"}')).toBe(null);
  });

  it('spots the same tag twice in a row and does not count it', () => {
    let s = WriteSeries.record(null, '04:A1:B2', KEY).series;
    const again = WriteSeries.record(s, '04a1b2', KEY); // another spelling of the same id
    expect(again.repeat).toBe(true);
    expect(again.series.count).toBe(1);
  });

  it('only compares with the last tag, so going back to an older one counts', () => {
    let s = null;
    ({ series: s } = WriteSeries.record(s, '04A1', KEY));
    ({ series: s } = WriteSeries.record(s, '04A2', KEY));
    const back = WriteSeries.record(s, '04A1', KEY);
    expect(back.repeat).toBe(false);
    expect(back.series.count).toBe(3);
  });

  it('counts every write when the phone cannot say which tag it was (Web NFC)', () => {
    let s = null;
    let r;
    for (let i = 0; i < 3; i++) {
      r = WriteSeries.record(s, '', KEY);
      s = r.series;
      expect(r.repeat).toBe(false);
    }
    expect(s.count).toBe(3);
    expect(WriteSeries.record(s, undefined, KEY).series.count).toBe(4);
  });

  it('has nothing to show before the first tag or after the form changed', () => {
    expect(WriteSeries.current(null, KEY)).toBe(null);
    expect(WriteSeries.current({ key: KEY, count: 0, lastUid: '' }, KEY)).toBe(null);
  });

  it('words the count', () => {
    expect(WriteSeries.label(1)).toBe('1 tag written for this spool');
    expect(WriteSeries.label(5)).toBe('5 tags written for this spool');
  });
});
