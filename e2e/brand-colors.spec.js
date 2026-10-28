import { test, expect, colorTab, openCustom, placeTag, lastWrite, chip, writeTag, temps } from './nfc.js';

// Uses the bundled Open Filament Database snapshot (src/data/brand-colors.json)
const brand = (page) => page.locator('.brand');
const tile = (page, name) => brand(page).locator('.tile', { hasText: name }).first();
const nowName = (page) => page.locator('.colorsec .now-name');
const nowFrom = (page) => page.locator('.colorsec .now-from');

async function open(page, brandName, variant) {
  await chip(page, brandName).click();
  if (variant !== undefined) await chip(page, variant).click();
  await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
}

test.describe('Brand colors', () => {
  test('Generic has no brand colors: Custom is open', async ({ page }) => {
    await expect(chip(page, 'Generic')).toHaveAttribute('aria-pressed', 'true');
    await expect(colorTab(page, 'Brand')).toBeDisabled();
    await expect(colorTab(page, 'Saved')).toBeDisabled();
    await expect(colorTab(page, 'Custom')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hex-input')).toBeVisible();
    await expect(brand(page)).toHaveCount(0);
  });

  test('a brand with colors opens Brand, with the count on its button', async ({ page }) => {
    await chip(page, 'Bambu Lab').click();
    await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
    await expect(colorTab(page, 'Brand')).toHaveText(/Brand\s*\d+/);
    await expect(page.locator('#hex-input')).toBeHidden();
    await openCustom(page);
    await expect(brand(page)).toBeHidden();
    // back to Generic: Brand turns off, Custom opens
    await colorTab(page, 'Brand').click();
    await chip(page, 'Generic').click();
    await expect(colorTab(page, 'Custom')).toHaveAttribute('aria-pressed', 'true');
  });

  test('shows the variant’s group', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await expect(brand(page)).toContainText(/Showing Basic: \d+ colors from \d+ lines/);
    await expect(tile(page, 'Jade White')).toBeVisible();
    // grouped views list colors, not line chips
    await expect(brand(page).getByRole('group', { name: 'Filament lines' })).toHaveCount(0);

    await chip(page, 'Galaxy').click();
    await expect(brand(page)).toContainText(/Showing Galaxy: \d+ colors from 2 lines/); // PLA Galaxy + PLA Sparkle
  });

  test('variant chips are the ones the brand makes, in its own words', async ({ page }) => {
    const variants = page.getByRole('group', { name: 'Variant' });
    // Generic: the full default list
    await expect(variants.getByRole('button', { name: 'SnapSpeed', exact: true })).toBeVisible();
    await expect(variants.getByRole('button', { name: 'Metallic', exact: true })).toBeVisible();
    // Bambu Lab PLA: no SnapSpeed or HF; Bambu calls it "Metal"
    await chip(page, 'Bambu Lab').click();
    await expect(variants.getByRole('button', { name: 'SnapSpeed', exact: true })).toHaveCount(0);
    await expect(variants.getByRole('button', { name: 'HF', exact: true })).toHaveCount(0);
    await expect(variants.getByRole('button', { name: 'Metallic', exact: true })).toHaveCount(0);
    await variants.getByRole('button', { name: 'Metal', exact: true }).click();
    await expect(brand(page)).toContainText('Showing Metal:');
    await writeTag(page);
    expect((await lastWrite(page)).subtype).toBe('Metal');
    // Snapmaker PLA: SnapSpeed is there
    await chip(page, 'Snapmaker').click();
    await expect(variants.getByRole('button', { name: 'SnapSpeed', exact: true })).toBeVisible();
  });

  test('functional variants get their own chips: Aero, Tough+, shore hardness', async ({ page }) => {
    const variants = page.getByRole('group', { name: 'Variant' });
    await chip(page, 'Bambu Lab').click();
    await expect(variants.getByRole('button', { name: 'Tough+', exact: true })).toBeVisible();
    await variants.getByRole('button', { name: 'Aero', exact: true }).click();
    await expect(brand(page)).toContainText('Showing Aero:');
    await brand(page).locator('.tile').first().click();
    await writeTag(page);
    expect((await lastWrite(page)).subtype).toBe('Aero'); // not Basic
    // TPU: each hardness is a chip
    await chip(page, 'TPU').click();
    for (const h of ['85A', '90A', '95A HF']) await expect(variants.getByRole('button', { name: h, exact: true })).toBeVisible();
  });

  test('PLA+ spools have a Plus chip', async ({ page }) => {
    const variants = page.getByRole('group', { name: 'Variant' });
    await chip(page, 'eSun').click();
    await variants.getByRole('button', { name: 'Plus', exact: true }).click();
    await expect(brand(page)).toContainText('Showing Plus:');
    await brand(page).locator('.tile').first().click();
    await writeTag(page);
    expect((await lastWrite(page)).subtype).toBe('Plus');
  });

  test('changing brand keeps the variant only if it still fits', async ({ page }) => {
    const variants = page.getByRole('group', { name: 'Variant' });
    const pressed = (name) => variants.getByRole('button', { name, exact: true });
    // the reported case: Sunlu PLA Rainbow -> Snapmaker (no multi-color PLA) -> None
    await chip(page, 'SUNLU').click();
    await pressed('Rainbow').click();
    await chip(page, 'Snapmaker').click();
    await expect(pressed('None')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Custom variant')).toHaveCount(0);
    // the same kind under the new brand's word: Bambu "Metal" -> Polymaker "Metallic"
    await chip(page, 'Bambu Lab').click();
    await pressed('Metal').click();
    await chip(page, 'Polymaker').click();
    await expect(pressed('Metallic')).toHaveAttribute('aria-pressed', 'true');
    // a chip both brands have stays
    await pressed('Matte').click();
    await chip(page, 'Bambu Lab').click();
    await expect(pressed('Matte')).toHaveAttribute('aria-pressed', 'true');
    // Generic has the full list
    await pressed('Metal').click();
    await chip(page, 'Generic').click();
    await expect(pressed('Metallic')).toHaveAttribute('aria-pressed', 'true');
  });

  test('saved colors don’t keep a variant when changing brand', async ({ page }) => {
    const variants = page.getByRole('group', { name: 'Variant' });
    // save colors for Snapmaker PLA under the Custom variant "Rainbow"
    await chip(page, 'Snapmaker').click();
    await variants.getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom variant').fill('Rainbow');
    await openCustom(page);
    await page.getByRole('button', { name: 'Save colors' }).click();
    // Sunlu PLA Rainbow -> Snapmaker still goes to None
    await chip(page, 'SUNLU').click();
    await variants.getByRole('button', { name: 'Rainbow', exact: true }).click();
    await chip(page, 'Snapmaker').click();
    await expect(variants.getByRole('button', { name: 'None', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a subtype the brand doesn’t list stays, as Custom', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Bambu Lab', subtype: 'SnapSpeed', color_hex: '000000' });
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByLabel('Custom variant')).toHaveValue('SnapSpeed');
    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect((await lastWrite(page)).subtype).toBe('SnapSpeed');
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
    // Polymaker makes no marble PLA, so Marble isn't a chip; typed as Custom it finds nothing
    await chip(page, 'Polymaker').click();
    await expect(page.getByRole('group', { name: 'Variant' }).getByRole('button', { name: 'Marble', exact: true })).toHaveCount(0);
    await page.getByRole('group', { name: 'Variant' }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom variant').fill('Marble');
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
    await expect(nowName(page)).toHaveText('Jade White');
    await expect(nowFrom(page)).toHaveText('Brand color · PLA Basic');
    await expect(temps(page, 'Nozzle').min).toHaveValue('190');
    await expect(temps(page, 'Nozzle').max).toHaveValue('230');
    await expect(temps(page, 'Bed').min).toHaveValue('35');
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ brand: 'Bambu Lab', type: 'PLA', subtype: 'Basic', color_hex: 'FFFFFF', max_temp: '230', bed_min_temp: '35' });

    // the write saved it, named after the brand color
    await colorTab(page, 'Saved').click();
    await expect(page.locator('.saved .tile').first()).toContainText('Jade White');
  });

  test('un-picking puts back the colors and temperatures from before', async ({ page }) => {
    await page.locator('#hex-input').fill('123456');
    await open(page, 'Bambu Lab', 'Basic');
    await tile(page, 'Jade White').click();
    await tile(page, 'Jade White').click(); // un-pick
    await expect(nowName(page)).toHaveText('Custom colors');
    await openCustom(page);
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

  test('Edit colors keeps the color and opens Custom', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await tile(page, 'Jade White').click();
    await brand(page).getByRole('button', { name: 'Edit colors' }).click();
    await expect(colorTab(page, 'Custom')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hex-input')).toHaveValue('FFFFFF');
    await expect(tile(page, 'Jade White')).toHaveAttribute('aria-pressed', 'false');
  });

  test('changing the colors in Custom lets go of the brand color', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await tile(page, 'Jade White').click();
    await openCustom(page);
    await expect(nowName(page)).toHaveText('Jade White'); // unchanged so far
    await page.locator('#hex-input').fill('FFFFFE');
    await expect(nowName(page)).toHaveText('Custom colors');
    await colorTab(page, 'Brand').click();
    await expect(tile(page, 'Jade White')).toHaveAttribute('aria-pressed', 'false');
  });

  test('suggests the variant of a line picked from Show all', async ({ page }) => {
    await open(page, 'Bambu Lab', 'Basic');
    await brand(page).getByRole('button', { name: 'Show all Bambu Lab PLA lines' }).click();
    await brand(page).getByRole('button', { name: 'PLA Matte', exact: true }).click();
    await brand(page).locator('.tile').first().click();
    await brand(page).getByRole('button', { name: 'Set variant to Matte' }).click();
    await expect(chip(page, 'Matte')).toHaveAttribute('aria-pressed', 'true');
    await expect(nowFrom(page)).toContainText('PLA Matte'); // still picked
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
    await openCustom(page);
    await page.locator('#hex-input').fill('ABCDEF');
    await page.getByRole('button', { name: 'Save colors' }).click(); // saved + picked
    await expect(nowFrom(page)).toHaveText('Saved color');
    await colorTab(page, 'Brand').click();
    await tile(page, 'Jade White').click(); // brand picked
    await expect(nowFrom(page)).toHaveText('Brand color · PLA Basic');
    await colorTab(page, 'Saved').click();
    await expect(page.locator('.saved .tile').first()).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.saved .tile').first().click(); // saved again
    await expect(nowFrom(page)).toHaveText('Saved color');
    await colorTab(page, 'Brand').click();
    await expect(tile(page, 'Jade White')).toHaveAttribute('aria-pressed', 'false');
    await writeTag(page);
    expect((await lastWrite(page)).color_hex).toBe('ABCDEF');
  });

  test('reading a tag picks the matching brand color', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Bambu Lab', subtype: 'Basic', color_hex: 'FFFFFF' });
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
    await expect(tile(page, 'Jade White')).toHaveAttribute('aria-pressed', 'true');
    await expect(nowName(page)).toHaveText('Jade White');
  });

  test('reading a tag with no matching color opens Custom', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Bambu Lab', color_hex: '123457' });
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(colorTab(page, 'Custom')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hex-input')).toHaveValue('123457');
  });
});
