// Exporting and importing JSON files (saved colors). On the web the file is
// downloaded; in the Android app it's copied, since the WebView can't save
// downloads.
import { Capacitor } from '@capacitor/core';

/** Save `data` as a .json file. Returns { ok, message }. */
export async function exportJson(data, filename) {
  const json = JSON.stringify(data, null, 2);
  if (Capacitor.isNativePlatform()) {
    try {
      await navigator.clipboard.writeText(json);
      return { ok: true, message: 'Copied. Paste it somewhere safe, or into a .json file.' };
    } catch {
      return { ok: false, message: 'Couldn’t copy it.' };
    }
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true, message: '' };
}

/** The JSON in a picked file, or throws. */
export async function readJsonFile(file) {
  return JSON.parse(await file.text());
}
