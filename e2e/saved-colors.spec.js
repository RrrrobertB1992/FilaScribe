import { test, expect, colorStyle, colorTab, openCustom, placeTag, lastWrite, chip, writeTag, status } from './nfc.js';

const panel = (page) => page.locator('.saved');
const tiles = (page) => panel(page).getByRole('button', { pressed: undefined }).filter({ has: page.locator('.hex') });
const colorSlots = (page) => page.getByRole('button', { name: /^Color \d,/ });
const save = (page) => page.getByRole('button', { name: 'Save colors' });

async function setColors(page, ...hexes) {
  await page.locator('#hex-input').fill(hexes[0]);
  for (const h of hexes.slice(1)) {
    await page.getByRole('button', { name: 'Add a color' }).click();
    await page.locator('#hex-input').fill(h);
  }
}

test.describe('Saved colors', () => {
  test.beforeEach(async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await openCustom(page);
  });

  test('a successful write saves the colors and picks them', async ({ page }) => {
    await expect(colorTab(page, 'Saved')).toBeDisabled();
    await setColors(page, '112233');
    await writeTag(page);
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*1/);
    await expect(page.locator('.colorsec .now-from')).toHaveText('Saved color');
    await colorTab(page, 'Saved').click();
    await expect(page.locator('#hex-input')).toBeHidden();
    await expect(panel(page)).toContainText('1 saved color for Polymaker PLA');
    await expect(panel(page).getByRole('button', { name: 'Rename' })).toBeVisible();
  });

  test('saved colors belong to their brand + material and survive a reload', async ({ page }) => {
    await setColors(page, '112233');
    await save(page).click();
    await expect(status(page)).toHaveText('Colors saved');
    await chip(page, 'PETG').click();
    await expect(colorTab(page, 'Saved')).toBeDisabled();
    await page.reload();
    await chip(page, 'Polymaker').click();
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*1/);
  });

  test('picking a saved color fills the colors; unpicking puts them back', async ({ page }) => {
    await setColors(page, 'AA0000', '00AA00');
    await colorStyle(page, 'Gradient').click();
    await save(page).click();
    await page.getByRole('button', { name: 'Start over' }).click(); // back to white, brand Generic
    await chip(page, 'Polymaker').click();

    await colorTab(page, 'Saved').click();
    const tile = tiles(page).first();
    await expect(tile).toContainText('AA0000');
    await tile.click();
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ color_hex: 'AA0000', additional_color_hexes: ['00AA00'], color_type: 0 });

    await tile.click(); // unpick
    await colorTab(page, 'Custom').click();
    await expect(page.locator('#hex-input')).toHaveValue('FFFFFF');
    await expect(colorSlots(page)).toHaveCount(1);
  });

  test('gradient and segments of the same colors are separate rows', async ({ page }) => {
    await setColors(page, 'AA0000', '00AA00');
    await colorStyle(page, 'Gradient').click();
    await save(page).click();
    await colorStyle(page, 'Segments').click();
    await save(page).click();
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*2/);
  });

  test('the same colors under another variant add that variant', async ({ page }) => {
    await setColors(page, '334455');
    await chip(page, 'Matte').click();
    await writeTag(page);
    await chip(page, 'Silk').click();
    await page.locator('#hex-input').fill('334455');
    await writeTag(page);
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*1/);
    await colorTab(page, 'Saved').click();
    await expect(tiles(page).first()).toContainText('Matte, Silk');
  });

  test('rename, edit colors, remove a variant, remove a row, clear', async ({ page }) => {
    await setColors(page, '101010');
    await chip(page, 'Basic').click();
    await writeTag(page); // saved + picked
    await colorTab(page, 'Saved').click();

    await panel(page).getByRole('button', { name: 'Rename' }).click();
    await panel(page).getByLabel('Saved color name').fill('Charcoal');
    await panel(page).getByRole('button', { name: 'Save name' }).click();
    await expect(tiles(page).first()).toContainText('Charcoal');
    await expect(page.locator('.colorsec .now-name')).toHaveText('Charcoal');

    // Edit colors opens Custom with Save / Cancel for the saved color
    await panel(page).getByRole('button', { name: 'Edit colors' }).click();
    await expect(page.locator('.editbar')).toContainText('Editing saved color Charcoal');
    await page.locator('#hex-input').fill('202020');
    await page.locator('.editbar').getByRole('button', { name: 'Save colors' }).click();
    await expect(colorTab(page, 'Saved')).toHaveAttribute('aria-pressed', 'true');
    await expect(tiles(page).first()).toContainText('202020');
    await expect(tiles(page).first()).toContainText('Charcoal');

    // Cancel puts the saved colors back
    await panel(page).getByRole('button', { name: 'Edit colors' }).click();
    await page.locator('#hex-input').fill('999999');
    await page.locator('.editbar').getByRole('button', { name: 'Cancel' }).click();
    await expect(tiles(page).first()).toContainText('202020');
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#202020');

    // Removing the last one turns Saved off and opens another source
    await panel(page).getByRole('button', { name: 'Remove “Basic”' }).click();
    await expect(colorTab(page, 'Saved')).toBeDisabled();

    await openCustom(page);
    await setColors(page, '303030');
    await save(page).click();
    await colorTab(page, 'Saved').click();
    await panel(page).getByRole('button', { name: 'Remove color' }).click();
    await expect(colorTab(page, 'Saved')).toBeDisabled();

    await openCustom(page);
    await save(page).click();
    await page.locator('#hex-input').fill('404040');
    await save(page).click();
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*2/);
    await colorTab(page, 'Saved').click();
    await panel(page).getByRole('button', { name: 'Clear Polymaker PLA' }).click();
    await expect(colorTab(page, 'Saved')).toBeDisabled();
  });

  test('reading a tag with saved colors picks them', async ({ page }) => {
    await setColors(page, '5A5A5A');
    await save(page).click();
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Polymaker', color_hex: '5A5A5A' });
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(colorTab(page, 'Saved')).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page).getByRole('button', { name: 'Rename' })).toBeVisible();
    await expect(page.locator('#hex-input')).toBeHidden();
  });

  test('import a PrintTag-Web-Rrrrobert list and export it again', async ({ page }) => {
    // Import works from Custom too, since Saved is off while it's empty
    const fork = {
      'Polymaker|PLA': [
        { colors: ['2B2B2D'], name: 'Galaxy Black', variants: ['Matte'] },
        { colors: ['FF0000', '0000FF'], name: '', variants: [''], colorType: '0' },
      ],
      'Generic|PETG': [{ colors: ['ABCDEF'], name: '', variants: ['Basic'] }],
    };
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Import saved colors' }).click(),
    ]);
    await chooser.setFiles({
      name: 'printtag-saved-colors.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fork)),
    });
    await expect(status(page)).toHaveText('Imported 3 saved colors.');
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*2/);
    await colorTab(page, 'Saved').click();
    await expect(panel(page)).toContainText('Galaxy Black');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel(page).getByRole('button', { name: 'Export all saved colors' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('filascribe-saved-colors.json');
    const exported = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));
    expect(exported['Generic|PETG'][0].colors).toEqual(['ABCDEF']);
    expect(exported['Polymaker|PLA']).toHaveLength(2);

    await panel(page).locator('input[type=file]').setInputFiles({
      name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json'),
    });
    await expect(status(page)).toHaveText('That file isn’t a saved-colors export.');
  });
});
