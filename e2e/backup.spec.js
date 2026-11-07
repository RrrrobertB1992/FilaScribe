import { test, expect, status } from './nfc.js';

const spool = (colors, colorName) => ({
  profile: 'u1', brand: 'Polymaker', type: 'PLA', subtype: 'Matte', minTemp: '190', maxTemp: '220',
  bedMinTemp: '50', bedMaxTemp: '60', colors, colorName,
});

// What this device has: two spools, one saved color, a chip, and a few settings
const HERE = {
  'filascribe-filaments': JSON.stringify([spool(['2B2B2D'], 'Galaxy Black'), spool(['FF0000'], 'Red')]),
  'filascribe-saved-colors': JSON.stringify({ 'Generic|PETG': [{ colors: ['ABCDEF'], name: 'Sky', variants: ['Basic'] }] }),
  'filascribe-custom-chips': JSON.stringify({ brands: [], materials: [], variants: { 'Generic|PLA': ['Rapid'] } }),
  'filascribe-closest-colors': '5',
};

// A backup made on another phone: one spool you have, one you don't, other settings
const THERE = {
  app: 'FilaScribe backup',
  version: 1,
  made: '2026-11-06T12:00:00.000Z',
  data: {
    filaments: [spool(['2B2B2D'], 'Galaxy Black'), spool(['00FF00'], 'Green')],
    autoFilaments: true,
    savedColors: { 'Generic|PLA': [{ colors: ['112233'], name: 'Navy', variants: ['Basic'] }] },
    colorOverrides: [],
    customChips: { brands: [], materials: [], variants: {} },
    brands: ['Polymaker'],
    materials: ['PLA', 'PETG'],
    hiddenVariants: [],
    defaults: {},
    closestColors: 1,
    theme: 'dark',
  },
};

async function start(page, stored = HERE) {
  await page.evaluate((s) => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)), stored);
  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();
  const c = page.locator('details.card', { has: page.getByRole('heading', { name: 'Backup' }) });
  if (!(await c.evaluate((d) => d.open))) await c.locator('summary').click();
  return c;
}

const choose = async (page, card, body, name = 'backup.json') => {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    card.getByRole('button', { name: 'Restore backup' }).click(),
  ]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) });
};

const stored = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const row = (card, label) => card.locator('.backup-list li', { hasText: label });

