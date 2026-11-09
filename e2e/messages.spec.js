import { test, expect, status, temps, writeTag } from './nfc.js';

// A message that isn't an error fades by itself; an error stays until you clear it.
// (The order and the cap are checked in tests/messages.test.js.)
test.describe('Messages', () => {
  test('a good message fades by itself, an error stays until you press ×', async ({ page }) => {
    await page.clock.install();

    await writeTag(page);
    await expect(status(page)).toHaveText('Tag written.');
    await page.clock.fastForward('00:06');
    await expect(status(page)).toHaveCount(0);

    await temps(page, 'Nozzle').min.fill('240');
    await temps(page, 'Nozzle').max.fill('220');
    await page.getByRole('button', { name: 'Write tag' }).click();
    await expect(status(page)).toContainText('Fix the highlighted field');
    await page.clock.fastForward('01:00');
    await expect(status(page)).toContainText('Fix the highlighted field');
    await status(page).getByRole('button', { name: 'Dismiss message' }).click();
    await expect(status(page)).toHaveCount(0);
  });
});
