import { test, expect, colorStyle, lastWrite, writeCount, chip, writeTag, status, temps } from './nfc.js';

test.describe('Create', () => {
  test('writes the default tag', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Create' })).toHaveAttribute('aria-selected', 'true');
    await writeTag(page);
    await expect(status(page)).toHaveText('Tag written.');
    expect(await lastWrite(page)).toEqual({
      protocol: 'openspool', version: '1.0', type: 'PLA', color_hex: 'FFFFFF', brand: 'Generic',
      min_temp: '190', max_temp: '220', bed_min_temp: '50', bed_max_temp: '60',
    });
  });

  test('standard profile writes only the official fields', async ({ page }) => {
    await chip(page, 'Silk').click();
    await chip(page, 'OpenSpool (standard)').click();
    await expect(chip(page, 'Silk')).toBeHidden();
    await expect(temps(page, 'Bed').min).toBeHidden();
    await writeTag(page);
    const data = await lastWrite(page);
    expect(Object.keys(data)).toEqual(['protocol', 'version', 'type', 'color_hex', 'brand', 'min_temp', 'max_temp']);
  });

  test('picking a material fills its temperatures', async ({ page }) => {
    await chip(page, 'PETG').click();
    await expect(temps(page, 'Nozzle').min).toHaveValue('220');
    await expect(temps(page, 'Nozzle').max).toHaveValue('250');
    await expect(temps(page, 'Bed').min).toHaveValue('70');
    await expect(temps(page, 'Bed').max).toHaveValue('80');
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ type: 'PETG', min_temp: '220', max_temp: '250', bed_min_temp: '70', bed_max_temp: '80' });
  });

  test('custom material, brand and variant', async ({ page }) => {
    await chip(page, 'ABS').click(); // temps 230-260
    await page.getByRole('group', { name: 'Material' }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom material').fill('PLA+');
    await expect(temps(page, 'Nozzle').min).toHaveValue('230'); // custom keeps the temps
    await page.getByRole('group', { name: 'Brand' }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom brand').fill('Zephyr Filaments');
    await page.getByRole('group', { name: 'Variant' }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom variant').fill('Rapid');
    await expect(page.getByLabel('Tag preview')).toContainText('Zephyr Filaments PLA+ Rapid');
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ type: 'PLA+', brand: 'Zephyr Filaments', subtype: 'Rapid' });
  });

  test('a typed brand suggests database brands and uses their spelling', async ({ page }) => {
    const brand = page.getByRole('group', { name: 'Brand' });
    const materials = page.getByRole('group', { name: 'Material' });
    const matches = page.getByRole('group', { name: 'Suggestions' });
    await brand.getByRole('button', { name: 'Custom' }).click();
    // part of a name: suggestions, and the rows wait until the name is done
    await page.getByLabel('Custom brand').fill('Bambu');
    await expect(matches.getByRole('button', { name: 'Bambu Lab' })).toBeVisible();
    await expect(materials.getByRole('button', { name: 'PEEK', exact: true })).toBeVisible(); // still every material
    await matches.getByRole('button', { name: 'Bambu Lab' }).click();
    await expect(chip(page, 'Bambu Lab')).toHaveAttribute('aria-pressed', 'true'); // the chip, not Custom
    await expect(page.getByLabel('Custom brand')).toHaveCount(0);
    await expect(materials.getByRole('button', { name: 'PEEK', exact: true })).toHaveCount(0);

    // a full name in any spelling becomes the database's, on Enter or leaving the box
    await brand.getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom brand').fill('elegoo');
    await page.getByLabel('Custom brand').press('Enter');
    await expect(page.getByLabel('Custom brand')).toHaveValue('ELEGOO');
    await expect(page.getByRole('dialog')).toHaveCount(0); // Enter doesn't write the tag
    await expect(materials).toContainText('The materials ELEGOO makes.');
    await writeTag(page);
    expect((await lastWrite(page)).brand).toBe('ELEGOO');

    // a brand the database doesn't know is written as typed
    await page.getByLabel('Custom brand').fill('My Own Brand ');
    await page.getByLabel('Custom brand').blur();
    await expect(page.getByLabel('Custom brand')).toHaveValue('My Own Brand');
    await expect(materials.getByRole('button', { name: 'PEEK', exact: true })).toBeVisible();
    await writeTag(page);
    expect((await lastWrite(page)).brand).toBe('My Own Brand');
  });

  test('variant None leaves subtype out', async ({ page }) => {
    await chip(page, 'Matte').click();
    await chip(page, 'None').click();
    await writeTag(page);
    expect(await lastWrite(page)).not.toHaveProperty('subtype');
  });

  test('multi-color: gradient writes color_type 0, segments leaves it out', async ({ page }) => {
    await page.locator('#hex-input').fill('f00'); // 3 digits expand
    await page.getByRole('button', { name: 'Add a color' }).click();
    await page.locator('#hex-input').fill('00FF00');
    await page.getByRole('button', { name: 'Add a color' }).click();
    await page.locator('#hex-input').fill('#0000ff');
    await colorStyle(page, 'Gradient').click();
    await expect(page.getByLabel('Tag preview')).toContainText('3 colors, gradient');
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({
      color_hex: 'FF0000', additional_color_hexes: ['00FF00', '0000FF'], color_type: 0,
    });

    // The write saved these colors; the pickers stay open to keep editing
    await colorStyle(page, 'Segments').click();
    await writeTag(page);
    const data = await lastWrite(page);
    expect(data.additional_color_hexes).toEqual(['00FF00', '0000FF']);
    expect(data).not.toHaveProperty('color_type');
  });

  test('up to 5 colors, and colors can be removed', async ({ page }) => {
    const add = page.getByRole('button', { name: 'Add a color' });
    for (let i = 0; i < 4; i++) await add.click();
    await expect(add).toBeHidden();
    await page.getByRole('button', { name: /^Color 2,/ }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Color \d,/ })).toHaveCount(4);
    await writeTag(page);
    expect((await lastWrite(page)).additional_color_hexes).toHaveLength(3);
  });

  test('a bad hex color blocks the write', async ({ page }) => {
    await page.locator('#hex-input').fill('12345');
    await page.locator('#hex-input').blur();
    await expect(page.getByText('Use 3 or 6 hex digits')).toBeVisible();
    await page.getByRole('button', { name: 'Add a color' }).click(); // the main color stays white
    await page.locator('#hex-input').fill('zz');
    await page.locator('#hex-input').blur();
    await expect(page.locator('#hex-input')).toHaveAttribute('aria-invalid', 'true');
  });

  test('bad temperatures block the write and are pointed out', async ({ page }) => {
    await temps(page, 'Nozzle').min.fill('240');
    await temps(page, 'Nozzle').max.fill('220');
    await page.getByRole('button', { name: 'Write tag' }).click();
    await expect(status(page)).toContainText('Fix the highlighted field');
    await expect(page.getByText('Nozzle max is below nozzle min.')).toBeVisible();
    await expect(temps(page, 'Nozzle').max).toBeFocused();
    expect(await writeCount(page)).toBe(0);

    await temps(page, 'Nozzle').max.fill('abc');
    await expect(page.getByText('must be a whole number')).toBeVisible();
    await temps(page, 'Nozzle').max.fill('260');
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ min_temp: '240', max_temp: '260' });
  });

  test('empty temperatures are left off the tag', async ({ page }) => {
    for (const w of ['Nozzle', 'Bed']) {
      await temps(page, w).min.fill('');
      await temps(page, w).max.fill('');
    }
    await writeTag(page);
    expect(Object.keys(await lastWrite(page))).toEqual(['protocol', 'version', 'type', 'color_hex', 'brand']);
  });

  test('spool details: weight, diameter and opacity', async ({ page }) => {
    await page.getByText('Spool details', { exact: true }).click();
    await page.getByLabel('Weight, g').fill('1000');
    await page.getByLabel('Diameter, mm').fill('1.75');
    await page.getByLabel('Opacity (hex)').fill('80');
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ weight: '1000', diameter: '1.75', alpha: '80' });

    await page.getByLabel('Opacity (hex)').fill('FF');
    await page.getByLabel('Weight, g').fill('1.5');
    await page.getByRole('button', { name: 'Write tag' }).click();
    await expect(page.getByText('Weight must be a whole number of grams.')).toBeVisible();
    await page.getByLabel('Weight, g').fill('');
    await writeTag(page);
    const data = await lastWrite(page);
    expect(data).not.toHaveProperty('alpha');
    expect(data).not.toHaveProperty('weight');
  });

  test('the tag data preview matches what is written', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await page.getByText(/^Tag data \(\d+ bytes\)/).click();
    const shown = JSON.parse(await page.locator('details.more pre').last().innerText());
    await writeTag(page);
    expect(await lastWrite(page)).toEqual(shown);
    await expect(page.getByLabel('Tag preview')).toContainText(/\d+ of 499 bytes on NTAG215/);
  });

  test('data too big for the tag is refused before writing', async ({ page }) => {
    const wide = '€'.repeat(40); // 3 bytes each: long names in some scripts get big fast
    await page.getByRole('group', { name: 'Material' }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom material').fill(wide);
    await page.getByRole('group', { name: 'Brand' }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom brand').fill(wide);
    await page.getByRole('group', { name: 'Variant' }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom variant').fill(wide);
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Add a color' }).click();
    await expect(page.getByLabel('Tag preview')).toContainText('too big');
    await page.getByRole('button', { name: 'Write tag' }).click();
    await expect(status(page)).toContainText('more than the 499 that fit on NTAG215');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await writeCount(page)).toBe(0);
  });

  test('cancelling a write writes nothing', async ({ page }) => {
    await page.evaluate(() => { window.__tapDelay = 5000; });
    await page.getByRole('button', { name: 'Write tag' }).click();
    await expect(page.getByRole('dialog', { name: 'Ready to write' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(status(page)).toHaveCount(0);
    expect(await writeCount(page)).toBe(0);
  });

  test('a tag pulled away too soon shows how to retry', async ({ page }) => {
    await page.evaluate(() => { window.__nextError = 'NetworkError'; });
    await writeTag(page);
    await expect(status(page)).toContainText('moved away before it finished');
    await writeTag(page);
    await expect(status(page)).toHaveText('Tag written.');
  });

  test('Start over resets the form', async ({ page }) => {
    await chip(page, 'PETG').click();
    await page.getByRole('button', { name: 'Add a color' }).click();
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(chip(page, 'PLA')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Color \d,/ })).toHaveCount(1);
  });
});

test('without Web NFC the app says why and disables writing', async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/');
  await expect(page.getByText('Web NFC isn’t available here.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Write tag' })).toBeDisabled();
  await page.close();
});
