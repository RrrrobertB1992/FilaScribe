import { test, expect, chip, placeTag, writeCount, lastWrite, status, temps } from './nfc.js';

const count = (page) => page.locator('.series');
const writeAnother = (page) => page.getByRole('button', { name: 'Write another tag' });
const done = (page) => page.getByRole('button', { name: 'Done', exact: true });
const writeButton = (page) => page.getByRole('button', { name: 'Write tag', exact: true });

/** Tap Write tag / Write another tag and wait for the sheet to close. */
async function write(page, button) {
  await button.click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test.describe('Write several tags in a row', () => {
  test('after a write, offers Write another tag and counts each one', async ({ page }) => {
    await expect(count(page)).toHaveCount(0);
    await write(page, writeButton(page));
    await expect(status(page)).toHaveText('Tag written.');
    await expect(count(page)).toHaveText('1 tag written for this spool');
    await expect(writeButton(page)).toHaveCount(0);
    await expect(done(page)).toBeVisible();

    await write(page, writeAnother(page));
    await expect(count(page)).toHaveText('2 tags written for this spool');
    await write(page, writeAnother(page));
    await expect(count(page)).toHaveText('3 tags written for this spool');
    expect(await writeCount(page)).toBe(3);
  });

  test('every tag gets the same data, with nothing re-entered', async ({ page }) => {
    await chip(page, 'PETG').click();
    await write(page, writeButton(page));
    const first = await lastWrite(page);
    await write(page, writeAnother(page));
    expect(await lastWrite(page)).toEqual(first);
    expect(first.type).toBe('PETG');
  });

  test('the write sheet says which tag of the spool it is', async ({ page }) => {
    await write(page, writeButton(page));
    await page.evaluate(() => { window.__tapDelay = 600; });
    await writeAnother(page).click();
    await expect(page.getByRole('dialog')).toContainText('Tag 2 of this spool');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(count(page)).toHaveText('2 tags written for this spool');
  });

  test('the first write has no tag number on the sheet', async ({ page }) => {
    await page.evaluate(() => { window.__tapDelay = 600; });
    await writeButton(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).not.toContainText('of this spool');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('Done goes back to the plain Write tag button', async ({ page }) => {
    await write(page, writeButton(page));
    await done(page).click();
    await expect(count(page)).toHaveCount(0);
    await expect(writeAnother(page)).toHaveCount(0);
    await expect(writeButton(page)).toBeVisible();
    // The form is as it was
    await write(page, writeButton(page));
    await expect(count(page)).toHaveText('1 tag written for this spool');
  });

  test('changing the form starts a new count', async ({ page }) => {
    await write(page, writeButton(page));
    await write(page, writeAnother(page));
    await expect(count(page)).toHaveText('2 tags written for this spool');

    await chip(page, 'PETG').click();
    await expect(count(page)).toHaveCount(0);
    await expect(writeButton(page)).toBeVisible();
    await write(page, writeButton(page));
    await expect(count(page)).toHaveText('1 tag written for this spool');
  });

  test('changing a temperature starts a new count too', async ({ page }) => {
    await write(page, writeButton(page));
    await temps(page, 'Nozzle').max.fill('231');
    await expect(count(page)).toHaveCount(0);
    await expect(writeButton(page)).toBeVisible();
  });

  test('Start over and switching tabs end the series', async ({ page }) => {
    await write(page, writeButton(page));
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(count(page)).toHaveCount(0);

    await write(page, writeButton(page));
    await expect(count(page)).toHaveText('1 tag written for this spool');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(count(page)).toHaveCount(0);
    await expect(writeButton(page)).toBeVisible();
  });

  test('a write that fails is not counted', async ({ page }) => {
    await write(page, writeButton(page));
    await page.evaluate(() => { window.__nextError = 'NetworkError'; });
    await writeAnother(page).click();
    await expect(status(page)).toContainText('The tag moved away before it finished');
    await expect(count(page)).toHaveText('1 tag written for this spool');
    expect(await writeCount(page)).toBe(1);
    // And the next try works
    await write(page, writeAnother(page));
    await expect(count(page)).toHaveText('2 tags written for this spool');
  });

  test('a form with a problem is not written and not counted', async ({ page }) => {
    await write(page, writeButton(page));
    await temps(page, 'Nozzle').min.fill('999');
    await expect(writeButton(page)).toBeVisible(); // the form changed, so the series ended
    await writeButton(page).click();
    await expect(status(page)).toContainText('Fix');
    expect(await writeCount(page)).toBe(1);
    await expect(count(page)).toHaveCount(0);
  });

  test('Read & update keeps its own buttons', async ({ page }) => {
    await write(page, writeButton(page));
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', color_hex: 'FF0000', brand: 'Generic', min_temp: '190', max_temp: '220' });
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await page.getByRole('button', { name: 'Read tag' }).click();
    await expect(page.getByRole('button', { name: 'Update tag' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Read another' })).toBeVisible();
    await expect(writeAnother(page)).toHaveCount(0);
    await expect(count(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(status(page)).toHaveText('Tag written.');
    await expect(count(page)).toHaveCount(0);
    await expect(writeAnother(page)).toHaveCount(0);
  });
});
