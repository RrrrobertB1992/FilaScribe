import { test, expect, colorTab, openCustom, placeTag, lastWrite, chip, writeTag } from './nfc.js';

// Closest brand colors: shown when the colors aren't a brand color.
// Uses the bundled snapshot: Bambu Lab PLA Basic has Blue 0A2989, Black 000000.
const strip = (page) => page.getByRole('group', { name: 'Closest brand colors' });

async function bambuBasic(page) {
  await chip(page, 'Bambu Lab').click();
  await chip(page, 'Basic').click();
  await openCustom(page);
}
const setHex = (page, hex) => page.locator('#hex-input').fill(hex);

test.describe('Closest brand colors', () => {
  test('a custom color gets the nearest brand colors, nearest first', async ({ page }) => {
    await bambuBasic(page);
    await setHex(page, '0A2A8C');
    await expect(strip(page)).toContainText('Closest Bambu Lab PLA colors');
    const first = strip(page).getByRole('button').first();
    await expect(first).toContainText('Blue');
    await expect(first).toContainText('Very close');
    expect(await strip(page).getByRole('button').count()).toBeLessThanOrEqual(3);
  });

  test('tap one to use it, then go back to the custom color', async ({ page }) => {
    await bambuBasic(page);
    await setHex(page, '0A2A8C');
    await strip(page).getByRole('button', { name: /^Use Blue,/ }).click();
    await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.colorsec .now-name')).toHaveText('Blue');
    await expect(page.locator('.colorsec .back')).toContainText('Was your color #0A2A8C');
    await expect(strip(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Back to my color' }).click();
    await expect(page.locator('.colorsec .back')).toHaveCount(0);
    await openCustom(page);
    await expect(page.locator('#hex-input')).toHaveValue('0A2A8C');
    await expect(strip(page)).toBeVisible();
  });

  test('the picked brand color is what gets written', async ({ page }) => {
    await bambuBasic(page);
    await setHex(page, '0A2A8C');
    await strip(page).getByRole('button', { name: /^Use Blue,/ }).click();
    await writeTag(page);
    expect((await lastWrite(page)).color_hex).toBe('0A2989');
  });

  test('no strip for a brand color, or without a brand in the database', async ({ page }) => {
    await bambuBasic(page);
    await setHex(page, '0A2989');
    await expect(strip(page)).toHaveCount(0);
    await chip(page, 'Generic').click();
    await openCustom(page);
    await setHex(page, '0A2A8C');
    await expect(strip(page)).toHaveCount(0);
  });

  test('a color nothing is close to says so', async ({ page }) => {
    await bambuBasic(page);
    await setHex(page, 'FF00FF');
    await expect(page.getByText('No Bambu Lab PLA color is close to this one.')).toBeVisible();
    await expect(strip(page)).toHaveCount(0);
  });

  test('Settings: choose how many, or Off', async ({ page }) => {
    await page.getByRole('tab', { name: 'Settings' }).click();
    const card = page.locator('details.card', { has: page.getByRole('heading', { name: 'Closest brand colors' }) });
    await expect(card).not.toHaveAttribute('open', '');
    await card.locator('summary').click();
    await card.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await bambuBasic(page);
    await setHex(page, '0A2A8C');
    await expect(strip(page).getByRole('button')).toHaveCount(1);

    await page.getByRole('tab', { name: 'Settings' }).click();
    await card.getByRole('button', { name: 'Off', exact: true }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(strip(page)).toHaveCount(0);
    await expect(page.getByText(/color is close to this one/)).toHaveCount(0);
  });
});

// Read & update: the same suggestions, inside Quick edits instead of the Colors card
const TAG = { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Bambu Lab', subtype: 'Basic', color_hex: '0A2A8C', min_temp: '190', max_temp: '220' };
const quick = (page) => page.getByRole('region', { name: 'Quick edits' });
const quickChanges = (page) => quick(page).getByRole('list', { name: 'Changes' });

async function readTag(page, tag = TAG) {
  await page.getByRole('tab', { name: 'Read & update' }).click();
  await placeTag(page, tag);
  await page.getByRole('button', { name: /^Read (tag|another)$/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test.describe('Closest brand colors in Quick edits', () => {
  test('a tag with a color that isn’t a brand color gets them in Quick edits, not in the Colors card', async ({ page }) => {
    await readTag(page);
    const tiles = quick(page).getByRole('group', { name: 'Closest brand colors' });
    await expect(tiles).toContainText('Closest Bambu Lab PLA Basic colors');
    await expect(tiles).toContainText('Your color is #0A2A8C');
    await expect(tiles.getByRole('button', { name: /^Use Blue, PLA Basic, Very close/ })).toBeVisible();
    await expect(page.locator('.colorsec .suggest')).toHaveCount(0);
  });

  test('tap one: it is the color, the Brand tab opens, and the change is listed', async ({ page }) => {
    await readTag(page);
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await page.locator('details[data-fold="read-colors"] > summary').click(); // the Colors card starts shut here
    await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.colorsec .now-name')).toHaveText('Blue');
    await expect(quickChanges(page)).toContainText('Color');
    await expect(quickChanges(page)).toContainText('Blue #0A2989');
    await expect(quickChanges(page)).toContainText('was #0A2A8C');
    await expect(quick(page).getByText('Was your color #0A2A8C')).toBeVisible();
    await expect(quick(page).getByRole('group', { name: 'Closest brand colors' })).toHaveCount(0);
  });

  test('Back to my color puts it back and the color leaves the list', async ({ page }) => {
    await readTag(page);
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await quick(page).getByRole('button', { name: 'Back to my color' }).click();
    await expect(quick(page).getByRole('group', { name: 'Closest brand colors' })).toBeVisible();
    await expect(quick(page).getByRole('list', { name: 'Changes' })).toHaveCount(0);
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#0A2A8C');
  });

  test('Undo changes brings the color back too, with the weight and temperatures', async ({ page }) => {
    await readTag(page);
    await quick(page).getByRole('button', { name: 'Nozzle max plus 5', exact: true }).click();
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await quick(page).getByRole('button', { name: 'Undo changes' }).click();
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#0A2A8C');
    await expect(quick(page).getByLabel('Nozzle max', { exact: true })).toHaveValue('220');
    await expect(quick(page).getByRole('list', { name: 'Changes' })).toHaveCount(0);
    await expect(quick(page).getByRole('group', { name: 'Closest brand colors' })).toBeVisible();
  });

  test('Update tag writes the picked brand color, and the old one if you went back', async ({ page }) => {
    await readTag(page);
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect((await lastWrite(page)).color_hex).toBe('0A2989');

    await readTag(page);
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await quick(page).getByRole('button', { name: 'Back to my color' }).click();
    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect((await lastWrite(page)).color_hex).toBe('0A2A8C');
  });

  test('no tiles for a brand color, and none when the setting is Off', async ({ page }) => {
    await readTag(page, { ...TAG, color_hex: '0A2989' });
    await expect(quick(page)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Closest brand colors' })).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('filascribe-closest-colors', '0'));
    await page.reload();
    await readTag(page);
    await expect(quick(page)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Closest brand colors' })).toHaveCount(0);
  });

  test('a color nothing is close to says so in Quick edits', async ({ page }) => {
    await readTag(page, { ...TAG, color_hex: 'FF00FF' });
    await expect(quick(page).getByText('No Bambu Lab PLA Basic color is close to this one.')).toBeVisible();
  });
});
