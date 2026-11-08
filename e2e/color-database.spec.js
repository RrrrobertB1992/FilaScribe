import { readFileSync } from 'node:fs';
import { test, expect, status, settingsCard, typeOther, goCreate } from './nfc.js';

// Settings > Color database. The files the app downloads are served from here.
const snapshot = JSON.parse(readFileSync('src/data/brand-colors.json', 'utf8'));
const orca = JSON.parse(readFileSync('src/data/orca-vendors.json', 'utf8'));
const FILES = '**/raw.githubusercontent.com/RrrrobertB1992/FilaScribe/main/src/data/*.json';

function newer() {
  const next = JSON.parse(JSON.stringify(snapshot));
  next.source = { ...next.source, commit: 'f'.repeat(40), date: '2026-12-01' };
  Object.values(next.brands[0].materials)[0][0].colors.push(['Brand New Color', 'ABCDEF', '', '']);
  next.brands.push({ name: 'Zeta Filaments', keys: ['zeta'], materials: { PLA: [{ name: 'Zeta PLA', temps: [190, 220, 0, 50], traits: '', colors: [['Red', 'FF0000', '', '']] }] } });
  return next;
}

// Serve the database files (or fail them)
async function serve(page, { colors = snapshot, vendors = orca } = {}) {
  await page.route(FILES, (route) => {
    const body = route.request().url().endsWith('brand-colors.json') ? colors : vendors;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
}

const openCard = (page) => settingsCard(page, 'Color database');

const brandCount = snapshot.brands.length;
let colorCount = 0;
for (const b of snapshot.brands) for (const lines of Object.values(b.materials)) for (const l of lines) colorCount += l.colors.length;

test.describe('Color database', () => {
  test('shows the date, brands and colors of the database in use', async ({ page }) => {
    const c = await openCard(page);
    await expect(c).toContainText(brandCount.toLocaleString());
    await expect(c).toContainText(colorCount.toLocaleString());
    await expect(c.getByText('Database date')).toBeVisible();
    await expect(c).toContainText(snapshot.source.date);
    await expect(c).toContainText('Built into the app');
    await expect(c).toContainText('Never');
    await expect(c.getByRole('button', { name: 'Go back to the built-in copy' })).toHaveCount(0);
    await expect(c.getByText(/days old/)).toHaveCount(0);
  });

  test('says when you already have the newest database, and remembers the check', async ({ page }) => {
    await serve(page);
    const c = await openCard(page);
    await c.getByRole('button', { name: 'Check for updates' }).click();
    await expect(c.getByText('You have the newest database.')).toBeVisible();
    await expect(c.getByText('Never', { exact: true })).toHaveCount(0);
  });

  test('finds a newer database, lists the changes and updates', async ({ page }) => {
    await serve(page, { colors: newer() });
    const c = await openCard(page);
    await c.getByRole('button', { name: 'Check for updates' }).click();
    await expect(c.getByText('Newer database available')).toBeVisible();
    await expect(c).toContainText('2026-12-01: 1 new brand, 2 new colors');

    await c.getByRole('button', { name: 'See changes' }).click();
    await expect(c).toContainText('New brands: Zeta Filaments');
    await expect(c.locator('details.change', { hasText: 'Zeta Filaments' })).toBeVisible();
    await c.getByRole('button', { name: 'Hide changes' }).click();

    await c.getByRole('button', { name: 'Update now' }).click();
    await expect(status(page)).toHaveText('Brand colors updated to 2026-12-01.');
    await expect(c).toContainText('Downloaded copy');
    await expect(c).toContainText('2026-12-01');
    await expect(c).toContainText((colorCount + 2).toLocaleString());

    // It is still used after a reload, until you go back
    await page.reload();
    const again = await openCard(page);
    await expect(again).toContainText('Downloaded copy');
    await again.getByRole('button', { name: 'Go back to the built-in copy' }).click();
    await expect(status(page)).toHaveText('Using the brand colors built into the app.');
    await expect(again).toContainText('Built into the app');
    await expect(again).toContainText(colorCount.toLocaleString());
    await page.reload();
    await expect(await openCard(page)).toContainText('Built into the app');
  });

  test('the new brands show up on Create after an update', async ({ page }) => {
    await serve(page, { colors: newer() });
    const c = await openCard(page);
    await c.getByRole('button', { name: 'Check for updates' }).click();
    await c.getByRole('button', { name: 'Update now' }).click();
    await expect(status(page)).toHaveText('Brand colors updated to 2026-12-01.');
    await goCreate(page);
    await typeOther(page, 'brand', 'Zeta');
    await expect(page.getByRole('group', { name: 'Suggestions' }).getByRole('button', { name: 'Zeta Filaments' })).toBeVisible();
  });

  test('going back keeps your color overrides and saved colors', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('filascribe-color-overrides', JSON.stringify([{ brand: 'Bambu Lab', material: 'PLA', line: 'PLA Basic', color: 'Black', hex: '111111', was: '000000' }]));
    });
    await page.reload();
    await serve(page, { colors: newer() });
    const c = await openCard(page);
    await c.getByRole('button', { name: 'Check for updates' }).click();
    await c.getByRole('button', { name: 'Update now' }).click();
    await expect(status(page)).toHaveText('Brand colors updated to 2026-12-01.');
    const stored = await page.evaluate(() => localStorage.getItem('filascribe-color-overrides'));
    expect(JSON.parse(stored)).toHaveLength(1);
    await expect(page.locator('details.card', { has: page.getByRole('heading', { name: 'Color overrides' }) })).toContainText('Bambu Lab · PLA · PLA Basic · Black');
  });

  test('explains a failed check and changes nothing', async ({ page }) => {
    // No request is made at all, so the page logs no network error
    await page.evaluate(() => {
      const real = window.fetch;
      window.fetch = (url, init) => (String(url).includes('raw.githubusercontent.com') ? Promise.reject(new TypeError('Failed to fetch')) : real(url, init));
    });
    const c = await openCard(page);
    await c.getByRole('button', { name: 'Check for updates' }).click();
    await expect(c.getByRole('alert')).toContainText('Couldn’t reach the update');
    await expect(c).toContainText('Built into the app');
    await expect(c.getByText('Never', { exact: true })).toBeVisible();
  });

  test('refuses a file that is not a database', async ({ page }) => {
    await serve(page, { colors: { brands: [] } });
    const c = await openCard(page);
    await c.getByRole('button', { name: 'Check for updates' }).click();
    await expect(c.getByRole('alert')).toContainText('didn’t look right');
    await expect(c).toContainText('Built into the app');
  });

  test('warns when the database is more than 35 days old', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z')); // 49 days after the bundled date
    await page.goto('/');
    // the warning also shows on the menu row, so it isn't hidden behind a tap
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByRole('button', { name: /^Brand colors/ })).toContainText('Out of date');
    const c = await openCard(page);
    await expect(c.getByRole('alert')).toContainText('over 35 days old');
    await expect(page.locator('summary', { hasText: 'Color database' })).toContainText('Out of date');
  });
});
