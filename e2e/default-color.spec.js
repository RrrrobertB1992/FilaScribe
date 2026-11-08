import { test, expect, colorTab, chip, temps, openCustom, nowName, nowFrom, goCreate } from './nfc.js';

// The app opens on a brand color when the remembered brand has some:
// White, else Black, else the first color in the list.

async function openWith(page, defaults) {
  await page.evaluate((d) => localStorage.setItem('filascribe-defaults', JSON.stringify(d)), defaults);
  await page.reload();
}

test.describe('Starting color', () => {
  test('a remembered brand opens on its Black when there is no plain White', async ({ page }) => {
    await openWith(page, { profile: 'u1', brand: 'Bambu Lab', type: 'PLA', subtype: 'Basic' });
    await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
    await expect(nowName(page)).toHaveText('Black');
    await expect(nowFrom(page)).toContainText('Brand color');
    await expect(page.locator('.colorsec .now-hex')).toHaveText('#000000');
  });

  test('a brand with neither opens on the first color in its list', async ({ page }) => {
    await openWith(page, { profile: 'u1', brand: '3D Fuel', type: 'PLA', subtype: 'Dual-Color Silk' });
    await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
    const first = page.locator('.brand .tile').first();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(nowFrom(page)).toContainText('Brand color');
  });

  test('Generic (no brand colors) still opens on Custom', async ({ page }) => {
    await expect(chip(page, 'Generic')).toHaveAttribute('aria-pressed', 'true');
    await expect(nowName(page)).toHaveText('Custom colors');
    await expect(colorTab(page, 'Custom')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the temperatures the app remembers are left alone', async ({ page }) => {
    await openWith(page, { profile: 'u1', brand: 'Bambu Lab', type: 'PLA', subtype: 'Basic', minTemp: '201', maxTemp: '222' });
    await expect(nowName(page)).toHaveText('Black');
    await expect(temps(page, 'Nozzle').min).toHaveValue('201');
    await expect(temps(page, 'Nozzle').max).toHaveValue('222');
  });

  test('Start over goes back to the starting color', async ({ page }) => {
    await openWith(page, { profile: 'u1', brand: 'Bambu Lab', type: 'PLA', subtype: 'Basic' });
    await expect(nowName(page)).toHaveText('Black');
    await page.locator('.brand .tile', { hasText: 'Beige' }).first().click();
    await expect(nowName(page)).toHaveText('Beige');
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(nowName(page)).toHaveText('Black');
  });

  test('picking a brand later does not pick a color for you', async ({ page }) => {
    await chip(page, 'Bambu Lab').click();
    await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
    await expect(nowName(page)).toHaveText('Custom colors');
  });
});

// Settings replaces the form, and the color lists forget what they had picked.
// Coming back must show the same choice, not turn a brand color into Custom.
test.describe('Colors after a visit to Settings', () => {
  const toSettingsAndBack = async (page) => {
    await page.getByRole('tab', { name: 'Settings' }).click();
    await goCreate(page);
  };

  test('a brand color stays a brand color', async ({ page }) => {
    await openWith(page, { profile: 'u1', brand: 'Anycubic', type: 'PLA', subtype: 'Basic' });
    await expect(nowName(page)).toHaveText('White');
    await expect(nowFrom(page)).toContainText('Brand color');
    await toSettingsAndBack(page);
    await expect(nowName(page)).toHaveText('White');
    await expect(nowFrom(page)).toContainText('Brand color');
    await expect(colorTab(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.brand .tile[aria-pressed="true"]')).toHaveCount(1);
  });

  test('a custom color stays custom', async ({ page }) => {
    await openWith(page, { profile: 'u1', brand: 'Bambu Lab', type: 'PLA', subtype: 'Basic' });
    await openCustom(page);
    await page.locator('#hex-input').fill('123456');
    await expect(nowFrom(page)).not.toContainText('Brand color');
    await toSettingsAndBack(page);
    await expect(nowFrom(page)).not.toContainText('Brand color');
    await openCustom(page);
    await expect(page.locator('#hex-input')).toHaveValue('123456');
  });
});
