import { test, expect, placeTag, readTag, writeCount } from './nfc.js';

const TAG = { protocol: 'openspool', version: '1.0', type: 'PLA', color_hex: 'FF0000', brand: 'Generic', min_temp: '190', max_temp: '220' };

// Erasing is tied to the tag you read by its UID, which only the Android app can
// enforce. Web NFC writes to whichever tag it meets first, so the website must not offer it.
test('the website does not offer Erase this tag', async ({ page }) => {
  await page.getByRole('tab', { name: 'Tag' }).click();
  await placeTag(page, TAG);
  await readTag(page);
  await expect(page.getByRole('button', { name: 'Update this tag' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erase this tag' })).toHaveCount(0);
  expect(await writeCount(page)).toBe(0);
});