test.describe('Backup', () => {
  test('a Backup card lists what a backup would hold', async ({ page }) => {
    const card = await start(page);
    await expect(row(card, 'My filaments')).toContainText('2');
    await expect(row(card, 'Saved colors')).toContainText('1');
    await expect(row(card, 'Color overrides')).toContainText('0');
    await expect(row(card, 'Your chips')).toContainText('1');
    await expect(card.getByRole('button', { name: 'Save backup' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Restore backup' })).toBeVisible();
  });

  test('Save backup downloads one file with everything in it', async ({ page }) => {
    const card = await start(page);
    const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Save backup' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^filascribe-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));
    expect(file).toMatchObject({ app: 'FilaScribe backup', version: 1 });
    expect(file.data.filaments).toHaveLength(2);
    expect(Object.keys(file.data.savedColors)).toEqual(['Generic|PETG']);
    expect(file.data.customChips.variants['Generic|PLA']).toEqual(['Rapid']);
    expect(file.data.closestColors).toBe(5);
    await expect(status(page)).toHaveText('Backup saved to your downloads.');
  });

  test('a backup saved here restores on a clean device', async ({ page }) => {
    const card = await start(page);
    const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Save backup' }).click()]);
    const saved = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
    await page.evaluate(() => localStorage.clear());
    const clean = await start(page, {});
    await expect(row(clean, 'My filaments')).toContainText('0');
    await choose(page, clean, saved);
    await clean.getByRole('button', { name: 'Add what’s new' }).click();
    await expect(row(clean, 'My filaments')).toContainText('2');
    await expect(row(clean, 'Saved colors')).toContainText('1');
    await expect(row(clean, 'Your chips')).toContainText('1');
    expect(await stored(page, 'filascribe-closest-colors')).toBe('5');
  });

  test('choosing a file shows what is in it and how much is new, and changes nothing yet', async ({ page }) => {
    const card = await start(page);
    await choose(page, card, THERE, 'phone-backup.json');
    await expect(card).toContainText('phone-backup.json');
    await expect(row(card, 'My filaments')).toHaveText(/2 \(1 new\)/);
    await expect(row(card, 'Saved colors')).toHaveText(/1 \(1 new\)/);
    await expect(row(card, 'Color overrides')).not.toContainText('new');
    await expect(row(card, 'Settings and theme')).toContainText('from the file');
    await expect(card.getByRole('button', { name: 'Add what’s new' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Replace everything' })).toBeVisible();
    expect(await stored(page, 'filascribe-closest-colors')).toBe('5');
    await card.getByRole('button', { name: 'Cancel' }).click();
    await expect(card.getByRole('button', { name: 'Save backup' })).toBeVisible();
    expect(JSON.parse(await stored(page, 'filascribe-filaments'))).toHaveLength(2);
  });

  test('Add what’s new keeps what you have, adds the rest and takes the settings from the file', async ({ page }) => {
    const card = await start(page);
    await choose(page, card, THERE);
    await card.getByRole('button', { name: 'Add what’s new' }).click();
    await expect(status(page)).toHaveText('Backup restored. Added 2 new items.');
    await expect(row(card, 'My filaments')).toContainText('3');
    await expect(row(card, 'Saved colors')).toContainText('2');
    await expect(row(card, 'Your chips')).toContainText('1');
    const names = (await stored(page, 'filascribe-filaments')).match(/"colorName":"([^"]*)"/g);
    expect(names).toHaveLength(3);
    // settings come from the file, and show straight away
    expect(await stored(page, 'filascribe-closest-colors')).toBe('1');
    expect(await stored(page, 'filascribe-theme')).toBe('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await stored(page, 'filascribe-filaments-auto')).toBe('1');
    expect(await stored(page, 'filascribe-materials')).toContain('PETG');
    await page.reload();
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(page.getByRole('button', { name: 'Write tag' })).toBeVisible();
  });

  test('restoring the same backup twice adds nothing the second time', async ({ page }) => {
    const card = await start(page);
    await choose(page, card, THERE);
    await card.getByRole('button', { name: 'Add what’s new' }).click();
    await choose(page, card, THERE);
    // the file holds 2 spools, and both are already here
    await expect(row(card, 'My filaments')).toHaveText(/My filaments\s*2$/);
    await card.getByRole('button', { name: 'Add what’s new' }).click();
    await expect(status(page)).toHaveText('Backup restored. Nothing was new.');
    await expect(row(card, 'My filaments')).toContainText('3');
  });

  test('Replace everything asks first, and Cancel on that pop-up changes nothing', async ({ page }) => {
    page.removeAllListeners('dialog');
    const card = await start(page);
    await choose(page, card, THERE);
    let message = '';
    page.once('dialog', (d) => { message = d.message(); d.dismiss(); });
    await card.getByRole('button', { name: 'Replace everything' }).click();
    await expect.poll(() => message).toContain('Replace everything on this device');
    expect(message).toContain('can’t be undone');
    // nothing changed, and the choice is still there
    expect(JSON.parse(await stored(page, 'filascribe-filaments'))).toHaveLength(2);
    expect(await stored(page, 'filascribe-closest-colors')).toBe('5');
    await expect(card.getByRole('button', { name: 'Replace everything' })).toBeVisible();
  });

  test('Replace everything, once confirmed, leaves exactly what the backup holds', async ({ page }) => {
    page.removeAllListeners('dialog');
    const card = await start(page);
    await choose(page, card, THERE);
    page.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'Replace everything' }).click();
    await expect(status(page)).toHaveText('Backup restored. Everything now matches it.');
    await expect(row(card, 'My filaments')).toContainText('2');
    await expect(row(card, 'Saved colors')).toContainText('1');
    await expect(row(card, 'Your chips')).toContainText('0');
    const filaments = JSON.parse(await stored(page, 'filascribe-filaments'));
    expect(filaments.map((f) => f.colorName).sort()).toEqual(['Galaxy Black', 'Green']);
    expect(JSON.parse(await stored(page, 'filascribe-saved-colors'))).not.toHaveProperty(['Generic|PETG']);
  });

  test('a file that is not a backup is refused and nothing changes', async ({ page }) => {
    const card = await start(page);
    await choose(page, card, { 'Generic|PETG': [{ colors: ['AABBCC'], name: '', variants: [''] }] });
    await expect(status(page)).toHaveText('That file isn’t a FilaScribe backup.');
    await choose(page, card, 'not json at all');
    await expect(status(page)).toHaveText('That file isn’t a FilaScribe backup.');
    await expect(card.getByRole('button', { name: 'Save backup' })).toBeVisible();
    expect(JSON.parse(await stored(page, 'filascribe-filaments'))).toHaveLength(2);
  });

  test('a backup from a newer version asks you to update', async ({ page }) => {
    const card = await start(page);
    await choose(page, card, { ...THERE, version: 2 });
    await expect(status(page)).toHaveText('That backup is from a newer version of FilaScribe. Update the app first.');
  });

  test('the one-card Export and Import buttons are still there', async ({ page }) => {
    await start(page);
    for (const [card, names] of [
      ['My filaments', ['Export My filaments', 'Import My filaments']],
      ['Saved colors', ['Export saved colors', 'Import saved colors']],
    ]) {
      const c = page.locator('details.card', { has: page.getByRole('heading', { name: card }) });
      if (!(await c.evaluate((d) => d.open))) await c.locator('summary').click();
      for (const name of names) await expect(c.getByRole('button', { name })).toBeVisible();
    }
  });
});
