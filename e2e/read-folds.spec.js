import { test, expect, placeTag } from './nfc.js';

// Read & update: only Quick edits is open after the first read; the other cards
// stay as the user leaves them, and Create keeps its own state
const TAG = { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Generic', color_hex: 'FF0000', min_temp: '190', max_temp: '220', weight: '1000' };
const OTHER = { ...TAG, type: 'PETG', brand: 'Polymaker', color_hex: '00AA00' };
const fold = (page, id) => page.locator(`[data-fold="${id}"]`);
const isOpen = (page, id) => fold(page, id).evaluate((d) => d.open);

async function read(page, tag = TAG) {
  await page.getByRole('tab', { name: 'Read & update' }).click();
  await placeTag(page, tag);
  await page.getByRole('button', { name: /^Read (tag|another)$/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test.describe('Read & update cards', () => {
  test('after the first read only Quick edits is open', async ({ page }) => {
    await read(page);
    await expect(fold(page, 'quick')).toHaveJSProperty('open', true);
    for (const id of ['read-filament', 'read-colors', 'read-temps', 'read-tagdata']) {
      await expect(fold(page, id)).toHaveJSProperty('open', false);
    }
  });

  test('a card opened afterwards stays open for the same tag and another one', async ({ page }) => {
    await read(page);
    await fold(page, 'read-colors').locator('summary').click();
    await fold(page, 'read-temps').locator('summary').click();
    await expect(fold(page, 'read-colors')).toHaveJSProperty('open', true);

    await read(page); // the same tag again
    await expect(fold(page, 'read-colors')).toHaveJSProperty('open', true);
    await expect(fold(page, 'read-temps')).toHaveJSProperty('open', true);
    await expect(fold(page, 'read-filament')).toHaveJSProperty('open', false);

    await read(page, OTHER); // a different tag
    await expect(fold(page, 'read-colors')).toHaveJSProperty('open', true);
    await expect(fold(page, 'read-temps')).toHaveJSProperty('open', true);
    await expect(fold(page, 'read-filament')).toHaveJSProperty('open', false);

    await page.reload();
    await read(page);
    await expect(fold(page, 'read-colors')).toHaveJSProperty('open', true);
  });

  test('Create keeps its own cards, whatever Read & update does', async ({ page }) => {
    await expect(fold(page, 'filament')).toHaveJSProperty('open', true);
    await expect(fold(page, 'colors')).toHaveJSProperty('open', true);
    await read(page);
    await fold(page, 'read-filament').locator('summary').click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(fold(page, 'filament')).toHaveJSProperty('open', true);
    await expect(fold(page, 'colors')).toHaveJSProperty('open', true);
    await fold(page, 'filament').locator('summary').click();
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await expect(fold(page, 'read-filament')).toHaveJSProperty('open', true);
  });

  test('a closed card says what is in it, and a problem opens it', async ({ page }) => {
    await read(page);
    await expect(fold(page, 'read-filament').locator('.sum')).toContainText('PLA');
    await expect(fold(page, 'read-temps')).toHaveJSProperty('open', false);
    // max below min is a mistake in the Temperatures card, so it opens by itself
    await page.getByRole('region', { name: 'Quick edits' }).getByLabel('Nozzle max', { exact: true }).fill('100');
    await expect(fold(page, 'read-temps')).toHaveJSProperty('open', true);
  });
});

test.describe('Quick edits card', () => {
  test('folds shut, shows what is in it, and is remembered', async ({ page }) => {
    await read(page);
    const card = page.getByRole('region', { name: 'Quick edits' });
    await expect(fold(page, 'quick')).toHaveJSProperty('open', true);
    await fold(page, 'quick').locator('summary').click();
    await expect(fold(page, 'quick')).toHaveJSProperty('open', false);
    await expect(fold(page, 'quick').locator('.sum')).toHaveText('1000 g · 190–220 °C');
    await expect(card.getByLabel('Weight', { exact: true })).toBeHidden();

    await read(page);
    await expect(fold(page, 'quick')).toHaveJSProperty('open', false);
    await page.reload();
    await read(page);
    await expect(fold(page, 'quick')).toHaveJSProperty('open', false);
    await fold(page, 'quick').locator('summary').click();
    await expect(card.getByLabel('Weight', { exact: true })).toBeVisible();
  });

  test('has space between it and the OpenSpool / U1 buttons', async ({ page }) => {
    await read(page);
    const quick = await page.getByRole('region', { name: 'Quick edits' }).boundingBox();
    const seg = await page.getByRole('group', { name: 'Fields' }).boundingBox();
    expect(seg.y - (quick.y + quick.height)).toBeGreaterThanOrEqual(8);
    await fold(page, 'quick').locator('summary').click();
    const shut = await page.getByRole('region', { name: 'Quick edits' }).boundingBox();
    expect(seg.y - (shut.y + shut.height)).toBeGreaterThanOrEqual(8);
  });
});
