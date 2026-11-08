import { test, expect, chip, goCreate, lastWrite, openSettingsGroup, settingsCard, status, temps, writeTag } from './nfc.js';

const settings = (page) => page.getByRole('tab', { name: 'Settings' }).click();

test.describe('Settings', () => {
  test('a Settings tab next to Create and Read & update, with no write button', async ({ page }) => {
    await settings(page);
    await expect(page.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Write tag' })).toHaveCount(0);
    await goCreate(page);
    await expect(page.getByRole('button', { name: 'Write tag' })).toBeVisible();
  });
  const GROUPS = {
    'Your choices on the form': ['Defaults for new tags', 'Brands', 'Materials', 'Variants', 'Your chips'],
    'Your saved data': ['My filaments', 'Saved colors', 'Backup'],
    'Brand colors': ['Color database', 'Color overrides', 'Closest brand colors'],
    App: ['Appearance', 'About'],
  };
  const row = (page, name) => page.getByRole('button', { name: new RegExp(`^${name}`) });
  test('Settings opens to a menu of four groups that name their cards, with no cards yet', async ({ page }) => {
    await settings(page);
    for (const [name, cards] of Object.entries(GROUPS)) {
      await expect(row(page, name)).toBeVisible();
      // the menu says Defaults for the card called Defaults for new tags
      await expect(row(page, name)).toContainText(cards.join(', ').replace('Defaults for new tags', 'Defaults'));
    }
    await expect(page.locator('details.card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '‹ Settings' })).toHaveCount(0);
  });
  test('a group opens its own cards, and ‹ Settings goes back to the menu', async ({ page }) => {
    await settings(page);
    for (const [name, cards] of Object.entries(GROUPS)) {
      await row(page, name).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      for (const h of cards) await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
      await expect(page.locator('details.card')).toHaveCount(cards.length);
      await page.getByRole('button', { name: '‹ Settings' }).click();
      await expect(page.locator('details.card')).toHaveCount(0);
    }
  });
  test('every card is in exactly one group', async ({ page }) => {
    await settings(page);
    const seen = [];
    for (const name of Object.keys(GROUPS)) {
      await row(page, name).click();
      seen.push(...(await page.locator('details.card h2').allTextContents()));
      await page.getByRole('button', { name: '‹ Settings' }).click();
    }
    expect(seen.sort()).toEqual(Object.values(GROUPS).flat().sort());
  });
  test('leaving Settings and coming back starts at the menu', async ({ page }) => {
    await settings(page);
    await row(page, 'App').click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    await goCreate(page);
    await settings(page);
    await expect(row(page, 'App')).toBeVisible();
    await expect(page.locator('details.card')).toHaveCount(0);
  });
  test('a card you opened is still open when you come back to its group', async ({ page }) => {
    const about = await settingsCard(page, 'About');
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
    await page.getByRole('button', { name: '‹ Settings' }).click();
    await row(page, 'App').click();
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
  });
  test('a restore you started is dropped when you leave its page', async ({ page }) => {
    const backup = await settingsCard(page, 'Backup');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), backup.getByRole('button', { name: 'Restore backup' }).click()]);
    await chooser.setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'FilaScribe backup', version: 1, data: {} })) });
    await expect(backup.getByRole('button', { name: 'Replace everything' })).toBeVisible();
    await page.getByRole('button', { name: '‹ Settings' }).click();
    await row(page, 'Your saved data').click();
    await expect(backup.getByRole('button', { name: 'Replace everything' })).toHaveCount(0);
    await expect(backup.getByRole('button', { name: 'Restore backup' })).toBeVisible();
  });
  test('defaults: new tags and Start over use the saved form', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await chip(page, 'PETG').click();
    await temps(page, 'Nozzle').max.fill('245');
    await (await settingsCard(page, 'Defaults for new tags')).getByRole('button', { name: 'Use the form as it is now' }).click();
    await expect(status(page)).toHaveText('Saved. New tags start like this.');
    await expect((await settingsCard(page, 'Defaults for new tags'))).toContainText('Polymaker');
    await expect((await settingsCard(page, 'Defaults for new tags'))).toContainText('220–245 °C');

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
    await (await settingsCard(page, 'Defaults for new tags')).getByRole('button', { name: 'Reset to built-in' }).click();
    await goCreate(page);
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(chip(page, 'Generic')).toHaveAttribute('aria-pressed', 'true');
  });
  test('cards start closed, open with a tap, and stay open after a reload', async ({ page }) => {
    await openSettingsGroup(page, 'App');
    const about = page.locator('details.card', { has: page.getByRole('heading', { name: 'About' }) });
    await expect(about).not.toHaveAttribute('open', /.*/);
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeHidden();
    await about.locator('summary').click();
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
    await page.reload();
    await openSettingsGroup(page, 'App');
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
    await about.locator('summary').click();
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeHidden();
  });
  test('saved colors: listed per brand + material, cleared, imported and exported', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await page.getByRole('group', { name: 'Color source' }).getByRole('button', { name: /^Custom/ }).click();
    await page.getByRole('button', { name: 'Save colors' }).click();
    const saved = (await settingsCard(page, 'Saved colors'));
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
    await settingsCard(page, 'Appearance');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await chip(page, 'Dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg()).toBe('rgb(14, 16, 20)');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await settingsCard(page, 'Appearance');
    await chip(page, 'Light').click();
    expect(await bg()).toBe('rgb(246, 245, 243)');
    await chip(page, 'Follow the system').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  });
  test('about: version, specs and data sources', async ({ page }) => {
    const about = (await settingsCard(page, 'About'));
    await expect(about).toContainText('FilaScribe');
    await expect(about.getByRole('link', { name: 'Open Filament Database' })).toBeVisible();
    await expect(about.getByRole('link', { name: 'OrcaSlicer’s filament profiles' })).toBeVisible();
    await expect(about.getByRole('link', { name: 'RrrrobertB1992/FilaScribe' })).toHaveAttribute('href', 'https://github.com/RrrrobertB1992/FilaScribe');
  });
});
