import { test, expect, chip, lastWrite, writeCount, writeTag, status, settingsCard, fold, goCreate } from './nfc.js';

const rows = (page) => fold(page, 'filaments').getByRole('list', { name: 'Saved filaments' }).getByRole('listitem');
const saveButton = (page) => page.getByRole('button', { name: '+ Save this spool as a filament' });

/** Open the Filaments tab, where the list lives. */
const openCard = (page) => page.getByRole('tab', { name: 'Filaments' }).click();

/** Check the list's summary on the Filaments tab, then come back to Create. */
async function saved(page, text) {
  await openCard(page);
  // An empty list shows its empty state instead of a count
  if (text === 'None yet') await expect(fold(page, 'filaments')).toContainText('No saved filaments yet');
  else await expect(fold(page, 'filaments').locator('.sum')).toHaveText(text);
  await goCreate(page);
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
    await saved(page, 'None yet');
    await expect(saveButton(page)).toBeVisible();
    // The form's last row (with Start over) comes after Tag data: nothing to scroll back up for
    const order = await page.evaluate(() =>
      [...document.querySelector('form.form').children].map((c) => c.getAttribute('data-fold') || (c.classList.contains('form-actions') ? 'actions' : '')),
    );
    expect(order.indexOf('tagdata')).toBeLessThan(order.indexOf('actions'));
    await expect(page.locator('.form-actions').getByRole('button', { name: '+ Save this spool as a filament' })).toBeVisible();
  });

  test('saves the spool, keeps it after a reload, and a tap writes a tag with it', async ({ page }) => {
    await chip(page, 'Overture').click();
    await chip(page, 'PLA').click();
    await saveButton(page).click();
    await expect(status(page)).toContainText('Saved Overture PLA to My filaments');

    await page.reload();
    await saved(page, '1 saved');
    await chip(page, 'SUNLU').click(); // the form isn't used: the tag is the saved spool
    await openCard(page);
    await rows(page).first().getByRole('button', { name: /^Use Overture PLA/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Overture PLA');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    expect(await writeCount(page)).toBe(0);

    await rows(page).first().getByRole('button', { name: /^Use Overture PLA/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Write tag' }).click();
    await expect(status(page)).toContainText('Tag written');
    expect(await lastWrite(page)).toMatchObject({ brand: 'Overture', type: 'PLA' });
    await expect(rows(page).first()).toHaveClass(/on/);

    // Write another: same tag content, counted
    await expect(page.getByText('1 tag written for Overture PLA')).toBeVisible();
    await page.getByRole('button', { name: 'Write another tag' }).click();
    await expect(page.getByText('2 tags written for Overture PLA')).toBeVisible();
    expect(await writeCount(page)).toBe(2);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Write another tag' })).toHaveCount(0);
  });

  test('saving the same spool twice keeps one', async ({ page }) => {
    await saveButton(page).click();
    await saveButton(page).click();
    await expect(status(page)).toContainText('already in My filaments');
    await saved(page, '1 saved');
  });

  test('a form with a problem is not saved', async ({ page }) => {
    await fold(page, 'temps').locator('summary').click(); // starts open in tests: shut, then fill
    await fold(page, 'temps').locator('summary').click();
    await page.getByLabel('Min').first().fill('900');
    await saveButton(page).click();
    await expect(status(page)).toContainText('Fix');
    await saved(page, 'None yet');
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

  test('Remove (inside ⋯) asks first: cancel keeps it, OK removes it', async ({ page }) => {
    await saveSpool(page, 'Overture', 'PLA');
    await openCard(page);
    await rows(page).first().getByRole('button', { name: /^Edit/ }).click();
    const remove = rows(page).first().getByRole('button', { name: 'Remove', exact: true });

    let asked = answer(page, false);
    await remove.click();
    expect(await asked).toMatch(/Remove Overture PLA .* from My filaments\?/);
    await expect(rows(page)).toHaveCount(1);

    asked = answer(page, true);
    await remove.click();
    await asked;
    await expect(fold(page, 'filaments')).toContainText('No saved filaments yet');
  });

  test('pin, name and note: the star moves a row up, the name replaces the title, the note shows under it, none reach the tag', async ({ page }) => {
    await saveSpool(page, 'Overture', 'PLA');
    await saveSpool(page, 'Polymaker', 'PETG');
    await openCard(page);
    // newest first: Polymaker, then Overture
    await rows(page).nth(1).getByRole('button', { name: /^Pin/ }).click();
    await expect(rows(page).first()).toContainText('Overture');
    await expect(fold(page, 'filaments').locator('.sum')).toContainText('1 pinned');

    await rows(page).first().getByRole('button', { name: /^Edit/ }).click();
    await rows(page).first().getByLabel('Name').fill('Everyday spool');
    await rows(page).first().getByLabel('Note').fill('Dry box 2');
    await rows(page).first().getByRole('button', { name: 'Done' }).click();
    await expect(rows(page).first().locator('.name')).toHaveText('Everyday spool');
    await expect(rows(page).first().locator('.note')).toHaveText('Dry box 2');

    // Writing from it puts only tag fields on the tag
    await rows(page).first().getByRole('button', { name: /^Use/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Write tag' }).click();
    await expect(status(page)).toContainText('Tag written');
    const text = JSON.stringify(await lastWrite(page));
    expect(text).not.toContain('Everyday spool');
    expect(text).not.toContain('Dry box 2');
  });

  test('after a write it offers to save: Save keeps it, Not now does not', async ({ page }) => {
    await chip(page, 'Polymaker').click();
    await writeTag(page);
    const offer = page.getByRole('group', { name: 'Save this spool' });
    await expect(offer).toBeVisible();
    await offer.getByRole('button', { name: 'Save' }).click();
    await expect(offer).toBeHidden();
    await saved(page, '1 saved');

    await writeTag(page); // the same spool again: nothing to offer
    await expect(offer).toBeHidden();

    await chip(page, 'SUNLU').click();
    await writeTag(page);
    await offer.getByRole('button', { name: 'Not now' }).click();
    await expect(offer).toBeHidden();
    await saved(page, '1 saved');
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
    await goCreate(page);

    await chip(page, 'Polymaker').click();
    await writeTag(page);
    await expect(status(page)).toContainText('Saved to My filaments');
    await expect(page.getByRole('group', { name: 'Save this spool' })).toHaveCount(0);
    await saved(page, '1 saved');

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
    await expect(card).toContainText('No saved filaments yet');
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

  test('sort: by brand, kept after a reload, and Last used puts the filament you just wrote first', async ({ page }) => {
    await saveSpool(page, 'Overture', 'PLA');
    await saveSpool(page, 'Polymaker', 'PETG');
    await saveSpool(page, 'Generic', 'PLA');
    await openCard(page);
    const sort = (name) => fold(page, 'filaments').getByRole('group', { name: 'Sort' }).getByRole('button', { name });
    // newest first: Generic, Polymaker, Overture
    await expect(rows(page).first()).toContainText('Generic');
    await sort('Brand').click();
    await expect(rows(page).nth(1)).toContainText('Overture');

    await page.reload();
    await openCard(page);
    await expect(sort('Brand')).toHaveAttribute('aria-pressed', 'true');
    await expect(rows(page).nth(1)).toContainText('Overture');

    await sort('Last used').click();
    await rows(page).nth(2).getByRole('button', { name: /^Use/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Write tag' }).click();
    await expect(rows(page).first()).toContainText('Overture');
  });
});
