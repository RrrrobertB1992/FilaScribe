import { test, expect, openSettingsGroup, colorTab, chip, openCustom } from './nfc.js';

// The look is shared: every button has an outline (none looks like plain text),
// every selected chip, tab and filter is filled the same way, and links are blue.
const GROUPS = ['Your choices on the form', 'Your saved data', 'Brand colors', 'App'];

// Colors as the browser draws them, so a --ink fill can be compared with any element's
const ink = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--ink)';
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });

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

  test('a selected color tab and a selected chip are filled the same way', async ({ page }) => {
    const fill = await ink(page);
    const tab = await colorTab(page, 'Custom').evaluate((e) => getComputedStyle(e).backgroundColor);
    const picked = await page.locator('.chip[aria-pressed="true"]').first().evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(tab).toBe(fill);
    expect(picked).toBe(fill);
  });

  test('brand line filters look like the other chips', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('filascribe-defaults', JSON.stringify({ profile: 'u1', brand: 'Bambu Lab', type: 'PLA' })));
    await page.reload();
    await page.getByRole('button', { name: /^Show all .* lines$/ }).click();
    const filter = page.locator('.line').first();
    await expect(filter).toBeVisible();
    const look = await filter.evaluate((e) => {
      const s = getComputedStyle(e);
      return { fill: s.backgroundColor, border: s.borderTopColor, radius: s.borderTopLeftRadius };
    });
    const fill = await ink(page);
    expect(look.fill).toBe(fill); // "All lines" starts selected
    const chipLook = await page.locator('.chip').first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
    expect(look.radius).toBe(chipLook);
  });

  test('links are the action color with an underline', async ({ page }) => {
    await openSettingsGroup(page, 'App');
    await openAllCards(page);
    const link = page.locator('.about a').first();
    await expect(link).toBeAttached();
    const look = await link.evaluate((e) => {
      const s = getComputedStyle(e);
      const probe = document.createElement('span');
      probe.style.color = 'var(--action)';
      document.body.append(probe);
      const action = getComputedStyle(probe).color;
      probe.remove();
      return { color: s.color, action, line: s.textDecorationLine };
    });
    expect(look.color).toBe(look.action);
    expect(look.line).toContain('underline');
  });
});
