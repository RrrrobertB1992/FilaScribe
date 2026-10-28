// Tag size limits: how much fits on each NTAG, the switch to the long
// formats above 254/255 bytes, and the biggest tags the app can make.
import { describe, it, expect } from 'vitest';
import * as OS from '../src/lib/formats/openspool.js';
import { encodeMessage, decodeMessage, mimeRecord, wrapTlv, unwrapTlv, type2Footprint, maxMessageSize, NTAG } from '../src/lib/ndef.js';
import { CASES } from './compat/cases.js';

const messageFor = (form) => encodeMessage([mimeRecord(OS.MIME_TYPE, OS.encode(form).bytes)]);
const u1 = (over) => ({ ...OS.emptyForm('u1'), ...over });

describe('room on each tag', () => {
  it('matches the NTAG user memory sizes', () => {
    expect(maxMessageSize(NTAG.NTAG213.userBytes)).toBe(141);
    expect(maxMessageSize(NTAG.NTAG215.userBytes)).toBe(499);
    expect(maxMessageSize(NTAG.NTAG216.userBytes)).toBe(883);
  });

  it('is the largest message that fits, for every memory size', () => {
    for (let mem = 3; mem <= 1000; mem++) {
      const n = maxMessageSize(mem);
      expect(type2Footprint(n), `memory ${mem}`).toBeLessThanOrEqual(mem);
      expect(type2Footprint(n + 1), `memory ${mem}`).toBeGreaterThan(mem);
    }
  });

  it('switches to the 3-byte TLV length above 254 bytes', () => {
    expect([...wrapTlv(new Uint8Array(254)).subarray(0, 2)]).toEqual([0x03, 254]);
    expect([...wrapTlv(new Uint8Array(255)).subarray(0, 4)]).toEqual([0x03, 0xff, 0x00, 0xff]);
    for (const n of [0, 1, 253, 254, 255, 256, 499, 883]) {
      const msg = new Uint8Array(n).map((_, i) => i & 0xff);
      expect([...unwrapTlv(wrapTlv(msg))]).toEqual([...msg]);
    }
  });

  it('switches to the long NDEF record (4-byte length) at 256 bytes of payload', () => {
    const short = encodeMessage([mimeRecord(OS.MIME_TYPE, new Uint8Array(255))]);
    const long = encodeMessage([mimeRecord(OS.MIME_TYPE, new Uint8Array(256))]);
    expect(short[0] & 0x10).toBe(0x10); // SR flag
    expect(long[0] & 0x10).toBe(0);
    expect(long.length - short.length).toBe(1 + 3); // one more payload byte, 3 more length bytes
    expect(decodeMessage(long)[0].payload).toHaveLength(256);
  });
});

describe('FilaScribe tags', () => {
  it('the default tags fit an NTAG215 with room to spare', () => {
    expect(messageFor(OS.emptyForm('u1')).length).toBeLessThan(250);
    expect(messageFor(OS.emptyForm('standard')).length).toBeLessThan(200);
  });

  it('the largest tag the form allows (ASCII) fits an NTAG215 but not an NTAG213', () => {
    const largest = CASES.find((c) => c.name.startsWith('largest')).form;
    const n = messageFor(largest).length;
    expect(n).toBeGreaterThan(255); // uses the long formats
    expect(n).toBeLessThanOrEqual(maxMessageSize(NTAG.NTAG215.userBytes));
    expect(n).toBeGreaterThan(maxMessageSize(NTAG.NTAG213.userBytes));
  });

  it('long non-ASCII names can overflow an NTAG215 (the app must refuse them)', () => {
    const wide = '€'.repeat(40); // 3 bytes each in UTF-8
    const n = messageFor(u1({ brand: wide, type: wide, subtype: wide, colors: ['111111', '222222', '333333', '444444', '555555'], colorType: '0' })).length;
    expect(n).toBeGreaterThan(maxMessageSize(NTAG.NTAG215.userBytes));
    expect(n).toBeLessThanOrEqual(maxMessageSize(NTAG.NTAG216.userBytes));
  });

  it('every compatibility case fits an NTAG215', () => {
    for (const c of CASES) expect(messageFor(c.form).length, c.name).toBeLessThanOrEqual(499);
  });
});
