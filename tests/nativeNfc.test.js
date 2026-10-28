import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodeMessage, mimeRecord } from '../src/lib/ndef.js';

// A fake FilaScribeNfc plugin standing in for the Android code
const plugin = {
  isAvailable: vi.fn(),
  read: vi.fn(),
  writeNdef: vi.fn(),
  cancel: vi.fn(),
  openSettings: vi.fn(),
  addListener: vi.fn(),
};
vi.mock('@capacitor/core', () => ({
  registerPlugin: (name) => {
    expect(name).toBe('FilaScribeNfc');
    return plugin;
  },
  Capacitor: { isNativePlatform: () => true },
}));

const { nativeNfc, toBase64, fromBase64 } = await import('../src/lib/nfc/native.js');
const { getNfc } = await import('../src/lib/nfc/index.js');

const json = new TextEncoder().encode('{"protocol":"openspool","type":"PLA","color_hex":"FFFFFF"}');
const message = encodeMessage([mimeRecord('application/json', json)]);

beforeEach(() => vi.clearAllMocks());

describe('native NFC (app)', () => {
  it('is used inside the app', () => {
    expect(getNfc()).toBe(nativeNfc);
  });

  it('base64 round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
    expect(fromBase64('')).toHaveLength(0);
  });

  it('reports NFC missing, off, and on', async () => {
    plugin.isAvailable.mockResolvedValueOnce({ available: false, enabled: false });
    expect(await nativeNfc.status()).toMatchObject({ available: false });
    plugin.isAvailable.mockResolvedValueOnce({ available: true, enabled: false });
    expect(await nativeNfc.status()).toMatchObject({ available: true, enabled: false, reason: 'NFC is turned off.' });
    plugin.isAvailable.mockResolvedValueOnce({ available: true, enabled: true });
    expect(await nativeNfc.status()).toEqual({ available: true, enabled: true });
  });

  it('decodes a read: records, chip, size and raw pages', async () => {
    const pages = new Uint8Array(135 * 4).fill(0xab);
    plugin.read.mockResolvedValueOnce({
      uid: '04A1B2C3D4E580', chip: 'NTAG215', techs: ['NfcA', 'MifareUltralight', 'Ndef'],
      maxNdefSize: 492, writable: true, ndef: toBase64(message), pages: toBase64(pages),
    });
    const r = await nativeNfc.read();
    expect(r.records).toHaveLength(1);
    expect(r.records[0].type).toBe('application/json');
    expect(new TextDecoder().decode(r.records[0].payload)).toContain('openspool');
    expect(r.tag).toMatchObject({ uid: '04A1B2C3D4E580', chip: 'NTAG215', maxNdefSize: 492, writable: true });
    expect(r.tag.pages).toHaveLength(540);
  });

  it('reads a blank tag as no records', async () => {
    plugin.read.mockResolvedValueOnce({ uid: '04', writable: true });
    const r = await nativeNfc.read();
    expect(r.records).toEqual([]);
    expect(r.tag.maxNdefSize).toBeNull();
    expect(r.tag.pages).toBeNull();
  });

  it('writes the message and checks the read-back', async () => {
    plugin.writeNdef.mockImplementationOnce(async ({ message: m }) => ({ uid: '04', ndef: m }));
    const ok = await nativeNfc.write(message);
    expect(plugin.writeNdef).toHaveBeenCalledWith({ message: toBase64(message), expectedUid: '' });
    expect(ok.verified).toBe(true);

    const other = encodeMessage([mimeRecord('application/json', new TextEncoder().encode('{}'))]);
    plugin.writeNdef.mockResolvedValueOnce({ uid: '04', ndef: toBase64(other) });
    expect((await nativeNfc.write(message)).verified).toBe(false);
  });

  it('passes the expected UID and reports a wrong tag', async () => {
    const remove = vi.fn();
    let listener;
    plugin.addListener.mockImplementationOnce(async (event, cb) => {
      expect(event).toBe('wrongTag');
      listener = cb;
      return { remove };
    });
    plugin.writeNdef.mockImplementationOnce(async ({ message: m }) => {
      listener({ uid: '04FFFF' }); // a different tag was tapped first
      return { uid: '04A1', ndef: m };
    });
    const onWrongTag = vi.fn();
    await nativeNfc.write(message, { expectedUid: '04A1', onWrongTag });
    expect(plugin.writeNdef.mock.calls[0][0].expectedUid).toBe('04A1');
    expect(onWrongTag).toHaveBeenCalledWith('04FFFF');
    expect(remove).toHaveBeenCalled(); // listener cleaned up
  });

  it('keeps the plugin’s error codes', async () => {
    plugin.writeNdef.mockRejectedValueOnce(Object.assign(new Error('This tag is locked (read-only).'), { code: 'READ_ONLY' }));
    await expect(nativeNfc.write(message)).rejects.toMatchObject({ code: 'READ_ONLY', message: 'This tag is locked (read-only).' });
    plugin.read.mockRejectedValueOnce(Object.assign(new Error('Cancelled.'), { code: 'CANCELLED' }));
    await expect(nativeNfc.read()).rejects.toMatchObject({ code: 'CANCELLED' });
    plugin.read.mockRejectedValueOnce(new Error('boom'));
    await expect(nativeNfc.read()).rejects.toMatchObject({ code: 'FAILED' });
  });

  it('cancel and settings never throw', async () => {
    plugin.cancel.mockRejectedValueOnce(new Error('nothing to cancel'));
    await expect(nativeNfc.cancel()).resolves.toBeUndefined();
    plugin.openSettings.mockRejectedValueOnce(new Error('no settings'));
    await expect(nativeNfc.openSettings()).resolves.toBeUndefined();
  });
});
