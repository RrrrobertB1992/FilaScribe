import { test, expect, placeTag, lastWrite, chip, writeTag, temps } from './nfc.js';

// Uses the bundled Open Filament Database snapshot (src/data/brand-colors.json)
const brand = (page) => page.locator('.brand');
const tile = (page, name) => brand(page).locator('.tile', { hasText: name }).first();

async function open(page, brandName, variant) {
  await chip(page, brandName).click();
  if (variant !== undefined) await chip(page, variant).click();
  await brand(page).getByRole('button', { name: 'Show' }).click();
}

test.describe('Brand colors', () => {
  test('not shown for Generic', async ({ page }) => {
    await expect(chip(page, 'Generic')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.saved')).toBeVisible();
    await expect(brand(page)).toHaveCount(0);
  });

  test('shows the variant’s group', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await expect(brand(page)).toContainText('Brand colors for Bambu Lab PLA Basic');
    await expect(brand(page)).toContainText(/Showing Basic: \d+ colors from \d+ lines/);
    await expect(tile(page, 'Jade White')).toBeVisible();
    // grouped views list colors, not line chips
    await expect(brand(page).getByRole('group', { name: 'Filament lines' })).toHaveCount(0);

    await chip(page, 'Galaxy').click();
    await expect(brand(page)).toContainText('Brand colors for Bambu Lab PLA Galaxy');
    await expect(brand(page)).toContainText(/Showing Galaxy: \d+ colors from 2 lines/); // PLA Galaxy + PLA Sparkle
  });

  test('no variant shows Basic', async ({ page }) => {
    await open(page, 'Bambu Lab', 'None');
    await expect(brand(page)).toContainText('Showing Basic (no variant)');
    await expect(tile(page, 'Jade White')).toBeVisible();
  });

  test('similar lines are merged into one group, look-alike colors shown once', async ({ page }) => {
    await open(page, 'SUNLU', 'Wood');
    await expect(brand(page)).toContainText('Showing Wood: 6 colors from 2 lines'); // PLA Wood + Real Wood Fiber PLA
    await expect(brand(page).locator('.tile')).toHaveCount(6);
    await expect(brand(page).locator('.line-name', { hasText: '+1' })).toHaveCount(1);
    // Show all lists every original line, nothing merged
    await brand(page).getByRole('button', { name: 'Show all SUNLU PLA lines' }).click();
    await expect(brand(page)).toContainText('Showing every line');
    await expect(brand(page).getByRole('button', { name: 'Real Wood Fiber PLA', exact: true })).toBeVisible();
  });

  test('when a group is empty, Show all lists every line', async ({ page }) => {
    await open(page, 'Polymaker', 'Marble');
    await expect(brand(page)).toContainText('Polymaker PLA has no Marble colors.');
    await brand(page).getByRole('button', { name: 'Show all Polymaker PLA lines' }).click();
    await expect(brand(page)).toContainText('Showing every line');
    await expect(brand(page).getByRole('button', { name: 'Polylite PLA', exact: true })).toBeVisible();
    await brand(page).getByRole('button', { name: 'Show only Marble' }).click();
    await expect(brand(page)).toContainText('has no Marble colors');
  });

  test('picking a color fills colors and temperatures; un-picking restores them', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await tile(page, 'Jade White').click();
    await expect(brand(page).locator('.picked-name')).toHaveText(/Jade White\s+PLA Basic/);
    await expect(page.locator('#hex-input')).toBeHidden(); // pickers hide while picked
    await expect(temps(page, 'Nozzle').min).toHaveValue('190');
    await expect(temps(page, 'Nozzle').max).toHaveValue('230');
    await expect(temps(page, 'Bed').min).toHaveValue('35');
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ brand: 'Bambu Lab', type: 'PLA', subtype: 'Basic', color_hex: 'FFFFFF', max_temp: '230', bed_min_temp: '35' });

    // the write saved it, named after the brand color
    await page.locator('.saved').getByRole('button', { name: 'Show' }).click();
    await expect(page.locator('.saved .tile').first()).toContainText('Jade White');
  });

  test('un-picking puts back the colors and temperatures from before', async ({ page }) => {
    await page.locator('#hex-input').fill('123456');
    await open(page, 'Bambu Lab', 'Basic');
    await tile(page, 'Jade White').click();
    await tile(page, 'Jade White').click(); // un-pick
    await expect(page.locator('#hex-input')).toHaveValue('123456');
    await expect(temps(page, 'Nozzle').max).toHaveValue('220');
    await expect(temps(page, 'Bed').min).toHaveValue('50');
  });

  test('a gradient spool sets Gradient and all its colors', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await brand(page).getByLabel('Search brand colors').fill('Basic Gradient'); // search also matches line names
    await expect(brand(page).locator('.tile').first().locator('.multi')).toContainText(/2 colors, gradient/);
    await brand(page).locator('.tile').first().click();
    await writeTag(page);
    const data = await lastWrite(page);
    expect(data.additional_color_hexes.length).toBeGreaterThan(0);
    expect(data.color_type).toBe(0);
  });

  test('Edit colors keeps the color and shows the pickers', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await tile(page, 'Jade White').click();
    await brand(page).getByRole('button', { name: 'Edit colors' }).click();
    await expect(page.locator('#hex-input')).toHaveValue('FFFFFF');
    await expect(tile(page, 'Jade White')).toHaveAttribute('aria-pressed', 'false');
  });

  test('suggests the variant of a line picked from Show all', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await brand(page).getByRole('button', { name: 'Show all Bambu Lab PLA lines' }).click();
    await brand(page).getByRole('button', { name: 'PLA Matte', exact: true }).click();
    await brand(page).locator('.tile').first().click();
    await brand(page).getByRole('button', { name: 'Set variant to Matte' }).click();
    await expect(chip(page, 'Matte')).toHaveAttribute('aria-pressed', 'true');
    await expect(brand(page).locator('.picked-name')).toContainText('PLA Matte'); // still picked
  });

  test('search finds colors by name', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await brand(page).getByLabel('Search brand colors').fill('jade white');
    await expect(brand(page).locator('.tile')).toHaveCount(1);
    await brand(page).getByLabel('Search brand colors').fill('zzzz');
    await expect(brand(page)).toContainText('No colors match');
  });

  test('picking a brand color lets go of a picked saved color, and back', async ({ page }) => {
    await chip(page, 'Bambu Lab').click();
    await chip(page, 'Basic').click();
    await page.locator('#hex-input').fill('ABCDEF');
    await page.locator('.saved').getByRole('button', { name: 'Save current colors' }).click();
    await page.locator('.saved').getByRole('button', { name: 'Show' }).click();
    await page.locator('.saved .tile').first().click(); // saved picked
    await brand(page).getByRole('button', { name: 'Show' }).click();
    await tile(page, 'Jade White').click(); // brand picked
    await expect(page.locator('.saved .tile').first()).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.saved .tile').first().click(); // saved again
    await expect(tile(page, 'Jade White')).toHaveAttribute('aria-pressed', 'false');
    await writeTag(page);
    expect((await lastWrite(page)).color_hex).toBe('ABCDEF');
  });

  test('reading a tag picks the matching brand color', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Bambu Lab', subtype: 'Basic', color_hex: 'FFFFFF' });
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(brand(page).locator('.picked-name')).toHaveText(/Jade White/);
  });
});
