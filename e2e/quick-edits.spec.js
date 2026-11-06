import { test, expect, placeTag, lastWrite, writeCount, status, temps } from './nfc.js';

const TAG = {
  protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Generic', color_hex: 'FF0000',
  min_temp: '190', max_temp: '220', weight: '1000',
};
const PLAIN_TAG = { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Generic', color_hex: 'FF0000', min_temp: '190', max_temp: '220' };

const card = (page) => page.getByRole('region', { name: 'Quick edits' });
const weight = (page) => card(page).getByLabel('Weight', { exact: true });
const nozzle = (page, which) => card(page).getByLabel(`Nozzle ${which}`, { exact: true });
const tap = (page, name) => card(page).getByRole('button', { name, exact: true }).click();
const changes = (page) => card(page).getByRole('list', { name: 'Changes' });

async function readTag(page) {
  await page.getByRole('button', { name: /^Read (tag|another)$/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test.describe('Quick edits', () => {
  test('shows on Read & update after a read, and not before or on Create', async ({ page }) => {
    await expect(card(page)).toHaveCount(0);
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await expect(card(page)).toHaveCount(0);
    await placeTag(page, TAG);
    await readTag(page);
    await expect(card(page)).toBeVisible();
    await expect(weight(page)).toHaveValue('1000');
    await expect(nozzle(page, 'min')).toHaveValue('190');
    await expect(nozzle(page, 'max')).toHaveValue('220');
    await page.getByRole('tab', { name: 'Create' }).click();
    await expect(card(page)).toHaveCount(0);
  });

  test('weight changes by 10 and by 50', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, TAG);
    await readTag(page);
    await tap(page, 'Weight plus 10');
    await expect(weight(page)).toHaveValue('1010');
    await tap(page, 'Weight plus 50');
    await expect(weight(page)).toHaveValue('1060');
    await tap(page, 'Weight minus 50');
    await expect(weight(page)).toHaveValue('1010');
    await tap(page, 'Weight minus 10');
    await expect(weight(page)).toHaveValue('1000');
  });

  test('weight stops at 0', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { ...TAG, weight: '30' });
    await readTag(page);
    await tap(page, 'Weight minus 50');
    await expect(weight(page)).toHaveValue('0');
    await tap(page, 'Weight minus 10');
    await expect(weight(page)).toHaveValue('0');
  });

  test('temperatures change by 5 and the cards below agree', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, TAG);
    await readTag(page);
    await tap(page, 'Nozzle max plus 5');
    await tap(page, 'Nozzle min minus 5');
    await expect(nozzle(page, 'max')).toHaveValue('225');
    await expect(nozzle(page, 'min')).toHaveValue('185');
    const fold = page.locator('details[data-fold="temps"]');
    if (!(await fold.evaluate((d) => d.open))) await fold.locator('summary').click();
    await expect(temps(page, 'Nozzle').min).toHaveValue('185');
    await expect(temps(page, 'Nozzle').max).toHaveValue('225');
  });

  test('typing a number works too', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, TAG);
    await readTag(page);
    await weight(page).fill('850');
    await expect(changes(page)).toContainText('850 g');
    await tap(page, 'Weight plus 10');
    await expect(weight(page)).toHaveValue('860');
  });

  test('lists what changed, with the old value, and Undo changes puts it back', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, TAG);
    await readTag(page);
    await expect(changes(page)).toHaveCount(0);
    await expect(card(page).getByRole('button', { name: 'Undo changes' })).toHaveCount(0);

    await tap(page, 'Weight minus 50');
    await tap(page, 'Weight minus 50');
    await tap(page, 'Nozzle max plus 5');
    await expect(changes(page)).toContainText('Weight');
    await expect(changes(page)).toContainText('900 g');
    await expect(changes(page)).toContainText('was 1000 g');
    await expect(changes(page)).toContainText('Nozzle max');
    await expect(changes(page)).toContainText('225 °C');
    await expect(changes(page)).toContainText('was 220 °C');

    await card(page).getByRole('button', { name: 'Undo changes' }).click();
    await expect(weight(page)).toHaveValue('1000');
    await expect(nozzle(page, 'max')).toHaveValue('220');
    await expect(changes(page)).toHaveCount(0);
    await expect(card(page).getByRole('button', { name: 'Undo changes' })).toHaveCount(0);
  });

  test('a change put back by hand leaves the list', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, TAG);
    await readTag(page);
    await tap(page, 'Weight plus 10');
    await expect(changes(page)).toBeVisible();
    await tap(page, 'Weight minus 10');
    await expect(changes(page)).toHaveCount(0);
  });

  test('Update tag writes the quick edits, and nothing is written before', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, TAG);
    await readTag(page);
    await tap(page, 'Weight minus 50');
    await tap(page, 'Nozzle min plus 5');
    await tap(page, 'Nozzle max plus 5');
    expect(await writeCount(page)).toBe(0);
    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(status(page)).toHaveText('Tag written.');
    const written = await lastWrite(page);
    expect(written.weight).toBe('950');
    expect(written.min_temp).toBe('195');
    expect(written.max_temp).toBe('225');
  });

  test('a weight that is not set starts at 1000 g and can not go down', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, { ...TAG, weight: undefined, bed_min_temp: '60', bed_max_temp: '70' }); // a U1 tag without weight
    await readTag(page);
    await expect(weight(page)).toHaveValue('');
    await expect(weight(page)).toHaveAttribute('placeholder', 'not set');
    await expect(card(page).getByRole('button', { name: 'Weight minus 10' })).toBeDisabled();
    await expect(card(page).getByRole('button', { name: 'Weight minus 50' })).toBeDisabled();
    await tap(page, 'Weight plus 10');
    await expect(weight(page)).toHaveValue('1000');
    await expect(changes(page)).toContainText('was not set');
    await card(page).getByRole('button', { name: 'Undo changes' }).click();
    await expect(weight(page)).toHaveValue('');
  });

  test('a tag without U1 fields shows no weight, only a hint', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, PLAIN_TAG);
    await readTag(page);
    await expect(card(page)).toBeVisible();
    await expect(weight(page)).toHaveCount(0);
    await expect(card(page)).toContainText('Turn on Snapmaker U1 fields to edit the weight.');
    await tap(page, 'Nozzle max plus 5');
    await expect(nozzle(page, 'max')).toHaveValue('225');
    // Turning the U1 fields on brings the weight row in
    await page.getByRole('button', { name: '+ Snapmaker U1 fields' }).click();
    await expect(weight(page)).toBeVisible();
  });

  test('a min above the max shows the usual message in the card', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, TAG);
    await readTag(page);
    await nozzle(page, 'min').fill('300');
    await expect(card(page)).toContainText('Nozzle max is below nozzle min.');
  });

  test('Read another starts again from the new tag', async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
    await placeTag(page, TAG);
    await readTag(page);
    await tap(page, 'Weight plus 50');
    await expect(changes(page)).toBeVisible();
    await placeTag(page, { ...TAG, weight: '500' });
    await readTag(page);
    await expect(weight(page)).toHaveValue('500');
    await expect(changes(page)).toHaveCount(0);
    await tap(page, 'Weight plus 10');
    await card(page).getByRole('button', { name: 'Undo changes' }).click();
    await expect(weight(page)).toHaveValue('500');
  });
});
