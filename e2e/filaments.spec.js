import { test, expect, chip, writeTag, status, openCustom, settingsCard } from './nfc.js';

const fold = (page, id) => page.locator(`[data-fold="${id}"]`);
const rows = (page) => fold(page, 'filaments').getByRole('list', { name: 'Saved filaments' }).getByRole('listitem');
const saveButton = (page) => page.getByRole('button', { name: '+ Save this spool as a filament' });

/** Open the My filaments card (it starts closed). */
async function openCard(page) {
  if (!(await fold(page, 'filaments').evaluate((d) => d.open))) await fold(page, 'filaments').locator('summary').click();
}

/** Answer the next confirm() with `yes`, and return what it asked. */
function answer(page, yes) {
  page.removeAllListeners('dialog');
  return new Promise((resolve) => {
    page.once('dialog', async (d) => {
      resolve(d.message());
      await (yes ? d.accept() : d.dismiss());
    });
  });
}

async function saveSpool(page, brand, material) {
  await chip(page, brand).click();
  await chip(page, material).click();
  await saveButton(page).click();
}

test.describe('My filaments', () => {
  test('starts empty, with the save button at the end of the form', async ({ page }) => {
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('None yet');
    await expect(saveButton(page)).toBeVisible();
    // After Tag data and above Start over: nothing to scroll back up for
    const order = await page.evaluate(() => {
      const form = document.querySelector('form.form');
      const kids = [...form.children].map((c) => c.getAttribute('data-fold') || c.textContent.trim().slice(0, 12));
      return kids;
    });
    expect(order.indexOf('tagdata')).toBeLessThan(order.findIndex((k) => k.startsWith('+ Save this')));
    expect(order.findIndex((k) => k.startsWith('+ Save this'))).toBeLessThan(order.findIndex((k) => k.startsWith('Start over')));
  });

  test('saves the spool, keeps it after a reload, and a tap fills the form', async ({ page }) => {
    await chip(page, 'Overture').click();
    await chip(page, 'PLA').click();
    await saveButton(page).click();
    await expect(status(page)).toContainText('Saved Overture PLA to My filaments');
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('1 saved');

    await page.reload();
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('1 saved');
    await openCard(page);
    await chip(page, 'SUNLU').click();
    await rows(page).first().getByRole('button', { name: /^Use Overture PLA/ }).click();
    await expect(status(page)).toContainText('Filled in Overture PLA');
    await expect(fold(page, 'filament').locator('.sum')).toContainText('Overture');
    await expect(rows(page).first()).toHaveClass(/on/); // the form matches it again
  });

  test('saving the same spool twice keeps one', async ({ page }) => {
    await saveButton(page).click();
    await saveButton(page).click();
    await expect(status(page)).toContainText('already in My filaments');
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('1 saved');
  });

  test('a form with a problem is not saved', async ({ page }) => {
    await fold(page, 'temps').locator('summary').click(); // starts open in tests: shut, then fill
    await fold(page, 'temps').locator('summary').click();
    await page.getByLabel('Min').first().fill('900');
    await saveButton(page).click();
    await expect(status(page)).toContainText('Fix');
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('None yet');
  });

  /** Put `n` saved spools straight into storage: the first white, the rest colorful. */
  async function seed(page, n) {
    await page.evaluate((count) => {
      const base = { profile: 'u1', minTemp: '190', maxTemp: '220', bedMinTemp: '50', bedMaxTemp: '60', colorType: '1' };
      const list = Array.from({ length: count }, (_, i) => ({
        ...base,
        brand: i === 0 ? 'Polymaker' : 'Overture',
        type: 'PLA',
        subtype: '',
        maxTemp: String(221 + i),
        colors: [i === 0 ? 'E8E8E8' : '2A49C7'],
        colorName: i === 0 ? 'Cotton White' : i === 1 ? '' : 'Blue',
      }));
      localStorage.setItem('filascribe-filaments', JSON.stringify(list));
    }, n);
    await page.reload();
    await openCard(page);
  }

  test('search only shows up once there are too many to scan', async ({ page }) => {
    await seed(page, 7);
    await expect(rows(page)).toHaveCount(7);
    await expect(page.getByRole('searchbox', { name: 'Search your filaments' })).toHaveCount(0);
    await seed(page, 8);
    await expect(page.getByRole('searchbox', { name: 'Search your filaments' })).toBeVisible();
  });

  test('search narrows the list; white finds a white spool', async ({ page }) => {
    await seed(page, 9);
    const find = page.getByRole('searchbox', { name: 'Search your filaments' });
    await find.fill('white');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Polymaker');
    await find.fill('zzz');
    await expect(fold(page, 'filaments')).toContainText('No filament matches');
    await find.fill('');
    await expect(rows(page)).toHaveCount(9);
  });

  test('a color you picked yourself says so, a brand color does not', async ({ page }) => {
    await seed(page, 3);
    await expect(rows(page).nth(0)).not.toContainText('Custom color'); // Cotton White: from the database
    await expect(rows(page).nth(1)).toContainText('Custom color'); // no name of its own: just a rough word
    await expect(rows(page).nth(1).getByRole('button', { name: /^Use/ })).toHaveAccessibleName(/custom color/);
    await expect(rows(page).nth(2)).not.toContainText('Custom color');
  });

  test('the × asks first: cancel keeps it, OK removes it', async ({ page }) => {
    await saveSpool(page, 'Overture', 'PLA');
    await openCard(page);
    const remove = rows(page).first().getByRole('button', { name: /^Remove/ });

    let asked = answer(page, false);
    await remove.click();
    expect(await asked).toMatch(/Remove Overture PLA .* from My filaments\?/);
    await expect(rows(page)).toHaveCount(1);

    asked = answer(page, true);
    await remove.click();
    await asked;
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('None yet');
  });

  test('after a write it offers to save: Save keeps it, Not now does not', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await writeTag(page);
    const offer = page.getByRole('group', { name: 'Save this spool' });
    await expect(offer).toBeVisible();
    await offer.getByRole('button', { name: 'Save' }).click();
    await expect(offer).toBeHidden();
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('1 saved');

    await writeTag(page); // the same spool again: nothing to offer
    await expect(offer).toBeHidden();

    await chip(page, 'SUNLU').click();
    await writeTag(page);
    await offer.getByRole('button', { name: 'Not now' }).click();
    await expect(offer).toBeHidden();
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('1 saved');
  });

  test('the offer goes away when the form changes', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await writeTag(page);
    await expect(page.getByRole('group', { name: 'Save this spool' })).toBeVisible();
    await chip(page, 'SUNLU').click();
    await expect(page.getByRole('group', { name: 'Save this spool' })).toBeHidden();
  });

  test('Settings: save every write automatically', async ({ page }) => {
    const card = await settingsCard(page, 'My filaments');
    await card.getByRole('checkbox', { name: /Save every write automatically/ }).check();
    await page.getByRole('tab', { name: 'Create' }).click();

    await chip(page, 'Polymaker').click();
    await writeTag(page);
    await expect(status(page)).toContainText('Saved to My filaments');
    await expect(page.getByRole('group', { name: 'Save this spool' })).toHaveCount(0);
    await expect(fold(page, 'filaments').locator('.sum')).toHaveText('1 saved');

    await page.reload(); // the choice is kept
    await settingsCard(page, 'My filaments');
    await expect(page.getByRole('checkbox', { name: /Save every write automatically/ })).toBeChecked();
  });

  test('Settings: Clear all asks first, and has no list of its own', async ({ page }) => {
    await saveSpool(page, 'Overture', 'PLA');
    const card = await settingsCard(page, 'My filaments');
    await expect(card.getByRole('list')).toHaveCount(0);
    await expect(card).toContainText('1 saved filament');

    let asked = answer(page, false);
    await card.getByRole('button', { name: 'Clear all' }).click();
    expect(await asked).toMatch(/Remove all 1 saved filament from My filaments\?/);
    await expect(card).toContainText('1 saved filament');

    asked = answer(page, true);
    await card.getByRole('button', { name: 'Clear all' }).click();
    await asked;
    await expect(card).toContainText('None yet');
  });

  test('Settings: export and import round-trip', async ({ page }) => {
    await saveSpool(page, 'Overture', 'PLA');
    const card = await settingsCard(page, 'My filaments');
    const json = JSON.stringify([{ profile: 'u1', brand: 'Overture', type: 'PLA', subtype: 'Matte', minTemp: '190', maxTemp: '220', bedMinTemp: '50', bedMaxTemp: '60', colors: ['111111'], colorName: 'Black' }]);
    await card.getByLabel('My filaments file').setInputFiles({ name: 'f.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    await expect(status(page)).toContainText('Imported 1 filament');
    await expect(card).toContainText('2 saved filaments');
    await card.getByLabel('My filaments file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
    await expect(status(page)).toContainText('isn’t a My filaments export');
  });
});
