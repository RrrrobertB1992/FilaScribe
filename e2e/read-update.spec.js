import { test, expect, placeTag, lastWrite, writeCount, chip, status, temps } from './nfc.js';

const U1_TAG = {
  protocol: 'openspool', version: '1.0', type: 'PETG', subtype: 'Rapid', color_hex: '#AFAFAF',
  additional_color_hexes: ['EEFFEE', 'FF00FF'], color_type: 0, brand: 'Elegoo',
  min_temp: 230, max_temp: 260, bed_min_temp: '70', bed_max_temp: '80', spool_id: 7,
};

async function readTag(page) {
  await page.getByRole('button', { name: /^Read (tag|another)$/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test.describe('Read & update', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('tab', { name: 'Read & update' }).click();
  });

  test('starts by asking for a tag', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Read a tag to change it' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Read tag' })).toBeVisible();
  });

  test('reads a U1 tag into the form', async ({ page }) => {
    await placeTag(page, U1_TAG);
    await readTag(page);
    await expect(status(page)).toHaveText('Tag read. Change what you need, then update the tag.');
    await expect(chip(page, 'OpenSpool + Snapmaker U1 fields')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'PETG')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Custom brand')).toHaveValue('Elegoo');
    await expect(page.getByLabel('Custom variant')).toHaveValue('Rapid');
    await expect(page.getByRole('button', { name: /^Color \d,/ })).toHaveCount(3);
    await expect(chip(page, 'Gradient')).toHaveAttribute('aria-pressed', 'true');
    await expect(temps(page, 'Nozzle').min).toHaveValue('230');
    await expect(temps(page, 'Bed').max).toHaveValue('80');
    await expect(page.locator('.notice')).toContainText('Not in the spec: spool_id.');
    await expect(page.getByText('UID')).toBeVisible();
  });

  test('updates the tag and drops undocumented fields', async ({ page }) => {
    await placeTag(page, U1_TAG);
    await readTag(page);
    await chip(page, 'HF').click();
    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(status(page)).toHaveText('Tag written.');
    const data = await lastWrite(page);
    expect(data).toEqual({
      protocol: 'openspool', version: '1.0', type: 'PETG', color_hex: 'AFAFAF',
      additional_color_hexes: ['EEFFEE', 'FF00FF'], color_type: 0, brand: 'Elegoo',
      min_temp: '230', max_temp: '260', bed_min_temp: '70', bed_max_temp: '80', subtype: 'HF',
    });
    await expect(page.locator('.notice')).toBeHidden();
  });

  test('a standard tag stays standard', async ({ page }) => {
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'PLA', color_hex: 'FFAABB', brand: 'Generic', min_temp: '220', max_temp: '240' });
    await readTag(page);
    await expect(chip(page, 'OpenSpool (standard)')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Update tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(JSON.stringify(await lastWrite(page))).toBe(
      '{"protocol":"openspool","version":"1.0","type":"PLA","color_hex":"FFAABB","brand":"Generic","min_temp":"220","max_temp":"240"}',
    );
  });

  test('a blank tag points to Create', async ({ page }) => {
    await placeTag(page, 'blank');
    await readTag(page);
    await expect(status(page)).toContainText('This tag is blank.');
    await expect(page.getByRole('button', { name: 'Read tag' })).toBeVisible();
  });

  test('an unreadable tag says so', async ({ page }) => {
    await placeTag(page, 'unreadable');
    await readTag(page);
    await expect(status(page)).toContainText('couldn’t be read as NDEF');
  });

  test('other JSON or broken JSON is not loaded', async ({ page }) => {
    await placeTag(page, { protocol: 'tigertag', type: 'PLA' });
    await readTag(page);
    await expect(status(page)).toContainText('Not an OpenSpool tag');
    await placeTag(page, '{"protocol": "openspool",');
    await readTag(page);
    await expect(status(page)).toContainText('isn’t valid JSON');
    await placeTag(page, [{ recordType: 'url', mediaType: undefined, data: 'https://example.com' }]);
    await readTag(page);
    await expect(status(page)).toContainText('doesn’t hold an OpenSpool record');
    expect(await writeCount(page)).toBe(0);
  });

  test('finds the OpenSpool record among several', async ({ page }) => {
    await placeTag(page, [
      { recordType: 'url', mediaType: undefined, data: 'https://openspool.io' },
      { data: JSON.stringify({ protocol: 'openspool', version: '1.0', type: 'ASA', color_hex: '000000' }) },
    ]);
    await readTag(page);
    await expect(chip(page, 'ASA')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Read another loads the next tag', async ({ page }) => {
    await placeTag(page, U1_TAG);
    await readTag(page);
    await placeTag(page, { protocol: 'openspool', version: '1.0', type: 'TPU', color_hex: '123456' });
    await readTag(page);
    await expect(chip(page, 'TPU')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Color \d,/ })).toHaveCount(1);
  });

  test('cancelling a read keeps the current form', async ({ page }) => {
    await placeTag(page, null); // no tag near the phone
    await page.getByRole('button', { name: 'Read tag' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Read a tag to change it' })).toBeVisible();
  });

  test('a tag read can be copied onto a new tag from Create', async ({ page }) => {
    await placeTag(page, U1_TAG);
    await readTag(page);
    await page.getByRole('tab', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Write tag' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(await lastWrite(page)).toMatchObject({ type: 'PETG', brand: 'Elegoo', subtype: 'Rapid' });
  });
});
