import { test, expect, chip, writeTag, lastWrite, status, temps, placeTag } from './nfc.js';

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
    for (const h of ['Defaults for new tags', 'Your chips', 'Saved colors', 'Appearance', 'About']) {
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

  test('your chips: listed and removable', async ({ page }) => {
    await page.getByRole('group', { name: 'Material', exact: true }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom material').fill('PLA+');
    await page.getByRole('button', { name: 'Save material as a chip' }).click();
    await settings(page);
    const chips = (await card(page, 'Your chips'));
    await expect(chips.getByRole('group', { name: 'Your materials' })).toContainText('PLA+');
    await chips.getByRole('button', { name: 'Remove PLA+' }).click();
    await expect(chips).toContainText('None yet');
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(chip(page, 'PLA+')).toHaveCount(0);
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
