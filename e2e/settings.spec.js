import { test, expect, chip, writeTag, lastWrite, status, temps, placeTag, showAllMaterials } from './nfc.js';

const settings = (page) => page.getByRole('tab', { name: 'Settings' }).click();
// A Settings card, opened (they start closed)
async function card(page, name) {
  const c = page.locator('details.card', { has: page.getByRole('heading', { name }) });
  if (!(await c.evaluate((d) => d.open))) await c.locator('summary').click();
  return c;
}

test.describe('Settings', () => {
  test('a Settings tab next to Create and Read & update, with no write button', async ({ page }) => {
    await settings(page);
    await expect(page.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
    for (const h of ['Defaults for new tags', 'Brands', 'Materials', 'Your chips', 'Saved colors', 'Appearance', 'About']) {
      await expect(page.getByRole('heading', { name: h })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Write tag' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(page.getByRole('button', { name: 'Write tag' })).toBeVisible();
  });

  test('defaults: new tags and Start over use the saved form', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await chip(page, 'PETG').click();
    await temps(page, 'Nozzle').max.fill('245');
    await settings(page);
    await (await card(page, 'Defaults for new tags')).getByRole('button', { name: 'Use the form as it is now' }).click();
    await expect(status(page)).toHaveText('Saved. New tags start like this.');
    await expect((await card(page, 'Defaults for new tags'))).toContainText('Polymaker');
    await expect((await card(page, 'Defaults for new tags'))).toContainText('220–245 °C');

    // a new visit starts like that
    await page.reload();
    await expect(chip(page, 'Polymaker')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'PETG')).toHaveAttribute('aria-pressed', 'true');
    await chip(page, 'Generic').click();
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(chip(page, 'Polymaker')).toHaveAttribute('aria-pressed', 'true');
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ brand: 'Polymaker', type: 'PETG', max_temp: '245' });

    // reset
    await settings(page);
    await (await card(page, 'Defaults for new tags')).getByRole('button', { name: 'Reset to built-in' }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(chip(page, 'Generic')).toHaveAttribute('aria-pressed', 'true');
  });

  test('brands: × removes, typing finds brands that start with it, a tap adds', async ({ page }) => {
    const brandRow = page.getByRole('group', { name: 'Brand', exact: true });
    await settings(page);
    const brands = (await card(page, 'Brands'));
    const onForm = brands.getByRole('group', { name: 'Brands on the form' });
    const toAdd = brands.getByRole('list', { name: 'Brands to add' });
    await expect(onForm).toContainText('Generic');
    await expect(onForm).toContainText('SUNLU');

    // nothing listed until something is typed
    await expect(toAdd).toHaveCount(0);
    // one letter: only brands starting with it, at most 12, none already on the form
    await brands.getByLabel('Find a brand').fill('a');
    await expect(toAdd.getByRole('listitem')).toHaveCount(12);
    for (const name of await toAdd.locator('.bname').allTextContents()) expect(name.trim()[0].toLowerCase()).toBe('a');
    await brands.getByLabel('Find a brand').fill('s');
    await expect(toAdd).not.toContainText('SUNLU'); // already on the form

    // remove one with ×: it can be found again
    await onForm.getByRole('button', { name: 'Hide SUNLU' }).click();
    await expect(onForm).not.toContainText('SUNLU');
    await brands.getByLabel('Find a brand').fill('sun');
    await expect(toAdd.getByRole('button', { name: 'Add SUNLU' })).toBeVisible();

    // a tap adds it, and it leaves the list
    await brands.getByLabel('Find a brand').fill('elegoo');
    await toAdd.getByRole('button', { name: 'Add Elegoo' }).click();
    await expect(onForm).toContainText('Elegoo');
    await expect(brands.getByRole('button', { name: 'Add Elegoo' })).toHaveCount(0);

    // a name nobody lists
    await brands.getByLabel('Find a brand').fill('Zephyr');
    await expect(brands).toContainText('No other brands start with “Zephyr”.');
    await brands.getByRole('button', { name: 'Add “Zephyr” as your own brand' }).click();
    await expect(onForm).toContainText('Zephyr');

    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(brandRow.getByRole('button', { name: 'SUNLU', exact: true })).toHaveCount(0);
    await expect(brandRow.getByRole('button', { name: 'Elegoo', exact: true })).toBeVisible();
    await expect(brandRow.getByRole('button', { name: 'Zephyr', exact: true })).toHaveClass(/saved/);

    // it sticks
    await page.reload();
    await expect(brandRow.getByRole('button', { name: 'Elegoo', exact: true })).toBeVisible();
    await expect(brandRow.getByRole('button', { name: 'SUNLU', exact: true })).toHaveCount(0);

    // reset
    await settings(page);
    await (await card(page, 'Brands')).getByRole('button', { name: 'Show the default brands' }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(brandRow.getByRole('button', { name: 'SUNLU', exact: true })).toBeVisible();
    await expect(brandRow.getByRole('button', { name: 'Elegoo', exact: true })).toHaveCount(0);
  });

  test('the Material row starts short: PLA, PETG and ABS', async ({ page }) => {
    const row = page.getByRole('group', { name: 'Material', exact: true });
    for (const name of ['PLA', 'PETG', 'ABS', 'Other…']) await expect(row.getByRole('button', { name, exact: true })).toBeVisible();
    for (const name of ['TPU', 'ASA', 'PEEK', 'PVA']) await expect(row.getByRole('button', { name, exact: true })).toHaveCount(0);
  });

  test('materials: choose what the Material row shows', async ({ page }) => {
    const row = page.getByRole('group', { name: 'Material', exact: true });
    await settings(page);
    const materials = await card(page, 'Materials');
    const onForm = materials.getByRole('group', { name: 'Materials on the form' });
    const toAdd = materials.getByRole('group', { name: 'Materials to add' });
    await expect(onForm).toContainText('PLA');
    await expect(onForm).toContainText('PETG');
    await expect(onForm).toContainText('ABS');
    await expect(onForm).not.toContainText('PEEK');

    // + adds one back, and it leaves the list
    await toAdd.getByRole('button', { name: 'Add TPU', exact: true }).click();
    await expect(onForm).toContainText('TPU');
    await expect(materials.getByRole('button', { name: 'Add TPU', exact: true })).toHaveCount(0);

    // × hides one
    await onForm.getByRole('button', { name: 'Hide PETG' }).click();
    await expect(onForm).not.toContainText('PETG');
    await expect(materials.getByRole('button', { name: 'Add PETG', exact: true })).toBeVisible();

    // narrowing the list, and a name nobody lists
    await materials.getByLabel('Find a material').fill('pee');
    await expect(toAdd.getByRole('button')).toHaveCount(1);
    await materials.getByLabel('Find a material').fill('PLA+');
    await expect(materials).toContainText('No other materials match “PLA+”.');
    await materials.getByRole('button', { name: 'Add “PLA+” as your own material' }).click();
    await expect(onForm).toContainText('PLA+');

    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(row.getByRole('button', { name: 'TPU', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'PETG', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'PLA+', exact: true })).toHaveClass(/saved/);

    // it sticks
    await page.reload();
    await expect(row.getByRole('button', { name: 'TPU', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'PETG', exact: true })).toHaveCount(0);

    // reset
    await settings(page);
    await (await card(page, 'Materials')).getByRole('button', { name: 'Show the default materials' }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(row.getByRole('button', { name: 'PETG', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'TPU', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'PLA+', exact: true })).toHaveCount(0);
  });

  test('Other… suggests hidden materials, fills their temperatures, and puts a built-in one on the row', async ({ page }) => {
    const row = page.getByRole('group', { name: 'Material', exact: true });
    const matches = page.getByRole('group', { name: 'Suggestions' });
    await row.getByRole('button', { name: 'Other…' }).click();
    await page.getByLabel('Other material').fill('pee');
    await expect(matches.getByRole('button', { name: 'PEEK' })).toBeVisible();
    await expect(matches.getByRole('button', { name: 'PLA' })).toHaveCount(0); // already on the row
    await matches.getByRole('button', { name: 'PEEK' }).click();
    // it's a chip now (built in: no dashed outline), with its temperatures
    await expect(page.getByLabel('Other material')).toHaveValue('PEEK');
    await expect(chip(page, 'PEEK')).toBeVisible();
    await expect(chip(page, 'PEEK')).not.toHaveClass(/saved/);
    await expect(temps(page, 'Nozzle').min).toHaveValue('360');
    await chip(page, 'PLA').click();
    await expect(chip(page, 'PEEK')).toBeVisible(); // and it stays on the row
    // a typed built-in name in any case becomes its spelling
    await row.getByRole('button', { name: 'Other…' }).click();
    await page.getByLabel('Other material').fill('tpu');
    await page.getByLabel('Other material').press('Enter');
    await expect(page.getByLabel('Other material')).toHaveValue('TPU');
    await expect(chip(page, 'TPU')).toBeVisible();
    await expect(temps(page, 'Nozzle').min).toHaveValue('210');
    // Settings lists them
    await settings(page);
    const onForm = (await card(page, 'Materials')).getByRole('group', { name: 'Materials on the form' });
    await expect(onForm).toContainText('PEEK');
    await expect(onForm).toContainText('TPU');
  });

  test('writing a tag turns its material on', async ({ page }) => {
    await page.getByRole('group', { name: 'Material', exact: true }).getByRole('button', { name: 'Other…' }).click();
    await page.getByLabel('Other material').fill('PLA+');
    await writeTag(page);
    expect((await lastWrite(page)).type).toBe('PLA+');
    await expect(chip(page, 'PLA+')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-materials')).shown)).toContain('PLA+');
  });

  test('a read tag with a hidden material still shows it selected', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PEEK', brand: 'Generic', color_hex: 'FFFFFF' });
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(chip(page, 'PEEK')).toHaveAttribute('aria-pressed', 'true');
    // pick something else and it goes away again
    await chip(page, 'PLA').click();
    await expect(chip(page, 'PEEK')).toHaveCount(0);
  });

  test('hiding a material hides it for brands too, and a brand still filters the rest', async ({ page }) => {
    const row = page.getByRole('group', { name: 'Material', exact: true });
    await settings(page);
    await (await card(page, 'Materials')).getByRole('group', { name: 'Materials on the form' }).getByRole('button', { name: 'Hide PETG' }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await chip(page, 'JAYO').click(); // JAYO makes PLA, PETG and TPU; ABS isn't made
    await expect(row.getByRole('button', { name: 'PLA', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'PETG', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'ABS', exact: true })).toHaveCount(0);
  });

  test('a brand that doesn’t make the material switches to a material you show', async ({ page }) => {
    await showAllMaterials(page);
    await settings(page);
    // hide PLA, so the switch has to pick from what's left
    await (await card(page, 'Materials')).getByRole('group', { name: 'Materials on the form' }).getByRole('button', { name: 'Hide PLA', exact: true }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await chip(page, 'PEEK').click();
    await chip(page, 'JAYO').click(); // no PEEK: PETG is the first of its materials that is shown
    await expect(chip(page, 'PETG')).toHaveAttribute('aria-pressed', 'true');
    await expect(temps(page, 'Nozzle').min).toHaveValue('220');
  });

  test('materials saved as chips before move into the material list', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('filascribe-custom-chips', JSON.stringify({ brands: [], materials: ['PLA+'], variants: {} })));
    await page.reload();
    await expect(chip(page, 'PLA+')).toBeVisible();
    await expect(chip(page, 'PETG')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-materials')).shown)).toEqual(['PLA', 'PETG', 'ABS', 'PLA+']);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-custom-chips')).materials)).toEqual([]);
  });

  test('cards start closed, open with a tap, and stay open after a reload', async ({ page }) => {
    await settings(page);
    const about = page.locator('details.card', { has: page.getByRole('heading', { name: 'About' }) });
    await expect(about).not.toHaveAttribute('open', /.*/);
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeHidden();
    await about.locator('summary').click();
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
    await page.reload();
    await settings(page);
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
    await about.locator('summary').click();
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeHidden();
  });

  test('a read tag with a hidden brand shows it under Other…', async ({ page }) => {
    await settings(page);
    await (await card(page, 'Brands')).getByRole('group', { name: 'Brands on the form' }).getByRole('button', { name: 'Hide SUNLU' }).click();
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'SUNLU', color_hex: 'FFFFFF' });
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByLabel('Other brand')).toHaveValue('SUNLU');
  });

  test('brands saved as chips before move into the brand list', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('filascribe-custom-chips', JSON.stringify({ brands: ['Zephyr'], materials: [], variants: {} })));
    await page.reload();
    await expect(chip(page, 'Zephyr')).toBeVisible();
    await expect(chip(page, 'SUNLU')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-brands')).shown)).toContain('Zephyr');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-custom-chips')).brands)).toEqual([]);
  });

  test('your chips: variants are listed and removable', async ({ page }) => {
    await page.getByRole('group', { name: 'Variant', exact: true }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom variant').fill('Rapid');
    await page.getByRole('button', { name: 'Save variant as a chip' }).click();
    await settings(page);
    const chips = (await card(page, 'Your chips'));
    await expect(chips.getByRole('group', { name: 'Your variants for Generic PLA' })).toContainText('Rapid');
    await chips.getByRole('button', { name: 'Remove Rapid' }).click();
    await expect(chips).toContainText('None yet');
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(chip(page, 'Rapid')).toHaveCount(0);
  });

  test('saved colors: listed per brand + material, cleared, imported and exported', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await page.getByRole('group', { name: 'Color source' }).getByRole('button', { name: /^Custom/ }).click();
    await page.getByRole('button', { name: 'Save colors' }).click();
    await settings(page);
    const saved = (await card(page, 'Saved colors'));
    await expect(saved).toContainText('1 saved color');
    await expect(saved).toContainText('Polymaker PLA');

    await saved.getByLabel('Saved colors file').setInputFiles({
      name: 'colors.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ 'Generic|PETG': [{ colors: ['ABCDEF'], name: '', variants: [''] }] })),
    });
    await expect(status(page)).toHaveText('Imported 1 saved color.');
    await expect(saved).toContainText('Generic PETG');

    const [download] = await Promise.all([page.waitForEvent('download'), saved.getByRole('button', { name: 'Export saved colors' }).click()]);
    expect(download.suggestedFilename()).toBe('filascribe-saved-colors.json');

    await saved.getByRole('button', { name: 'Clear Polymaker PLA' }).click();
    await expect(saved).not.toContainText('Polymaker PLA');
    await saved.getByRole('button', { name: 'Clear all' }).click();
    await expect(saved).toContainText('None yet');
  });

  test('appearance: light, dark or follow the system, kept after a reload', async ({ page }) => {
    await settings(page);
    await card(page, 'Appearance');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await chip(page, 'Dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg()).toBe('rgb(22, 26, 32)');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await settings(page);
    await card(page, 'Appearance');
    await chip(page, 'Light').click();
    expect(await bg()).toBe('rgb(230, 233, 237)');
    await chip(page, 'Follow the system').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  });

  test('about: version, specs and data sources', async ({ page }) => {
    await settings(page);
    const about = (await card(page, 'About'));
    await expect(about).toContainText('FilaScribe');
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
    await expect(about.getByRole('link', { name: 'OrcaSlicer’s filament profiles' })).toBeVisible();
    await expect(about.getByRole('link', { name: 'RrrrobertB1992/FilaScribe' })).toHaveAttribute('href', 'https://github.com/RrrrobertB1992/FilaScribe');
  });
});
