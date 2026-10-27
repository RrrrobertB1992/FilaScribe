// One NFC interface for both builds:
//  - web: Web NFC (Chrome on Android), NDEF only
//  - native: the app's own Android plugin (reader mode), which also gives
//    the tag's chip type, capacity and raw pages
//
// Both return records as { tnf, type, payload: Uint8Array } and tag info as
// { uid, chip, maxNdefSize, writable, pages }.

import { Capacitor } from '@capacitor/core';
import { webNfc } from './web.js';
import { nativeNfc } from './native.js';

// Errors carry a short `code`: CANCELLED, NO_NFC, NFC_DISABLED, NOT_ALLOWED,
// TAG_LOST, WRONG_TAG, READ_ONLY, TOO_BIG, NOT_NDEF, BUSY, UNSUPPORTED, FAILED.
export function getNfc() {
  return Capacitor.isNativePlatform() ? nativeNfc : webNfc;
}
