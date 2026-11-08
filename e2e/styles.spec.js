import { test, expect, openSettingsGroup, chip, openCustom } from './nfc.js';

// The look is shared: every button has an outline (none looks like plain text),
// and every corner is the shared one.
const GROUPS = ['Your choices on the form', 'Your saved data', 'Brand colors', 'App'];

const buttonLooks = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.btn')].map((b) => {
      const s = getComputedStyle(b);
      return { text: b.textContent.trim(), radius: s.borderTopLeftRadius, width: s.borderTopWidth, color: s.borderTopColor };
    }),
  );

const openAllCards = (page) => page.evaluate(() => document.querySelectorAll('details.card').forEach((d) => (d.open = true)));

function expectOutlined(looks) {
  expect(looks.length).toBeGreaterThan(0);
  for (const b of looks) {
    expect(b.width, `${b.text} has an outline`).toBe('1px');
    expect(b.color, `${b.text} outline shows`).not.toBe('rgba(0, 0, 0, 0)');
    expect(b.radius, `${b.text} uses the shared corner`).toBe('8px');
  }
}

test.describe('One look for every control', () => {
  test('buttons on Create all have an outline and the same corners', async ({ page }) => {
    await chip(page, 'Bambu Lab').click();
    await chip(page, 'Basic').click();
    await openCustom(page);
    await page.locator('#hex-input').fill('0A2A8C');
    expectOutlined(await buttonLooks(page));
  });

  for (const group of GROUPS) {
    test(`buttons in Settings → ${group} all have an outline and the same corners`, async ({ page }) => {
      await openSettingsGroup(page, group);
      await openAllCards(page);
      const looks = await buttonLooks(page);
      if (looks.length) expectOutlined(looks);
    });
  }
});
