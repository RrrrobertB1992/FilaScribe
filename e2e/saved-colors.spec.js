import { test, expect, colorStyle, placeTag, lastWrite, chip, writeTag, status } from './nfc.js';

const panel = (page) => page.locator('.saved');
const tiles = (page) => panel(page).getByRole('button', { pressed: undefined }).filter({ has: page.locator('.hex') });
const colorSlots = (page) => page.getByRole('button', { name: /^Color \d,/ });

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
  });

  test('a successful write saves the colors and picks them', async ({ page }) => {
    await expect(panel(page)).toContainText('Saved colors for Polymaker PLA (0)');
    await setColors(page, '112233');
    await writeTag(page);
    await expect(panel(page)).toContainText('Saved colors for Polymaker PLA (1)');
    // picked: the color pickers hide and the row's actions show
    await expect(page.locator('#hex-input')).toBeHidden();
    await expect(panel(page).getByRole('button', { name: 'Rename' })).toBeVisible();
  });

  test('saved colors belong to their brand + material and survive a reload', async ({ page }) => {
    await setColors(page, '112233');
    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    await expect(status(page)).toHaveText('Colors saved');
    await chip(page, 'PETG').click();
    await expect(panel(page)).toContainText('Saved colors for Polymaker PETG (0)');
    await page.reload();
    await chip(page, 'Polymaker').click();
    await expect(panel(page)).toContainText('Saved colors for Polymaker PLA (1)');
  });

  test('picking a saved color fills the colors; unpicking puts them back', async ({ page }) => {
    await setColors(page, 'AA0000', '00AA00');
    await colorStyle(page, 'Gradient').click();
    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    await page.getByRole('button', { name: 'Start over' }).click(); // back to white, brand Generic
    await chip(page, 'Polymaker').click();

    await panel(page).getByRole('button', { name: 'Show' }).click();
    const tile = tiles(page).first();
    await expect(tile).toContainText('AA0000');
    await tile.click();
    await expect(page.locator('#hex-input')).toBeHidden();
    await writeTag(page);
    expect(await lastWrite(page)).toMatchObject({ color_hex: 'AA0000', additional_color_hexes: ['00AA00'], color_type: 0 });

    await tile.click(); // unpick
    await expect(page.locator('#hex-input')).toHaveValue('FFFFFF');
    await expect(colorSlots(page)).toHaveCount(1);
  });

  test('gradient and segments of the same colors are separate rows', async ({ page }) => {
    await setColors(page, 'AA0000', '00AA00');
    await colorStyle(page, 'Gradient').click();
    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    await colorStyle(page, 'Segments').click();
    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    await expect(panel(page)).toContainText('(2)');
  });

  test('the same colors under another variant add that variant', async ({ page }) => {
    await setColors(page, '334455');
    await chip(page, 'Matte').click();
    await writeTag(page);
    await chip(page, 'Silk').click();
    await page.locator('.saved').getByRole('button', { name: 'Show' }).click();
    await tiles(page).first().click(); // unpick (was picked after the write)
    await page.locator('#hex-input').fill('334455');
    await writeTag(page);
    await expect(panel(page)).toContainText('(1)');
    await expect(tiles(page).first()).toContainText('Matte, Silk');
  });

  test('rename, edit colors, remove a variant, remove a row, clear', async ({ page }) => {
    await setColors(page, '101010');
    await chip(page, 'Basic').click();
    await writeTag(page); // saved + picked

    await panel(page).getByRole('button', { name: 'Rename' }).click();
    await panel(page).getByLabel('Saved color name').fill('Charcoal');
    await panel(page).getByRole('button', { name: 'Save name' }).click();
    await panel(page).getByRole('button', { name: 'Show' }).click();
    await expect(tiles(page).first()).toContainText('Charcoal');

    await panel(page).getByRole('button', { name: 'Edit colors' }).click();
    await page.locator('#hex-input').fill('202020');
    await panel(page).getByRole('button', { name: 'Save colors' }).click();
    await expect(tiles(page).first()).toContainText('202020');
    await expect(tiles(page).first()).toContainText('Charcoal');

    await panel(page).getByRole('button', { name: 'Remove “Basic”' }).click();
    await expect(panel(page)).toContainText('(0)');

    await setColors(page, '303030');
    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    // the list is still expanded from above
    await tiles(page).first().click();
    await panel(page).getByRole('button', { name: 'Remove color' }).click();
    await expect(panel(page)).toContainText('(0)');

    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    await page.locator('#hex-input').fill('404040');
    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    await expect(panel(page)).toContainText('(2)');
    await panel(page).getByRole('button', { name: 'Clear Polymaker PLA' }).click();
    await expect(panel(page)).toContainText('(0)');
  });

  test('reading a tag with saved colors picks them', async ({ page }) => {
    await setColors(page, '5A5A5A');
    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Polymaker', color_hex: '5A5A5A' });
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(panel(page).getByRole('button', { name: 'Rename' })).toBeVisible();
    await expect(page.locator('#hex-input')).toBeHidden();
  });

  test('import a PrintTag-Web-Rrrrobert list and export it again', async ({ page }) => {
    await panel(page).getByRole('button', { name: 'Save current colors' }).click();
    await panel(page).getByRole('button', { name: 'Show' }).click();
    const fork = {
      'Polymaker|PLA': [
        { colors: ['2B2B2D'], name: 'Galaxy Black', variants: ['Matte'] },
        { colors: ['FF0000', '0000FF'], name: '', variants: [''], colorType: '0' },
      ],
      'Generic|PETG': [{ colors: ['ABCDEF'], name: '', variants: ['Basic'] }],
    };
    await panel(page).locator('input[type=file]').setInputFiles({
      name: 'printtag-saved-colors.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fork)),
    });
    await expect(status(page)).toHaveText('Imported 3 saved colors.');
    await expect(panel(page)).toContainText('(3)');
    await expect(panel(page)).toContainText('Galaxy Black');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel(page).getByRole('button', { name: 'Export all saved colors' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('filascribe-saved-colors.json');
    const exported = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));
    expect(exported['Generic|PETG'][0].colors).toEqual(['ABCDEF']);
    expect(exported['Polymaker|PLA']).toHaveLength(3);

    await panel(page).locator('input[type=file]').setInputFiles({
      name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json'),
    });
    await expect(status(page)).toHaveText('That file isn’t a saved-colors export.');
  });
});
