import { test, expect, chip, choiceRow, goCreate, lastWrite, openCards, readFrom, settingsCard, showAllMaterials, temps, typeOther, writeTag } from './nfc.js';

// The lists in Settings that choose what the Create form offers
const settings = (page) => page.getByRole('tab', { name: 'Settings' }).click();

// Tap × on a brand or material in its Settings card
async function hideOnForm(page, cardName, buttonName) {
  const card = await settingsCard(page, cardName);
  await card.getByRole('group', { name: `${cardName} on the form` }).getByRole('button', { name: buttonName, exact: true }).click();
}

test.describe('Settings: your brands, materials and variants', () => {
  test('brands: × removes, typing finds brands that start with it, a tap adds', async ({ page }) => {
    const brandRow = choiceRow(page, 'Brand');
    const brands = (await settingsCard(page, 'Brands'));
    const onForm = brands.getByRole('group', { name: 'Brands on the form' });
    const toAdd = brands.getByRole('list', { name: 'Brands to add' });
    await expect(onForm).toContainText('Generic');
    await expect(onForm).toContainText('SUNLU');

    // nothing listed until something is typed
    await expect(toAdd).toHaveCount(0);
    // one letter: only brands starting with it, at most 12, none already on the form
    await brands.getByLabel('Find a brand').fill('a');
    await expect(toAdd.getByRole('listitem')).toHaveCount(12);
    for (const name of await toAdd.locator('.bname').allTextContents()) expect(name.trim()[0].toLowerCase()).toBe('a');
    await brands.getByLabel('Find a brand').fill('s');
    await expect(toAdd).not.toContainText('SUNLU'); // already on the form

    // remove one with ×: it can be found again
    await onForm.getByRole('button', { name: 'Hide SUNLU' }).click();
    await expect(onForm).not.toContainText('SUNLU');
    await brands.getByLabel('Find a brand').fill('sun');
    await expect(toAdd.getByRole('button', { name: 'Add SUNLU' })).toBeVisible();

    // a tap adds it, and it leaves the list
    await brands.getByLabel('Find a brand').fill('elegoo');
    await toAdd.getByRole('button', { name: 'Add Elegoo' }).click();
    await expect(onForm).toContainText('Elegoo');
    await expect(brands.getByRole('button', { name: 'Add Elegoo' })).toHaveCount(0);

    // a name nobody lists
    await brands.getByLabel('Find a brand').fill('Zephyr');
    await expect(brands).toContainText('No other brands start with “Zephyr”.');
    await brands.getByRole('button', { name: 'Add “Zephyr” as your own brand' }).click();
    await expect(onForm).toContainText('Zephyr');

    await goCreate(page);
    await expect(brandRow.getByRole('button', { name: 'SUNLU', exact: true })).toHaveCount(0);
    await expect(brandRow.getByRole('button', { name: 'Elegoo', exact: true })).toBeVisible();
    await expect(brandRow.getByRole('button', { name: 'Zephyr', exact: true })).toHaveClass(/saved/);

    // it sticks
    await page.reload();
    await expect(brandRow.getByRole('button', { name: 'Elegoo', exact: true })).toBeVisible();
    await expect(brandRow.getByRole('button', { name: 'SUNLU', exact: true })).toHaveCount(0);

    // reset
    await (await settingsCard(page, 'Brands')).getByRole('button', { name: 'Show the default brands' }).click();
    await goCreate(page);
    await expect(brandRow.getByRole('button', { name: 'SUNLU', exact: true })).toBeVisible();
    await expect(brandRow.getByRole('button', { name: 'Elegoo', exact: true })).toHaveCount(0);
  });
  test('the Material row starts short: PLA, PETG and ABS', async ({ page }) => {
    const row = choiceRow(page, 'Material');
    for (const name of ['PLA', 'PETG', 'ABS', 'Other…']) await expect(row.getByRole('button', { name, exact: true })).toBeVisible();
    for (const name of ['TPU', 'ASA', 'PEEK', 'PVA']) await expect(row.getByRole('button', { name, exact: true })).toHaveCount(0);
  });
  test('materials: choose what the Material row shows', async ({ page }) => {
    const row = choiceRow(page, 'Material');
    const materials = await settingsCard(page, 'Materials');
    const onForm = materials.getByRole('group', { name: 'Materials on the form' });
    const toAdd = materials.getByRole('group', { name: 'Materials to add' });
    await expect(onForm).toContainText('PLA');
    await expect(onForm).toContainText('PETG');
    await expect(onForm).toContainText('ABS');
    await expect(onForm).not.toContainText('PEEK');

    // + adds one back, and it leaves the list
    await toAdd.getByRole('button', { name: 'Add TPU', exact: true }).click();
    await expect(onForm).toContainText('TPU');
    await expect(materials.getByRole('button', { name: 'Add TPU', exact: true })).toHaveCount(0);

    // × hides one
    await onForm.getByRole('button', { name: 'Hide PETG' }).click();
    await expect(onForm).not.toContainText('PETG');
    await expect(materials.getByRole('button', { name: 'Add PETG', exact: true })).toBeVisible();

    // narrowing the list, and a name nobody lists
    await materials.getByLabel('Find a material').fill('pee');
    await expect(toAdd.getByRole('button')).toHaveCount(1);
    await materials.getByLabel('Find a material').fill('PLA+');
    await expect(materials).toContainText('No other materials match “PLA+”.');
    await materials.getByRole('button', { name: 'Add “PLA+” as your own material' }).click();
    await expect(onForm).toContainText('PLA+');

    await goCreate(page);
    await expect(row.getByRole('button', { name: 'TPU', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'PETG', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'PLA+', exact: true })).toHaveClass(/saved/);

    // it sticks
    await page.reload();
    await expect(row.getByRole('button', { name: 'TPU', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'PETG', exact: true })).toHaveCount(0);

    // reset
    await (await settingsCard(page, 'Materials')).getByRole('button', { name: 'Show the default materials' }).click();
    await goCreate(page);
    await expect(row.getByRole('button', { name: 'PETG', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'TPU', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'PLA+', exact: true })).toHaveCount(0);
  });
  test('Other… suggests hidden materials, fills their temperatures, and puts a built-in one on the row', async ({ page }) => {
    const row = choiceRow(page, 'Material');
    const matches = page.getByRole('group', { name: 'Suggestions' });
    await row.getByRole('button', { name: 'Other…' }).click();
    await page.getByLabel('Other material').fill('pee');
    await expect(matches.getByRole('button', { name: 'PEEK' })).toBeVisible();
    await expect(matches.getByRole('button', { name: 'PLA' })).toHaveCount(0); // already on the row
    await matches.getByRole('button', { name: 'PEEK' }).click();
    // it's a chip now (built in: no dashed outline), with its temperatures
    await expect(page.getByLabel('Other material')).toHaveValue('PEEK');
    await expect(chip(page, 'PEEK')).toBeVisible();
    await expect(chip(page, 'PEEK')).not.toHaveClass(/saved/);
    await expect(temps(page, 'Nozzle').min).toHaveValue('360');
    await chip(page, 'PLA').click();
    await expect(chip(page, 'PEEK')).toBeVisible(); // and it stays on the row
    // a typed built-in name in any case becomes its spelling
    await row.getByRole('button', { name: 'Other…' }).click();
    await page.getByLabel('Other material').fill('tpu');
    await page.getByLabel('Other material').press('Enter');
    await expect(page.getByLabel('Other material')).toHaveValue('TPU');
    await expect(chip(page, 'TPU')).toBeVisible();
    await expect(temps(page, 'Nozzle').min).toHaveValue('210');
    // Settings lists them
    const onForm = (await settingsCard(page, 'Materials')).getByRole('group', { name: 'Materials on the form' });
    await expect(onForm).toContainText('PEEK');
    await expect(onForm).toContainText('TPU');
  });
  test('writing a tag turns its material on', async ({ page }) => {
    await typeOther(page, 'material', 'PLA+');
    await writeTag(page);
    expect((await lastWrite(page)).type).toBe('PLA+');
    await expect(chip(page, 'PLA+')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-materials')).shown)).toContain('PLA+');
  });
  test('a read tag with a hidden material still shows it selected', async ({ page }) => {
    await readFrom(page, { protocol: 'openspool', version: '1.0', type: 'PEEK', brand: 'Generic', color_hex: 'FFFFFF' });
    await openCards(page);
    await expect(chip(page, 'PEEK')).toHaveAttribute('aria-pressed', 'true');
    // pick something else and it goes away again
    await chip(page, 'PLA').click();
    await expect(chip(page, 'PEEK')).toHaveCount(0);
  });
  test('hiding a material hides it for brands too, and a brand still filters the rest', async ({ page }) => {
    const row = choiceRow(page, 'Material');
    await hideOnForm(page, 'Materials', 'Hide PETG');
    await goCreate(page);
    await chip(page, 'JAYO').click(); // JAYO makes PLA, PETG and TPU; ABS isn't made
    await expect(row.getByRole('button', { name: 'PLA', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'PETG', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'ABS', exact: true })).toHaveCount(0);
  });
  test('a brand that doesn’t make the material switches to a material you show', async ({ page }) => {
    await showAllMaterials(page);
    // hide PLA, so the switch has to pick from what's left
    await hideOnForm(page, 'Materials', 'Hide PLA');
    await goCreate(page);
    await chip(page, 'PEEK').click();
    await chip(page, 'JAYO').click(); // no PEEK: PETG is the first of its materials that is shown
    await expect(chip(page, 'PETG')).toHaveAttribute('aria-pressed', 'true');
    await expect(temps(page, 'Nozzle').min).toHaveValue('220');
  });
  test('materials saved as chips before move into the material list', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('filascribe-custom-chips', JSON.stringify({ brands: [], materials: ['PLA+'], variants: {} })));
    await page.reload();
    await expect(chip(page, 'PLA+')).toBeVisible();
    await expect(chip(page, 'PETG')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-materials')).shown)).toEqual(['PLA', 'PETG', 'ABS', 'PLA+']);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-custom-chips')).materials)).toEqual([]);
  });

    const vbtn = (scope, name) => scope.getByRole('button', { name, exact: true });
  async function hideVariants(page, ...names) {
    const variants = await settingsCard(page, 'Variants');
    for (const n of names) await vbtn(variants, n).click();
    await goCreate(page);
  }
  test('variants: a card per kind, with the brands’ own words under the usual name', async ({ page }) => {
    const variants = await settingsCard(page, 'Variants');
    // the default brands, PLA/PETG/ABS: no hardness (that's TPU), no nylon-only kinds
    await expect(vbtn(variants, 'Metallic')).toContainText('Metal');
    await expect(vbtn(variants, 'Matte')).toContainText('Matt');
    await expect(vbtn(variants, 'HF')).toContainText('Rapid');
    await expect(vbtn(variants, 'Basic')).toHaveAttribute('aria-pressed', 'true');
    // the short names say what they are, without repeating a brand's word
    await expect(vbtn(variants, 'CF')).toContainText('Carbon fiber');
    await expect(vbtn(variants, 'FR')).toContainText('Flame retardant');
    await expect(vbtn(variants, 'GF')).toContainText('Glass fiber');
    await expect(vbtn(variants, 'GF').getByText('Glass Fiber', { exact: true })).toHaveCount(0);
    await expect(vbtn(variants, 'Plus')).toContainText('PLA+');
    await expect(vbtn(variants, 'Fluorescent')).toContainText('Neon');
    await expect(vbtn(variants, 'Multi-color')).not.toContainText('Several'); // names that explain themselves have no description
    await expect(variants.getByRole('group', { name: 'TPU hardness' })).toHaveCount(0);
    await expect(variants).toContainText('0 hidden');
    // the filter looks at every name on a card
    await variants.getByLabel('Find a variant').fill('rapid');
    await expect(vbtn(variants, 'HF')).toBeVisible();
    await expect(vbtn(variants, 'Matte')).toHaveCount(0);
    await variants.getByLabel('Find a variant').fill('zzz');
    await expect(variants).toContainText('No variants match “zzz”.');
  });
  test('variants: a hidden one leaves the Variant row for brands, but Generic keeps the default list', async ({ page }) => {
    const row = choiceRow(page, 'Variant');
    await chip(page, 'Bambu Lab').click();
    for (const name of ['None', 'Matte', 'Silk', 'Glow']) await expect(vbtn(row, name)).toBeVisible();

    const variants = await settingsCard(page, 'Variants');
    await vbtn(variants, 'Glow').click();
    await expect(vbtn(variants, 'Glow')).toHaveAttribute('aria-pressed', 'false');
    await expect(vbtn(variants, 'Glow')).toContainText('Hidden');
    await expect(variants).toContainText('1 hidden');

    await goCreate(page);
    await expect(vbtn(row, 'Glow')).toHaveCount(0);
    for (const name of ['None', 'Matte', 'Silk']) await expect(vbtn(row, name)).toBeVisible();
    await chip(page, 'Snapmaker').click();
    await expect(vbtn(row, 'Glow')).toHaveCount(0);
    // Generic shows the full default list, hidden or not
    await chip(page, 'Generic').click();
    await expect(vbtn(row, 'Glow')).toBeVisible();

    // it sticks
    await page.reload();
    await chip(page, 'Bambu Lab').click();
    await expect(vbtn(row, 'Glow')).toHaveCount(0);
    await expect(vbtn(row, 'Matte')).toBeVisible();

    // tap again to show it
    await vbtn(await settingsCard(page, 'Variants'), 'Glow').click();
    await goCreate(page);
    await expect(vbtn(row, 'Glow')).toBeVisible();
  });
  test('variants: hiding a kind hides a brand’s own word for it', async ({ page }) => {
    const row = choiceRow(page, 'Variant');
    await chip(page, 'Bambu Lab').click();
    await expect(vbtn(row, 'Metal')).toBeVisible(); // Bambu says Metal
    await hideVariants(page, 'Metallic');
    await expect(vbtn(row, 'Metal')).toHaveCount(0);
    await chip(page, 'Polymaker').click(); // says Metallic
    await expect(vbtn(row, 'Metallic')).toHaveCount(0);
  });
  test('variants: only what the enabled brands make, in the materials shown', async ({ page }) => {
    const variants = await settingsCard(page, 'Variants');
    await expect(vbtn(variants, 'SnapSpeed')).toBeVisible(); // Snapmaker's
    // hide a variant, then turn its only brand off: it's still listed, so it can be shown again
    await vbtn(variants, 'SnapSpeed').click();
    await hideOnForm(page, 'Brands', 'Hide Snapmaker');
    await expect(vbtn(variants, 'SnapSpeed')).toContainText('None of your brands make it');
    await vbtn(variants, 'SnapSpeed').click(); // shown again
    await expect(vbtn(variants, 'SnapSpeed')).toHaveCount(0); // and no longer listed
    // no brands of their own: a hint instead of a list
    for (const b of ['Bambu Lab', 'HATCHBOX', 'eSUN', 'Overture', 'SUNLU', 'Polymaker', 'Prusa Polymers', 'JAYO']) {
      await hideOnForm(page, 'Brands', `Hide ${b}`);
    }
    await expect(variants).toContainText('None of your brands has variants of its own yet');
    await expect(variants.getByLabel('Find a variant')).toHaveCount(0);
  });
  test('variants: TPU hardness is listed once TPU is shown', async ({ page }) => {
    const variants = await settingsCard(page, 'Variants');
    await expect(variants.getByRole('group', { name: 'TPU hardness' })).toHaveCount(0);
    await (await settingsCard(page, 'Materials')).getByRole('button', { name: 'Add TPU', exact: true }).click();
    const hardness = variants.getByRole('group', { name: 'TPU hardness' });
    await expect(hardness.getByRole('button', { name: '90A', exact: true })).toBeVisible();
    await hardness.getByRole('button', { name: '85A', exact: true }).click();
    await expect(hardness.getByRole('button', { name: '85A', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await goCreate(page);
    await chip(page, 'Bambu Lab').click();
    await chip(page, 'TPU').click();
    await expect(vbtn(choiceRow(page, 'Variant'), '85A')).toHaveCount(0);
    await expect(vbtn(choiceRow(page, 'Variant'), '90A')).toBeVisible();
  });
  test('variants: Hide all, then Show all', async ({ page }) => {
    const row = choiceRow(page, 'Variant');
    const variants = await settingsCard(page, 'Variants');
    await variants.getByRole('button', { name: 'Hide all' }).click();
    await expect(variants.getByRole('button', { name: 'Hide all' })).toBeDisabled();
    await goCreate(page);
    await chip(page, 'Bambu Lab').click();
    await expect(vbtn(row, 'None')).toBeVisible(); // None never goes
    await expect(vbtn(row, 'Matte')).toHaveCount(0);
    await chip(page, 'Generic').click();
    await expect(vbtn(row, 'Matte')).toBeVisible();
    await (await settingsCard(page, 'Variants')).getByRole('button', { name: 'Show all' }).click();
    await goCreate(page);
    await chip(page, 'Bambu Lab').click();
    await expect(vbtn(row, 'Matte')).toBeVisible();
  });
  test('variants: None, a variant read from a tag, and a Save in the Custom box are not lost', async ({ page }) => {
    const row = choiceRow(page, 'Variant');
    await hideVariants(page, 'Glow', 'Matte');
    // None stays; a tag with a hidden variant still shows it selected
    await readFrom(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'Bambu Lab', color_hex: 'FFFFFF', subtype: 'Glow' });
    await openCards(page);
    await expect(vbtn(row, 'None')).toBeVisible();
    await expect(vbtn(row, 'Glow')).toHaveAttribute('aria-pressed', 'true');
    // pick something else and it goes away again
    await vbtn(row, 'None').click();
    await expect(vbtn(row, 'Glow')).toHaveCount(0);
    await expect(vbtn(row, 'Matte')).toHaveCount(0);
    // typing a hidden one in the Custom box and saving it turns it back on
    await row.getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom variant').fill('Glow');
    await page.getByRole('button', { name: 'Save variant as a chip' }).click();
    await expect(vbtn(row, 'Glow')).toBeVisible();
    const variants = await settingsCard(page, 'Variants');
    await expect(vbtn(variants, 'Glow')).toHaveAttribute('aria-pressed', 'true');
    await expect(vbtn(variants, 'Matte')).toHaveAttribute('aria-pressed', 'false');
  });
  test('variants: typing a near name in Custom ("Matt") does not bring the hidden Matte back', async ({ page }) => {
    const row = choiceRow(page, 'Variant');
    await chip(page, 'Bambu Lab').click();
    await hideVariants(page, 'Matte');
    await row.getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Custom variant').fill('Matt');
    await expect(vbtn(row, 'Matte')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save variant as a chip' }).click();
    // Matt is a new variant of its own; Matte is still hidden
    await expect(vbtn(row, 'Matt')).toHaveAttribute('aria-pressed', 'true');
    await expect(vbtn(row, 'Matte')).toHaveCount(0);
    await expect(vbtn(await settingsCard(page, 'Variants'), 'Matte')).toHaveAttribute('aria-pressed', 'false');
  });
  test('variants: a brand switch does not land on a hidden variant', async ({ page }) => {
    const row = choiceRow(page, 'Variant');
    await chip(page, 'Bambu Lab').click();
    await vbtn(row, 'Metal').click();
    await hideVariants(page, 'Metallic');
    // Metal is hidden but selected, so it stays until another brand: Polymaker says Metallic (hidden) -> None
    await chip(page, 'Polymaker').click();
    await expect(vbtn(row, 'None')).toHaveAttribute('aria-pressed', 'true');
    await expect(vbtn(row, 'Metallic')).toHaveCount(0);
  });
  test('a read tag with a hidden brand shows it under Other…', async ({ page }) => {
    await hideOnForm(page, 'Brands', 'Hide SUNLU');
    await readFrom(page, { protocol: 'openspool', version: '1.0', type: 'PLA', brand: 'SUNLU', color_hex: 'FFFFFF' });
    await expect(page.getByLabel('Other brand')).toHaveValue('SUNLU');
  });
  test('brands saved as chips before move into the brand list', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('filascribe-custom-chips', JSON.stringify({ brands: ['Zephyr'], materials: [], variants: {} })));
    await page.reload();
    await expect(chip(page, 'Zephyr')).toBeVisible();
    await expect(chip(page, 'SUNLU')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-brands')).shown)).toContain('Zephyr');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('filascribe-custom-chips')).brands)).toEqual([]);
  });
  test('your chips: variants are listed and removable', async ({ page }) => {
    await typeOther(page, 'variant', 'Rapid');
    await page.getByRole('button', { name: 'Save variant as a chip' }).click();
    const chips = (await settingsCard(page, 'Your chips'));
    await expect(chips.getByRole('group', { name: 'Your variants for Generic PLA' })).toContainText('Rapid');
    await chips.getByRole('button', { name: 'Remove Rapid' }).click();
    await expect(chips).toContainText('no chips of your own yet');
    await goCreate(page);
    await expect(chip(page, 'Rapid')).toHaveCount(0);
  });
});
