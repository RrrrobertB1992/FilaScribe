import { test, expect, colorStyle, colorTab, openCustom, lastWrite, chip, writeTag, status, openCards, readFrom } from './nfc.js';

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
    await expect(panel(page).getByRole('button', { name: /^Edit / })).toBeVisible();
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

  test('saved colors ignore the variant: one row, shown under any variant', async ({ page }) => {
    await setColors(page, '334455');
    await chip(page, 'Matte').click();
    await writeTag(page);
    await chip(page, 'Silk').click();
    await writeTag(page);
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*1/);
    await chip(page, 'None').click();
    await colorTab(page, 'Saved').click();
    await expect(tiles(page)).toHaveCount(1);
    await expect(tiles(page).first()).not.toContainText('Matte');
    await expect(panel(page).getByRole('button', { name: /^Remove “/ })).toHaveCount(0);
  });

  test('Edit changes one color and the name; Cancel changes nothing; the form follows Save', async ({ page }) => {
    await setColors(page, '111111', '222222');
    await save(page).click();
    await colorTab(page, 'Saved').click();
    await tiles(page).first().click();
    await panel(page).getByRole('button', { name: /^Edit / }).click();
    const editor = panel(page).getByRole('group', { name: 'Edit saved color' });
    await editor.getByRole('button', { name: /^Color 2,/ }).click();
    // The Hex box can be erased and typed into, one key at a time
    const hex = editor.getByLabel('Hex for color 2');
    await hex.fill('');
    await expect(hex).toHaveValue('');
    await hex.pressSequentially('333');
    await expect(hex).toHaveValue('333');
    await hex.fill('333333');
    await editor.getByLabel('Name').fill('Duo');

    // Nothing is touched until Save
    await editor.getByRole('button', { name: 'Cancel' }).click();
    await expect(editor).toHaveCount(0);
    await expect(tiles(page).first()).toContainText('222222');
    await expect(tiles(page).first()).not.toContainText('Duo');

    await panel(page).getByRole('button', { name: /^Edit / }).click();
    await editor.getByRole('button', { name: /^Color 2,/ }).click();
    await editor.getByLabel('Hex for color 2').fill('333333');
    await editor.getByLabel('Name').fill('Duo');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(status(page)).toHaveText('Saved color updated');
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*1/); // updated, not added
    await expect(tiles(page).first()).toContainText('111111');
    await expect(tiles(page).first()).toContainText('333333');
    await expect(tiles(page).first()).toContainText('Duo');
    await expect(tiles(page).first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#111111 + #333333 · Segments');

    // + adds a color and shows the style buttons; − takes the last one off
    await panel(page).getByRole('button', { name: /^Edit / }).click();
    await editor.getByRole('button', { name: 'Add a color' }).click();
    await expect(editor.getByRole('button', { name: /^Color 3,/ })).toBeVisible();
    await editor.getByRole('button', { name: 'Gradient' }).click();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#111111 + #333333 + #333333 · Gradient');
    await panel(page).getByRole('button', { name: /^Edit / }).click();
    await editor.getByRole('button', { name: 'Remove the last color' }).click();
    await editor.getByRole('button', { name: 'Remove the last color' }).click();
    await expect(editor.getByRole('button', { name: 'Gradient' })).toHaveCount(0); // one color: no style
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#111111');
  });

  test('colors saved by a write are not edited by later changes', async ({ page }) => {
    await setColors(page, '666666');
    await writeTag(page); // saved and picked, but not by you
    await page.locator('#hex-input').fill('777777');
    await writeTag(page);
    await expect(colorTab(page, 'Saved')).toHaveText(/Saved\s*2/);
  });

  test('rename, remove a row, clear', async ({ page }) => {
    await setColors(page, '101010');
    await chip(page, 'Basic').click();
    await writeTag(page); // saved + picked
    await colorTab(page, 'Saved').click();

    await panel(page).getByRole('button', { name: /^Edit / }).click();
    await panel(page).getByLabel('Name').fill('Charcoal');
    await panel(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(tiles(page).first()).toContainText('Charcoal');
    await expect(page.locator('.colorsec .now-name')).toHaveText('Charcoal');

    // Removing the last one turns Saved off and opens another source
    await panel(page).getByRole('button', { name: /^Edit / }).click();
    await panel(page).getByRole('button', { name: 'Remove', exact: true }).click();
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
    await readFrom(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Polymaker', color_hex: '5A5A5A' });
    await openCards(page);
    await expect(colorTab(page, 'Saved')).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page).getByRole('button', { name: /^Edit / })).toBeVisible();
    await expect(page.locator('#hex-input')).toBeHidden();
  });

  test('import a saved-colors file and export it again', async ({ page }) => {
    // Import works from Custom too, since Saved is off while it's empty
    const file = {
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
      name: 'filascribe-saved-colors.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)),
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
