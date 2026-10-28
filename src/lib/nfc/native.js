// Android app: talks to FilaScribeNfcPlugin (android/app/src/main/java/.../FilaScribeNfcPlugin.java).

import { registerPlugin } from '@capacitor/core';
import { decodeMessage } from '../ndef.js';

const Plugin = registerPlugin('FilaScribeNfc');

export function fromBase64(s) {
  if (!s) return new Uint8Array(0);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function wrap(e) {
  const err = new Error((e && e.message) || String(e));
  err.code = (e && e.code) || 'FAILED';
  return err;
}

function tagInfo(r) {
  return {
    uid: r.uid || '',
    chip: r.chip || '',
    techs: r.techs || [],
    maxNdefSize: typeof r.maxNdefSize === 'number' ? r.maxNdefSize : null,
    writable: r.writable !== false,
    pages: r.pages ? fromBase64(r.pages) : null,
  };
}

export const nativeNfc = {
  kind: 'native',

  async status() {
    try {
      const s = await Plugin.isAvailable();
      if (!s.available) return { available: false, reason: 'This phone doesn’t have NFC.' };
      if (!s.enabled) return { available: true, enabled: false, reason: 'NFC is turned off.' };
      return { available: true, enabled: true };
    } catch (e) {
      return { available: false, reason: wrap(e).message };
    }
  },

  async read() {
    try {
      const r = await Plugin.read();
      const ndef = fromBase64(r.ndef);
      return { records: ndef.length ? decodeMessage(ndef) : [], tag: tagInfo(r) };
    } catch (e) {
      throw wrap(e);
    }
  },

  /**
   * Write a whole NDEF message (bytes from encodeMessage). With expectedUid,
   * the plugin refuses a different tag. The plugin reads the message back,
   * so `verified` says whether the tag now holds exactly these bytes.
   */
  async write(message, { expectedUid, onWrongTag } = {}) {
    const listener = expectedUid && onWrongTag
      ? await Plugin.addListener('wrongTag', (e) => onWrongTag(e.uid))
      : null;
    try {
      const r = await Plugin.writeNdef({ message: toBase64(message), expectedUid: expectedUid || '' });
      const back = fromBase64(r.ndef);
      const verified = back.length === message.length && back.every((b, i) => b === message[i]);
      return { tag: tagInfo(r), verified };
    } catch (e) {
      throw wrap(e);
    } finally {
      if (listener) listener.remove();
    }
  },

  async cancel() {
    try { await Plugin.cancel(); } catch { /* nothing to cancel */ }
  },

  async openSettings() {
    try { await Plugin.openSettings(); } catch { /* not critical */ }
  },
};
