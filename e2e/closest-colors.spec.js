import { test, expect, colorTab, openCustom, lastWrite, chip, writeTag, settingsCard, openSettingsGroup, readFrom } from './nfc.js';

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
    await openSettingsGroup(page, 'Brand colors');
    const card = page.locator('details.card', { has: page.getByRole('heading', { name: 'Closest brand colors' }) });
    await expect(card).not.toHaveAttribute('open', '');
    await card.locator('summary').click();
    await card.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await bambuBasic(page);
    await setHex(page, '0A2A8C');
    await expect(strip(page).getByRole('button')).toHaveCount(1);

    await (await settingsCard(page, 'Closest brand colors')).getByRole('button', { name: 'Off', exact: true }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(strip(page)).toHaveCount(0);
    await expect(page.getByText(/color is close to this one/)).toHaveCount(0);
  });

  test('Settings: How close changes which colors are suggested', async ({ page }) => {
    // Anycubic PLA Basic: 2A5C94 is a steel blue 12.8 from Blue 003594 (Strict and Normal say no,
    // Loose says yes) and 14.3 from Purple, which the color family check keeps out
    await page.evaluate(() => localStorage.setItem('filascribe-defaults', JSON.stringify({ profile: 'u1', brand: 'Anycubic', type: 'PLA', subtype: 'Basic' })));
    await page.reload();
    await openSettingsGroup(page, 'Brand colors');
    const card = page.locator('details.card', { has: page.getByRole('heading', { name: 'Closest brand colors' }) });
    await card.locator('summary').click();
    await expect(card.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');

    const tryColor = async (level) => {
      await page.getByRole('tab', { name: 'Settings' }).click();
      await openSettingsGroup(page, 'Brand colors');
      await (await settingsCard(page, 'Closest brand colors')).getByRole('button', { name: level, exact: true }).click();
      await page.getByRole('tab', { name: 'Create' }).click();
      await openCustom(page);
      await setHex(page, '2A5C94');
    };
    const none = page.getByText('No Anycubic PLA color is close to this one.');
    await tryColor('Normal');
    await expect(none).toBeVisible();
    await tryColor('Strict');
    await expect(none).toBeVisible();
    await tryColor('Loose');
    await expect(strip(page).getByRole('button')).toHaveCount(1);
    await expect(strip(page).getByRole('button').first()).toContainText('Blue');

    await page.reload();
    await openSettingsGroup(page, 'Brand colors');
    await expect((await settingsCard(page, 'Closest brand colors')).getByRole('button', { name: 'Loose', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});

// Read & update: the same suggestions, inside Quick edits instead of the Colors card
const TAG = { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Bambu Lab', subtype: 'Basic', color_hex: '0A2A8C', min_temp: '190', max_temp: '220' };
const quick = (page) => page.getByRole('region', { name: 'Quick edits' });
const quickChanges = (page) => quick(page).getByRole('list', { name: 'Changes' });

test.describe('Closest brand colors in Quick edits', () => {
  test('a tag with a color that isn’t a brand color gets them in Quick edits, not in the Colors card', async ({ page }) => {
    await readFrom(page, TAG);
    const tiles = quick(page).getByRole('group', { name: 'Closest brand colors' });
    await expect(tiles).toContainText('Closest Bambu Lab PLA Basic colors');
    await expect(tiles).toContainText('Your color is #0A2A8C');
    await expect(tiles.getByRole('button', { name: /^Use Blue, PLA Basic, Very close/ })).toBeVisible();
    await expect(page.locator('.colorsec .suggest')).toHaveCount(0);
  });

  test('tap one: it is the color, the Brand tab opens, and the change is listed', async ({ page }) => {
    await readFrom(page, TAG);
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
    await readFrom(page, TAG);
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await quick(page).getByRole('button', { name: 'Back to my color' }).click();
    await expect(quick(page).getByRole('group', { name: 'Closest brand colors' })).toBeVisible();
    await expect(quick(page).getByRole('list', { name: 'Changes' })).toHaveCount(0);
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#0A2A8C');
  });

  test('Undo changes brings the color back too, with the weight and temperatures', async ({ page }) => {
    await readFrom(page, TAG);
    await quick(page).getByRole('button', { name: 'Nozzle max plus 5', exact: true }).click();
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await quick(page).getByRole('button', { name: 'Undo changes' }).click();
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#0A2A8C');
    await expect(quick(page).getByLabel('Nozzle max', { exact: true })).toHaveValue('220');
    await expect(quick(page).getByRole('list', { name: 'Changes' })).toHaveCount(0);
    await expect(quick(page).getByRole('group', { name: 'Closest brand colors' })).toBeVisible();
  });

  test('Update tag writes the picked brand color, and the old one if you went back', async ({ page }) => {
    await readFrom(page, TAG);
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect((await lastWrite(page)).color_hex).toBe('0A2989');

    await readFrom(page, TAG);
    await quick(page).getByRole('button', { name: /^Use Blue, PLA Basic/ }).click();
    await quick(page).getByRole('button', { name: 'Back to my color' }).click();
    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect((await lastWrite(page)).color_hex).toBe('0A2A8C');
  });

  test('no tiles for a brand color, and none when the setting is Off', async ({ page }) => {
    await readFrom(page, { ...TAG, color_hex: '0A2989' });
    await expect(quick(page)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Closest brand colors' })).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('filascribe-closest-colors', '0'));
    await page.reload();
    await readFrom(page, TAG);
    await expect(quick(page)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Closest brand colors' })).toHaveCount(0);
  });

  test('a color nothing is close to says so in Quick edits', async ({ page }) => {
    await readFrom(page, { ...TAG, color_hex: 'FF00FF' });
    await expect(quick(page).getByText('No Bambu Lab PLA Basic color is close to this one.')).toBeVisible();
  });
});

test.describe('Closest brand colors: placement', () => {
  test('the strip sits under the picker, so the picker never moves', async ({ page }) => {
    await bambuBasic(page);
    await setHex(page, '808080');
    await expect(strip(page)).toBeVisible();
    const hex = page.locator('#hex-input');
    const before = (await hex.boundingBox()).y;
    const stripTop = (await strip(page).boundingBox()).y;
    expect(stripTop).toBeGreaterThan(before);
    // Go to a brand color (strip disappears) and back to a far-off one (strip appears).
    await setHex(page, '000000');
    await expect(strip(page)).toHaveCount(0);
    expect((await hex.boundingBox()).y).toBe(before);
    await setHex(page, '808080');
    await expect(strip(page)).toBeVisible();
    expect((await hex.boundingBox()).y).toBe(before);
  });
});
