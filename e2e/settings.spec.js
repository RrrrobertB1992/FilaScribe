import { test, expect, chip, writeTag, lastWrite, status, temps } from './nfc.js';

const settings = (page) => page.getByRole('tab', { name: 'Settings' }).click();
const card = (page, name) => page.locator('section.card', { has: page.getByRole('heading', { name }) });

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
    await card(page, 'Defaults for new tags').getByRole('button', { name: 'Use the form as it is now' }).click();
    await expect(status(page)).toHaveText('Saved. New tags start like this.');
    await expect(card(page, 'Defaults for new tags')).toContainText('Polymaker');
    await expect(card(page, 'Defaults for new tags')).toContainText('220–245 °C');

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
    await card(page, 'Defaults for new tags').getByRole('button', { name: 'Reset to built-in' }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(chip(page, 'Generic')).toHaveAttribute('aria-pressed', 'true');
  });

  test('your chips: listed and removable', async ({ page }) => {
    await page.getByRole('group', { name: 'Brand', exact: true }).getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom brand').fill('Zephyr');
    await page.getByRole('button', { name: 'Save brand as a chip' }).click();
    await settings(page);
    const chips = card(page, 'Your chips');
    await expect(chips.getByRole('group', { name: 'Your brands' })).toContainText('Zephyr');
    await chips.getByRole('button', { name: 'Remove Zephyr' }).click();
    await expect(chips).toContainText('None yet');
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(chip(page, 'Zephyr')).toHaveCount(0);
  });

  test('saved colors: listed per brand + material, cleared, imported and exported', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await page.getByRole('group', { name: 'Color source' }).getByRole('button', { name: /^Custom/ }).click();
    await page.getByRole('button', { name: 'Save colors' }).click();
    await settings(page);
    const saved = card(page, 'Saved colors');
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
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await chip(page, 'Dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg()).toBe('rgb(22, 26, 32)');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await settings(page);
    await chip(page, 'Light').click();
    expect(await bg()).toBe('rgb(230, 233, 237)');
    await chip(page, 'Follow the system').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  });

  test('about: version, specs and data sources', async ({ page }) => {
    await settings(page);
    const about = card(page, 'About');
    await expect(about).toContainText('FilaScribe');
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
    await expect(about.getByRole('link', { name: 'OrcaSlicer’s filament profiles' })).toBeVisible();
    await expect(about.getByRole('link', { name: 'RrrrobertB1992/FilaScribe' })).toHaveAttribute('href', 'https://github.com/RrrrobertB1992/FilaScribe');
  });
});
