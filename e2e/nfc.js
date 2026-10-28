// Test helpers: a simulated Web NFC tag and common page steps.
//
// The fake NDEFReader keeps one tag in window.__tag ({ records } or null).
// scan() fires a reading for it; write() replaces its records. Tests can
// queue a failure (window.__nextError = 'NetworkError' etc.) and see every
// write in window.__writes.

import { test as base, expect } from '@playwright/test';

function installFakeNfc() {
  window.__tag = null;
  window.__writes = [];
  window.__nextError = null;
  window.__tapDelay = 60;

  const fail = () => {
    const name = window.__nextError;
    window.__nextError = null;
    return name ? new DOMException(`simulated ${name}`, name) : null;
  };
  const wait = (signal) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, window.__tapDelay);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
  });

  window.NDEFReader = class {
    async scan({ signal } = {}) {
      const err = fail();
      if (err) throw err;
      wait(signal).then(() => {
        const tag = window.__tag;
        if (!tag) return; // no tag near the phone: keep waiting
        if (tag.unreadable) { this.onreadingerror?.(new Event('readingerror')); return; }
        this.onreading?.({
          serialNumber: tag.serial || '04:a1:b2:c3:d4:e5:80',
          message: {
            records: tag.records.map((r) => {
              const bytes = typeof r.data === 'string' ? new TextEncoder().encode(r.data) : r.data;
              return { recordType: r.recordType || 'mime', mediaType: r.mediaType || 'application/json', data: new DataView(bytes.buffer) };
            }),
          },
        });
      }, () => {});
    }

    async write(message, { signal } = {}) {
      await wait(signal);
      const err = fail();
      if (err) throw err;
      const records = message.records.map((r) => ({
        recordType: r.recordType,
        mediaType: r.mediaType,
        data: new TextDecoder().decode(r.data),
      }));
      window.__writes.push(records);
      window.__tag = { records };
    }
  };
}

export const test = base.extend({
  // Every test gets a page with the simulated tag, a clean localStorage,
  // and a check that nothing logged an error.
  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
    page.on('dialog', (d) => d.accept()); // confirm() prompts: say yes
    await page.addInitScript(installFakeNfc);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await use(page);
    expect(problems, 'page errors').toEqual([]);
  },
});

export { expect };

/** Put an OpenSpool tag (object, raw JSON text, or records) near the phone. */
export async function placeTag(page, content, { serial } = {}) {
  await page.evaluate(({ content, serial }) => {
    if (content === null) window.__tag = null;
    else if (content === 'blank') window.__tag = { records: [], serial };
    else if (content === 'unreadable') window.__tag = { records: [], unreadable: true };
    else if (Array.isArray(content)) window.__tag = { records: content, serial };
    else window.__tag = { records: [{ data: typeof content === 'string' ? content : JSON.stringify(content) }], serial };
  }, { content, serial });
}

/** The JSON of the last write, or null. */
export async function lastWrite(page) {
  const writes = await page.evaluate(() => window.__writes);
  if (!writes.length) return null;
  const rec = writes[writes.length - 1][0];
  expect(rec.recordType).toBe('mime');
  expect(rec.mediaType).toBe('application/json');
  return JSON.parse(rec.data);
}

export const writeCount = (page) => page.evaluate(() => window.__writes.length);

/** Click a palette chip by its exact label. */
export const chip = (page, name) => page.getByRole('button', { name, exact: true });

export async function writeTag(page) {
  await page.getByRole('button', { name: 'Write tag' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

export const status = (page) => page.locator('.status');

/** A temperature pair: temps(page, 'Nozzle').min */
export function temps(page, which) {
  const group = page.getByRole('group', { name: `${which} temperature, °C` });
  return { min: group.getByLabel('Min'), max: group.getByLabel('Max') };
}

/** Un-pick the picked saved color (a write picks it), showing the pickers again. */
export async function unpickSaved(page) {
  const panel = page.locator('.saved');
  const toggle = panel.getByRole('button', { name: 'Show' });
  if (await toggle.isVisible()) await toggle.click();
  await panel.getByRole('button', { pressed: true }).click();
  await expect(page.locator('#hex-input')).toBeVisible();
}

/** Gradient / Segments under Multi-color style (a brand may also have a "Gradient" variant). */
export const colorStyle = (page, name) =>
  page.getByRole('group', { name: 'Multi-color style' }).getByRole('button', { name, exact: true });
