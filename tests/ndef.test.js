import { describe, it, expect } from 'vitest';
import { encodeMessage, decodeMessage, mimeRecord, wrapTlv, unwrapTlv, type2Footprint, TNF } from '../src/lib/ndef.js';

const bytes = (s) => new TextEncoder().encode(s);

describe('NDEF', () => {
  it('encodes a short MIME record', () => {
    const msg = encodeMessage([mimeRecord('application/json', bytes('{}'))]);
    // MB|ME|SR|TNF=2, type length 16, payload length 2
    expect([...msg.subarray(0, 3)]).toEqual([0xd2, 16, 2]);
    expect(msg.length).toBe(3 + 16 + 2);
  });

  it('round-trips short and long records', () => {
    const long = bytes('x'.repeat(300));
    const msg = encodeMessage([mimeRecord('application/json', bytes('{"a":1}')), { tnf: TNF.WELL_KNOWN, type: 'T', payload: long }]);
    const recs = decodeMessage(msg);
    expect(recs).toHaveLength(2);
    expect(recs[0].type).toBe('application/json');
    expect(new TextDecoder().decode(recs[0].payload)).toBe('{"a":1}');
    expect(recs[1].payload.length).toBe(300);
  });

  it('joins chunked records', () => {
    // First chunk: MB|CF|SR, TNF MIME; last chunk: ME|SR, TNF UNCHANGED, no type
    const msg = new Uint8Array([0xb2, 1, 2, 0x78, 0x41, 0x42, 0x56, 0, 1, 0x43]);
    const recs = decodeMessage(msg);
    expect(recs).toHaveLength(1);
    expect(new TextDecoder().decode(recs[0].payload)).toBe('ABC');
  });

  it('throws on a cut-short message', () => {
    expect(() => decodeMessage(new Uint8Array([0xd2, 16, 5, 0x61]))).toThrow();
  });

  it('wraps and finds the NDEF TLV', () => {
    const msg = encodeMessage([mimeRecord('application/json', bytes('{}'))]);
    const mem = wrapTlv(msg);
    expect(mem[0]).toBe(0x03);
    expect(mem[mem.length - 1]).toBe(0xfe);
    expect(mem.length).toBe(type2Footprint(msg.length));
    expect([...unwrapTlv(new Uint8Array([0x00, ...mem, 0, 0]))]).toEqual([...msg]);
    const big = new Uint8Array(300);
    expect([...wrapTlv(big).subarray(0, 4)]).toEqual([0x03, 0xff, 0x01, 0x2c]);
  });
});
