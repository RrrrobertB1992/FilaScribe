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
    await expect(page.locator('.colorsec .back')).toContainText('Was your custom color #0A2A8C');
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

  test('a tag read with a color that isn’t in the database gets suggestions', async ({ page }) => {
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Bambu Lab', color_hex: '0A2A8C' });
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await page.getByRole('button', { name: /^Read tag/ }).click();
    await expect(strip(page).getByRole('button', { name: /^Use Blue, PLA Basic/ })).toBeVisible();
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
