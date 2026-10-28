// Minimal NDEF (NFC Data Exchange Format) codec, NFC Forum NDEF 1.0.
// Used by the Android app, which reads and writes whole NDEF messages as
// bytes, and for size checks. Web NFC encodes records itself.

export const TNF = {
  EMPTY: 0x00,
  WELL_KNOWN: 0x01,
  MIME: 0x02,
  ABSOLUTE_URI: 0x03,
  EXTERNAL: 0x04,
  UNKNOWN: 0x05,
  UNCHANGED: 0x06,
};

const MB = 0x80, ME = 0x40, CF = 0x20, SR = 0x10, IL = 0x08;

const ascii = (s) => new TextEncoder().encode(s);
const text = (b) => new TextDecoder().decode(b);

/** A MIME record, e.g. mimeRecord('application/json', bytes). */
export function mimeRecord(mediaType, payload) {
  return { tnf: TNF.MIME, type: mediaType, payload };
}

/** Encode records into one NDEF message. */
export function encodeMessage(records) {
  if (!records.length) throw new Error('An NDEF message needs at least one record.');
  const parts = records.map((r, i) => {
    const type = ascii(r.type || '');
    const id = r.id ? ascii(r.id) : new Uint8Array(0);
    const payload = r.payload || new Uint8Array(0);
    const short = payload.length < 256;
    let flags = (r.tnf & 0x07) | (short ? SR : 0) | (id.length ? IL : 0);
    if (i === 0) flags |= MB;
    if (i === records.length - 1) flags |= ME;
    const head = [flags, type.length];
    if (short) head.push(payload.length);
    else head.push((payload.length >>> 24) & 0xff, (payload.length >>> 16) & 0xff, (payload.length >>> 8) & 0xff, payload.length & 0xff);
    if (id.length) head.push(id.length);
    const out = new Uint8Array(head.length + type.length + id.length + payload.length);
    out.set(head, 0);
    out.set(type, head.length);
    out.set(id, head.length + type.length);
    out.set(payload, head.length + type.length + id.length);
    return out;
  });
  const total = parts.reduce((n, p) => n + p.length, 0);
  const msg = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { msg.set(p, o); o += p.length; }
  return msg;
}

/** Decode an NDEF message into records { tnf, type, id, payload }. */
export function decodeMessage(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const records = [];
  let o = 0;
  let chunk = null;
  while (o < b.length) {
    const need = (n) => { if (o + n > b.length) throw new Error('NDEF message is cut short.'); };
    need(2);
    const flags = b[o++];
    const typeLen = b[o++];
    let payloadLen;
    if (flags & SR) { need(1); payloadLen = b[o++]; }
    else { need(4); payloadLen = ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; o += 4; }
    let idLen = 0;
    if (flags & IL) { need(1); idLen = b[o++]; }
    need(typeLen + idLen + payloadLen);
    const type = text(b.subarray(o, o + typeLen)); o += typeLen;
    const id = text(b.subarray(o, o + idLen)); o += idLen;
    const payload = b.slice(o, o + payloadLen); o += payloadLen;
    const tnf = flags & 0x07;

    if (chunk) {
      // Middle or last chunk of a chunked record
      chunk.payload = concat(chunk.payload, payload);
      if (!(flags & CF)) { records.push(chunk); chunk = null; }
    } else if (flags & CF) {
      chunk = { tnf, type, id, payload };
    } else {
      records.push({ tnf, type, id, payload });
    }
    if (flags & ME) break;
  }
  if (chunk) throw new Error('NDEF message ends inside a chunked record.');
  return records;
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Bytes a message takes in NFC Forum Type 2 tag memory (NTAG21x): the
 * NDEF TLV header (2 bytes, or 4 above 254 bytes), the message, and the
 * terminator TLV.
 */
export function type2Footprint(messageLength) {
  return (messageLength > 254 ? 4 : 2) + messageLength + 1;
}

/** Largest NDEF message that fits in this much Type 2 tag user memory. */
export function maxMessageSize(userBytes) {
  // Short TLV form (2 + n + 1) holds up to 254 bytes; longer needs the 4-byte form
  const short = Math.min(254, userBytes - 3);
  const long = userBytes - 5;
  return Math.max(0, long > 254 ? long : short);
}

/** Wrap a message in Type 2 tag TLVs: NDEF TLV + terminator. */
export function wrapTlv(message) {
  const head = message.length > 254
    ? [0x03, 0xff, (message.length >> 8) & 0xff, message.length & 0xff]
    : [0x03, message.length];
  const out = new Uint8Array(head.length + message.length + 1);
  out.set(head, 0);
  out.set(message, head.length);
  out[out.length - 1] = 0xfe;
  return out;
}

/** Find the NDEF message inside Type 2 tag user memory (from page 4). */
export function unwrapTlv(memory) {
  let o = 0;
  while (o < memory.length) {
    const t = memory[o++];
    if (t === 0x00) continue; // NULL TLV
    if (t === 0xfe) return null; // terminator, no NDEF
    let len = memory[o++];
    if (len === 0xff) { len = (memory[o] << 8) | memory[o + 1]; o += 2; }
    if (t === 0x03) return memory.slice(o, o + len);
    o += len;
  }
  return null;
}

/** NTAG21x user memory sizes (bytes), from the GET_VERSION storage size byte. */
export const NTAG = {
  NTAG213: { userBytes: 144, pages: 45 },
  NTAG215: { userBytes: 504, pages: 135 },
  NTAG216: { userBytes: 888, pages: 231 },
};
