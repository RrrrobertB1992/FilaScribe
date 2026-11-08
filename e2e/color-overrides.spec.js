import { test, expect, chip, settingsCard, brandPanel, brandTile } from './nfc.js';

// Bambu Lab PLA Basic Black is #000000 in the bundled database snapshot
const header = (page) => page.locator('.colorsec');
const box = (page) => page.getByRole('group', { name: 'Edit brand color' });
const editBtn = (page, name = 'Black') => brandPanel(page).getByRole('button', { name: new RegExp(`^Edit ${name}`) });

async function pickBlack(page) {
  await chip(page, 'Bambu Lab').click();
  await chip(page, 'Basic').click();
  await brandTile(page, 'Black').click();
}

async function override(page, hex, { all = false } = {}) {
  await editBtn(page).click();
  await box(page).getByLabel('Hex for color 1').fill(hex);
  if (all) await box(page).getByRole('checkbox').check();
  await box(page).getByRole('button', { name: 'Override' }).click();
}

test.describe('Color overrides', () => {
  test('every tile has an Edit button that picks it and opens the editor under it', async ({ page }) => {
    await chip(page, 'Bambu Lab').click();
    await chip(page, 'Basic').click();
    await expect(box(page)).toHaveCount(0);
    await expect(brandTile(page, 'Black')).toHaveAttribute('aria-pressed', 'false');
    await editBtn(page).click();
    await expect(brandTile(page, 'Black')).toHaveAttribute('aria-pressed', 'true');
    await expect(box(page)).toBeVisible();
    await expect(box(page).getByRole('button', { name: 'Reset to database' })).toHaveCount(0); // nothing to reset yet
    await expect(brandPanel(page).getByRole('button', { name: /^Show all Bambu Lab/ })).toBeVisible();
  });

  test('saving changes the color, marks it and the Colors card', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111');
    await expect(box(page)).toHaveCount(0);
    await expect(brandTile(page, 'Black')).toContainText('Edited');
    await expect(brandTile(page, 'Black')).toContainText('111111');
    await expect(header(page).locator('.now-name')).toHaveText('Black (#000000)');
    await expect(header(page).locator('.now-hex')).toHaveText('#111111');
    await expect(header(page).locator('.swatch.edited')).toBeVisible();
    await editBtn(page).click();
    await expect(box(page).getByRole('button', { name: 'Reset to database' })).toBeVisible();
  });

  test('the Hex box can be erased and typed into', async ({ page }) => {
    await chip(page, 'Bambu Lab').click();
    await chip(page, 'Basic').click();
    await editBtn(page).click();
    const hex = box(page).getByLabel('Hex for color 1');
    await hex.fill('');
    await expect(hex).toHaveValue('');
    await hex.pressSequentially('336699');
    await expect(hex).toHaveValue('336699');
    await expect(box(page).getByRole('button', { name: /^Color 1, #336699/ })).toBeVisible();
  });

  test('a bad hex is refused', async ({ page }) => {
    await pickBlack(page);
    await editBtn(page).click();
    await box(page).getByLabel('Hex for color 1').fill('12');
    await expect(box(page)).toContainText('3 or 6 hex digits');
    await box(page).getByRole('button', { name: 'Override' }).click();
    await expect(box(page)).toBeVisible(); // nothing saved
    await expect(brandTile(page, 'Black')).not.toContainText('Edited');
  });

  test('stays after a reload, and an old tag with the database hex still matches', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111');
    await page.reload();
    await chip(page, 'Bambu Lab').click();
    await chip(page, 'Basic').click();
    await expect(brandTile(page, 'Black')).toContainText('Edited');
    await expect(brandTile(page, 'Black')).toContainText('111111');
  });

  test('“other lines” changes the same color in every line', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111', { all: true });
    await brandPanel(page).getByRole('button', { name: /^Show all Bambu Lab/ }).click();
    await brandPanel(page).getByRole('group', { name: 'Filament lines' }).getByRole('button', { name: 'PLA Tough+', exact: true }).click();
    await expect(brandTile(page, 'Black')).toContainText('Edited');
    await expect(brandTile(page, 'Black')).toContainText('111111');
  });

  test('Reset to database asks first, then gives the database color back', async ({ page }) => {
    await pickBlack(page);
    await override(page, '111111');
    let asked = '';
    page.removeAllListeners('dialog');
    page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
    await editBtn(page).click();
    await box(page).getByRole('button', { name: 'Reset to database' }).click();
    expect(asked).not.toBe('');
    await expect(brandTile(page, 'Black')).toContainText('Edited');
    page.once('dialog', (d) => d.accept());
    await box(page).getByRole('button', { name: 'Reset to database' }).click();
    await expect(brandTile(page, 'Black')).not.toContainText('Edited');
    await expect(header(page).locator('.now-name')).toHaveText('Black');
  });
});

test.describe('Color overrides in Settings', () => {
  const openSettings = (page) => settingsCard(page, 'Color overrides');

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
