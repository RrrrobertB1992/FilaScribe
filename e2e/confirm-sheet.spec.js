import { test, expect, confirmSheet, answer, settingsCard } from './nfc.js';

// The sheet that replaced the browser's confirm() pop-ups. Each question has its
// own tests for the Yes and No paths; this one is about how the sheet itself answers.
test('the confirm sheet: Cancel has the focus, and Escape or a tap outside say No', async ({ page }) => {
  const card = await settingsCard(page, 'Brands');
  const sunlu = card.getByRole('button', { name: 'Hide SUNLU' });
  await sunlu.click();
  await expect(sunlu).toHaveCount(0);
  const reset = card.getByRole('button', { name: 'Show the default brands' });

  await reset.click();
  await expect(confirmSheet(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmSheet(page)).toBeHidden();
  await expect(sunlu).toHaveCount(0);

  await reset.click();
  await page.mouse.click(10, 10); // the dim area above the sheet
  await expect(confirmSheet(page)).toBeHidden();
  await expect(sunlu).toHaveCount(0);

  await reset.click();
  await answer(page, true);
  await expect(sunlu).toBeVisible();
});
