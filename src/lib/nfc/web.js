// Web NFC (https://w3c.github.io/web-nfc/). Chrome on Android only, over
// HTTPS. It reads and writes NDEF messages; it can't see raw pages.

import { TNF } from '../ndef.js';

let controller = null;

function abortActive() {
  if (controller) controller.abort();
  controller = null;
}

function error(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function mapDomError(e) {
  if (e && e.name === 'AbortError') return error('CANCELLED', 'Cancelled.');
  if (e && e.name === 'NotAllowedError') return error('NOT_ALLOWED', 'NFC permission was denied. Allow NFC for this site in Chrome’s site settings.');
  if (e && e.name === 'NotSupportedError') return error('NO_NFC', 'This device can’t use NFC from the browser.');
  if (e && e.name === 'NetworkError') return error('TAG_LOST', 'The tag moved away before it finished. Hold it still against the phone and try again.');
  return error('FAILED', (e && e.message) || String(e));
}

const TNF_BY_RECORD_TYPE = { empty: TNF.EMPTY, mime: TNF.MIME, url: TNF.WELL_KNOWN, text: TNF.WELL_KNOWN, 'absolute-url': TNF.ABSOLUTE_URI, unknown: TNF.UNKNOWN };

function toRecord(r) {
  const payload = r.data ? new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength).slice() : new Uint8Array(0);
  const external = r.recordType.includes(':');
  return {
    tnf: external ? TNF.EXTERNAL : (TNF_BY_RECORD_TYPE[r.recordType] ?? TNF.UNKNOWN),
    type: r.recordType === 'mime' ? r.mediaType : r.recordType,
    payload,
  };
}

export const webNfc = {
  kind: 'web',

  async status() {
    if (!('NDEFReader' in globalThis)) {
      return { available: false, reason: 'Web NFC isn’t available here. Open this page in Chrome on an Android phone, or use the Android app.' };
    }
    if (!globalThis.isSecureContext) {
      return { available: false, reason: 'Web NFC needs an https:// page.' };
    }
    return { available: true, enabled: true };
  },

  /** Wait for a tag and return its NDEF records. */
  async read() {
    abortActive();
    const c = new AbortController();
    controller = c;
    const reader = new globalThis.NDEFReader();
    return new Promise((resolve, reject) => {
      c.signal.addEventListener('abort', () => reject(error('CANCELLED', 'Cancelled.')), { once: true });
      // Settle first, then stop scanning (abort would otherwise reject)
      const done = (result) => {
        resolve(result);
        if (controller === c) controller = null;
        c.abort();
      };
      reader.onreading = (event) => {
        done({
          records: [...event.message.records].map(toRecord),
          tag: { uid: (event.serialNumber || '').replace(/:/g, '').toUpperCase() },
        });
      };
      // A tag that isn't NDEF (or couldn't be read)
      reader.onreadingerror = () => done({ records: [], tag: { uid: '' }, unreadable: true });
      reader.scan({ signal: c.signal }).catch((e) => reject(mapDomError(e)));
    });
  },

  /** Write records to the next tag. Web NFC writes NDEF only. */
  async write(records) {
    abortActive();
    const c = new AbortController();
    controller = c;
    const reader = new globalThis.NDEFReader();
    const message = {
      records: records.map((r) => {
        if (r.tnf !== TNF.MIME) throw error('UNSUPPORTED', 'Only MIME records can be written from the browser.');
        return { recordType: 'mime', mediaType: r.type, data: r.payload };
      }),
    };
    try {
      await reader.write(message, { signal: c.signal, overwrite: true });
      return { tag: { uid: '' }, verified: false };
    } catch (e) {
      throw mapDomError(e);
    } finally {
      if (controller === c) controller = null;
    }
  },

  async cancel() {
    abortActive();
  },

  async openSettings() {},
};
