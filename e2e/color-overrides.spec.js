import { test, expect, colorTab, chip, openCustom } from './nfc.js';

// Bambu Lab PLA Basic Black is #000000 in the bundled database snapshot
const brand = (page) => page.locator('.brand');
const tile = (page, name) => brand(page).locator('.tile', { hasText: name }).first();
const header = (page) => page.locator('.colorsec');
const box = (page) => page.getByRole('group', { name: 'Override this color' });
const overrideBtn = (page) => brand(page).getByRole('button', { name: /^(Override this color|Edit override)$/ });

async function pickBlack(page) {
  await chip(page, 'Bambu Lab').click();
  await chip(page, 'Basic').click();
  await tile(page, 'Black').click();
}

async function override(page, hex, { all = false } = {}) {
  await overrideBtn(page).click();
  await box(page).getByLabel('Override hex').fill(hex);
  if (all) await box(page).getByRole('checkbox').check();
  await box(page).getByRole('button', { name: 'Save override' }).click();
}

test.describe('Color overrides', () => {
  test('the button shows next to “Show all” only once a color is picked', async ({ page }) => {
    await chip(page, 'Bambu Lab').click();
    await chip(page, 'Basic').click();
    await expect(overrideBtn(page)).toHaveCount(0);
    await tile(page, 'Black').click();
    await expect(overrideBtn(page)).toBeVisible();
    await expect(brand(page).getByRole('button', { name: /^Show all Bambu Lab/ })).toBeVisible();
  });

  test('saving changes the color, marks it and the Colors card', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111');
    await expect(box(page)).toHaveCount(0);
    await expect(tile(page, 'Black')).toContainText('Edited');
    await expect(tile(page, 'Black')).toContainText('111111');
    await expect(header(page).locator('.now-name')).toHaveText('Black (#000000)');
    await expect(header(page).locator('.now-hex')).toHaveText('#111111');
    await expect(header(page).locator('.swatch.edited')).toBeVisible();
    await expect(overrideBtn(page)).toHaveText('Edit override');
  });

  test('Pick opens the app’s color picker in a pop-up', async ({ page }) => {
    await pickBlack(page);
    await overrideBtn(page).click();
    await box(page).getByRole('button', { name: 'Pick a color' }).click();
    const pop = page.getByRole('dialog', { name: 'Pick Override color' });
    await expect(pop).toBeVisible();
    await pop.getByLabel('Override color hex').fill('336699');
    await pop.getByRole('button', { name: 'Use this color' }).click();
    await expect(pop).toHaveCount(0);
    await expect(box(page).getByLabel('Override hex')).toHaveValue('336699');
    // Cancel keeps what was there
    await box(page).getByRole('button', { name: 'Pick a color' }).click();
    await pop.getByLabel('Override color hex').fill('FF0000');
    await pop.getByRole('button', { name: 'Cancel' }).click();
    await expect(box(page).getByLabel('Override hex')).toHaveValue('336699');
  });

  test('a bad hex is refused', async ({ page }) => {
    await pickBlack(page);
    await overrideBtn(page).click();
    await box(page).getByLabel('Override hex').fill('12');
    await box(page).getByRole('button', { name: 'Save override' }).click();
    await expect(box(page)).toContainText('6 hex digits');
  });

  test('stays after a reload, and an old tag with the database hex still matches', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111');
    await page.reload();
    await chip(page, 'Bambu Lab').click();
    await chip(page, 'Basic').click();
    await expect(tile(page, 'Black')).toContainText('Edited');
    await expect(tile(page, 'Black')).toContainText('111111');
  });

  test('“other lines” changes the same color in every line', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111', { all: true });
    await brand(page).getByRole('button', { name: /^Show all Bambu Lab/ }).click();
    await brand(page).getByRole('group', { name: 'Filament lines' }).getByRole('button', { name: 'PLA Tough+', exact: true }).click();
    await expect(tile(page, 'Black')).toContainText('Edited');
    await expect(tile(page, 'Black')).toContainText('111111');
  });

  test('Reset to database asks first, then gives the database color back', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111');
    let asked = '';
    page.removeAllListeners('dialog');
    page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
    await overrideBtn(page).click();
    await box(page).getByRole('button', { name: 'Reset to database' }).click();
    expect(asked).not.toBe('');
    await expect(tile(page, 'Black')).toContainText('Edited');
    page.once('dialog', (d) => d.accept());
    await box(page).getByRole('button', { name: 'Reset to database' }).click();
    await expect(tile(page, 'Black')).not.toContainText('Edited');
    await expect(header(page).locator('.now-name')).toHaveText('Black');
  });
});

test.describe('Color overrides in Settings', () => {
  async function openSettings(page) {
    await page.getByRole('tab', { name: 'Settings' }).click();
    const card = page.locator('details.card', { has: page.getByRole('heading', { name: 'Color overrides' }) });
    if (!(await card.evaluate((d) => d.open))) await card.locator('summary').click();
    return card;
  }

  test('lists each override with its own Reset, and Clear all, both asking first', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111');
    const card = await openSettings(page);
    await expect(card).toContainText('Bambu Lab');
    await expect(card).toContainText('Black');
    await expect(card).toContainText('000000');
    await expect(card).toContainText('111111');

    let asked = '';
    page.removeAllListeners('dialog');
    page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
    await card.getByRole('button', { name: /^Reset / }).click();
    expect(asked).not.toBe('');
    await expect(card.getByRole('button', { name: /^Reset / })).toHaveCount(1);

    page.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: /^Reset / }).click();
    await expect(card.getByRole('button', { name: /^Reset / })).toHaveCount(0);
  });

  test('Clear all removes every override after a confirmation', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111');
    const card = await openSettings(page);
    page.removeAllListeners('dialog');
    page.once('dialog', (d) => d.dismiss());
    await card.getByRole('button', { name: 'Clear all' }).click();
    await expect(card.getByRole('button', { name: /^Reset / })).toHaveCount(1);
    page.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'Clear all' }).click();
    await expect(card.getByRole('button', { name: /^Reset / })).toHaveCount(0);
  });
});
